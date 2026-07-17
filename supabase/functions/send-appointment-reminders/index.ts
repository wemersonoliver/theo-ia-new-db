import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternalKey } from "../_cron_auth.ts";
import { resolveInstanceContext, sendWhatsAppText } from "../_wa_provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {

  const __authErr = requireInternalKey(req);
  if (__authErr) return __authErr;
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // CRITICAL: todo o cálculo de horário precisa estar em BRT
    // (America/Sao_Paulo). O runtime do Deno roda em UTC e
    // appointment_time / business_hours_* estão em horário local BRT.
    // ============================================================
    const TZ = "America/Sao_Paulo";
    const nowUtc = new Date();
    // Pseudo-Date representando o relógio local BRT (campos
    // getHours/getMinutes/getDate refletem BRT).
    const nowBrt = new Date(nowUtc.toLocaleString("en-US", { timeZone: TZ }));
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayStr = fmtDate(nowBrt);
    const tomorrowDate = new Date(nowBrt);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = fmtDate(tomorrowDate);
    const currentMinutes = nowBrt.getHours() * 60 + nowBrt.getMinutes();

    // Get all AI configs with reminders enabled
    const { data: configs } = await supabase
      .from("whatsapp_ai_config")
      .select("*")
      .eq("reminder_enabled", true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No reminder configs active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const config of configs) {
      const userId = config.user_id;
      const hoursBefore = config.reminder_hours_before || 2;
      const messageTemplate = config.reminder_message_template ||
        "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.";

      // Se o WhatsApp do usuário não está conectado, não tenta enviar lembretes.
      // Antes, o cron tentava a cada execução e gerava erro recorrente quando a
      // instância estava marcada como conectada no banco, mas já não existia na Evolution.
      const { data: activeInstance } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status")
        .eq("user_id", userId)
        .in("status", ["connected", "open"])
        .maybeSingle();

      if (!activeInstance) {
        console.log(`[skip] no connected WhatsApp instance for reminder user=${userId}`);
        continue;
      }

      const businessStart = config.business_hours_start || "08:00";
      const businessEnd = config.business_hours_end || "19:00";
      const [bStartH, bStartM] = businessStart.split(":").map(Number);
      const [bEndH, bEndM] = businessEnd.split(":").map(Number);
      // Piso global de educação comercial: 08:00–19:00 BRT.
      // Mesmo que o usuário configure 00:00–23:59, NUNCA enviar fora dessa janela.
      const GLOBAL_FLOOR_MIN = 8 * 60;   // 08:00
      const GLOBAL_CEIL_MIN  = 19 * 60;  // 19:00
      const businessStartMinutes = Math.max(bStartH * 60 + bStartM, GLOBAL_FLOOR_MIN);
      const businessEndMinutes   = Math.min(bEndH * 60 + bEndM,   GLOBAL_CEIL_MIN);

      // Fetch appointments for today and tomorrow that haven't been reminded
      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .eq("reminder_sent", false)
        .eq("status", "scheduled")
        .in("appointment_date", [todayStr, tomorrowStr])
        .order("appointment_date")
        .order("appointment_time");

      if (!appointments || appointments.length === 0) continue;

      // Guard global: nunca enviar fora do horário comercial (BRT).
      const withinBusinessHours =
        currentMinutes >= businessStartMinutes &&
        currentMinutes <= businessEndMinutes;
      if (!withinBusinessHours) continue;

      for (const apt of appointments) {
        const [aptH, aptM] = apt.appointment_time.split(":").map(Number);
        const aptMinutes = aptH * 60 + aptM;
        const isToday = apt.appointment_date === todayStr;
        const isTomorrow = apt.appointment_date === tomorrowStr;

        // Janela ideal: [aptMinutes - hoursBefore*60, aptMinutes]
        const idealStart = aptMinutes - hoursBefore * 60;

        let shouldSendNow = false;

        if (isToday) {
          // Se a janela ideal começa antes do expediente, espera abrir,
          // MAS nunca antes (evita enviar fora do expediente) e nunca
          // depois do horário do agendamento.
          const effectiveStart = Math.max(idealStart, businessStartMinutes);
          // Nunca enviar mais cedo que hoursBefore antes (respeita prazo).
          // effectiveStart já garante isso. Não enviar depois do compromisso.
          if (
            currentMinutes >= effectiveStart &&
            currentMinutes <= Math.min(aptMinutes, businessEndMinutes)
          ) {
            shouldSendNow = true;
          }
        } else if (isTomorrow) {
          // Só faz sentido lembrar hoje se a janela de amanhã cair antes
          // do expediente (ex.: agendamento 08:00 + 2h antes = 06:00).
          // Nesse caso, mandamos hoje nas últimas 2h antes do fechamento.
          if (idealStart < businessStartMinutes) {
            const sendWindowStart = Math.max(
              businessEndMinutes - 120,
              businessStartMinutes,
            );
            if (
              currentMinutes >= sendWindowStart &&
              currentMinutes <= businessEndMinutes
            ) {
              shouldSendNow = true;
            }
          }
        }

        if (!shouldSendNow) {
          console.log(
            `[skip] apt=${apt.id} date=${apt.appointment_date} time=${apt.appointment_time} ` +
              `nowBRT=${String(nowBrt.getHours()).padStart(2, "0")}:${String(nowBrt.getMinutes()).padStart(2, "0")} ` +
              `business=${businessStart}-${businessEnd} hoursBefore=${hoursBefore}`,
          );
          continue;
        }

        // Build message from template
        const diaReferencia = isToday ? "hoje" : "amanhã";
        const horaFormatted = `${String(aptH).padStart(2, "0")}:${String(aptM).padStart(2, "0")}`;
        const message = messageTemplate
          .replace("{nome}", apt.contact_name || "")
          .replace("{dia_referencia}", diaReferencia)
          .replace("{hora}", horaFormatted)
          .replace("{titulo}", apt.title || "")
          .replace("{data}", apt.appointment_date);

        // Atomic claim BEFORE sending. Multiple cron/function executions can overlap;
        // only the first one that flips reminder_sent from false -> true may send.
        const claimedAt = new Date().toISOString();
        const { data: claimedAppointment, error: claimError } = await supabase
          .from("appointments")
          .update({
            reminder_sent: true,
            reminder_sent_at: claimedAt,
            updated_at: claimedAt,
          })
          .eq("id", apt.id)
          .eq("reminder_sent", false)
          .select("id")
          .maybeSingle();

        if (claimError || !claimedAppointment) {
          console.log(`[skip] reminder already claimed or sent for appointment ${apt.id}`, claimError?.message || "");
          continue;
        }

        // Envio via provedor (Evolution/WAHA) com retorno de chatId e status
        const sendResult = await sendReminderMessage(supabase, userId, apt.phone, message);
        console.log(
          `[reminder] apt=${apt.id} user=${userId} phone=${apt.phone} ` +
            `result=${sendResult.ok ? "sent" : `error:${sendResult.status ?? "unknown"}`} ` +
            `chatId=${sendResult.waChatId ?? "null"}` +
            (sendResult.ok ? "" : ` err=${(sendResult.error || "").slice(0, 200)}`),
        );
        if (!sendResult.ok) {
          await supabase
            .from("appointments")
            .update({
              reminder_sent: false,
              reminder_sent_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", apt.id)
            .eq("reminder_sent_at", claimedAt);
          console.error(`[reminder] claim released for appointment ${apt.id}`);
          continue;
        }

        // Upsert da conversa (cria se não existir) para o lembrete aparecer no painel
        await saveMessageToConversation(
          supabase,
          userId,
          apt.account_id,
          apt.phone,
          apt.contact_name || apt.title || null,
          message,
          sendResult.waChatId ?? null,
        );

        // *** CRITICAL: Activate AI for this conversation so the AI handles the client response ***
        // 1. Ensure ai_active is true on the conversation
        await supabase
          .from("whatsapp_conversations")
          .update({ 
            ai_active: true, 
            updated_at: new Date().toISOString() 
          })
          .eq("user_id", userId)
          .eq("phone", apt.phone);

        // 2. Reset/activate the AI session so the AI can process the client's response
        //    Reset messages_without_human to 0 so it doesn't hit the limit
        await supabase
          .from("whatsapp_ai_sessions")
          .upsert({
            user_id: userId,
            phone: apt.phone,
            status: "active",
            messages_without_human: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,phone" });

        totalSent++;
      }
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface ReminderSendResult {
  ok: boolean;
  status?: number;
  waChatId?: string | null;
  error?: string;
}

async function sendReminderMessage(
  supabase: any,
  userId: string,
  phone: string,
  message: string,
): Promise<ReminderSendResult> {
  try {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status, provider")
      .eq("user_id", userId)
      .in("status", ["connected", "open"])
      .maybeSingle();

    if (!instance) {
      return { ok: false, error: "no-connected-instance" };
    }

    // Roteia por provedor via camada de abstração (funciona para WAHA e Evolution).
    if (instance.provider === "waha") {
      const ctx = await resolveInstanceContext(supabase, { instanceId: instance.id });
      if (!ctx) return { ok: false, error: "waha-context-not-resolved" };
      const r = await sendWhatsAppText(ctx, phone, message);
      if (!r.ok) {
        return {
          ok: false,
          status: r.status,
          error: JSON.stringify(r.errorPayload || {}).slice(0, 400),
        };
      }
      return { ok: true, status: r.status, waChatId: r.waChatId ?? null };
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return { ok: false, error: "evolution-not-configured" };
    }

    const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404 && errorText.toLowerCase().includes("instance") && errorText.toLowerCase().includes("does not exist")) {
        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected", updated_at: new Date().toISOString() })
          .eq("id", instance.id);
      }
      return { ok: false, status: response.status, error: errorText.slice(0, 400) };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message || "unknown" };
  }
}

async function saveMessageToConversation(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  contactName: string | null,
  content: string,
  waChatId: string | null,
) {
  const nowIso = new Date().toISOString();
  const newMessage = {
    id: crypto.randomUUID(),
    timestamp: nowIso,
    from_me: true,
    content,
    type: "text",
    sent_by: "ai",
  };

  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id, messages, wa_chat_id")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (conversation) {
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const updated = [...messages, newMessage];
    const patch: Record<string, any> = {
      messages: updated,
      last_message_at: nowIso,
      total_messages: updated.length,
      updated_at: nowIso,
      ai_active: true,
    };
    if (!conversation.wa_chat_id && waChatId) patch.wa_chat_id = waChatId;
    await supabase.from("whatsapp_conversations").update(patch).eq("id", conversation.id);
    return;
  }

  // Cria a conversa (lead novo do agendamento) para o lembrete aparecer no painel.
  const insertPayload: Record<string, any> = {
    user_id: userId,
    account_id: accountId,
    phone,
    contact_name: contactName,
    messages: [newMessage],
    total_messages: 1,
    last_message_at: nowIso,
    ai_active: true,
  };
  if (waChatId) insertPayload.wa_chat_id = waChatId;

  const { error: insertErr } = await supabase
    .from("whatsapp_conversations")
    .insert(insertPayload);
  if (insertErr) {
    console.error(`[reminder] failed to create conversation for ${phone}:`, insertErr.message);
  }
}
