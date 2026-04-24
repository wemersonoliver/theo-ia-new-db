import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone, getBrazilianPhoneVariant } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Envia lembretes para tarefas do CRM 5 minutos antes do horário.
 * - Usa a instância do WhatsApp do Theo IA (suporte / system_whatsapp_instance).
 * - Notifica o usuário responsável (assigned_to ou user_id criador) usando o
 *   telefone do perfil (profiles.phone).
 * - Marca reminder_sent = true para evitar reenvio.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve a instância de suporte (Theo IA)
    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .maybeSingle();

    if (!sysInstance || sysInstance.status !== "connected") {
      return new Response(
        JSON.stringify({ error: "WhatsApp do sistema (Theo IA) não está conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const instanceName = sysInstance.instance_name;

    // Janela: tarefas com due_date entre agora e 5 minutos no futuro,
    // que ainda não foram lembradas e não estão concluídas.
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);

    const { data: tasks, error: tasksErr } = await supabase
      .from("crm_deal_tasks")
      .select("id, title, description, due_date, assigned_to, user_id, deal_id")
      .eq("reminder_sent", false)
      .eq("completed", false)
      .not("due_date", "is", null)
      .lte("due_date", windowEnd.toISOString())
      .gte("due_date", now.toISOString())
      .limit(200);

    if (tasksErr) throw tasksErr;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const errors: Array<{ task_id: string; error: string }> = [];

    for (const task of tasks) {
      try {
        // Destinatário: prefere assigned_to (responsável), senão user_id (criador)
        const ownerId = task.assigned_to || task.user_id;
        if (!ownerId) {
          errors.push({ task_id: task.id, error: "Sem responsável" });
          continue;
        }

        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("phone, full_name")
          .eq("user_id", ownerId)
          .maybeSingle();

        if (!ownerProfile?.phone) {
          errors.push({ task_id: task.id, error: "Responsável sem telefone" });
          // marca como enviado mesmo assim para não tentar todo minuto
          await supabase
            .from("crm_deal_tasks")
            .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
            .eq("id", task.id);
          continue;
        }

        // Busca dados do negócio para enriquecer a mensagem
        let dealTitle = "";
        if (task.deal_id) {
          const { data: deal } = await supabase
            .from("crm_deals")
            .select("title")
            .eq("id", task.deal_id)
            .maybeSingle();
          dealTitle = deal?.title || "";
        }

        const due = new Date(task.due_date);
        const horaFmt = due.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });

        const firstName = (ownerProfile.full_name || "").split(/\s+/)[0] || "";
        const greeting = firstName ? `Olá ${firstName}!` : "Olá!";

        const lines: string[] = [];
        lines.push("⏰ *Lembrete de tarefa*");
        lines.push("");
        lines.push(`${greeting} Sua tarefa está prestes a começar:`);
        lines.push("");
        lines.push(`📌 *${task.title}*`);
        if (dealTitle) lines.push(`💼 Negócio: ${dealTitle}`);
        lines.push(`🕒 Horário: ${horaFmt}`);
        if (task.description) {
          lines.push("");
          lines.push(`📝 ${task.description}`);
        }
        lines.push("");
        lines.push("_Faltam aproximadamente 5 minutos._");

        const message = lines.join("\n");

        // Normaliza telefone e tenta enviar (com fallback de variante)
        const normalized = normalizeBrazilianPhone(ownerProfile.phone);
        const candidates = [normalized];
        const variant = getBrazilianPhoneVariant(normalized);
        if (variant && variant !== normalized) candidates.push(variant);

        let success = false;
        let lastErr = "";
        for (const candidate of candidates) {
          const resp = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({ number: candidate, text: message }),
          });
          if (resp.ok) {
            success = true;
            break;
          }
          lastErr = await resp.text().catch(() => "");
        }

        if (!success) {
          errors.push({ task_id: task.id, error: `Evolution: ${lastErr}` });
          continue;
        }

        await supabase
          .from("crm_deal_tasks")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        sent++;
        console.log(`Lembrete enviado para tarefa ${task.id} (${task.title}) -> ${normalized}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ task_id: task.id, error: msg });
        console.error(`Erro ao enviar lembrete da tarefa ${task.id}:`, msg);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total_candidates: tasks.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-task-reminders error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});