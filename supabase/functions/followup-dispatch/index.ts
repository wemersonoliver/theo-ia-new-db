import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isWithinWindow, generateScheduleSequence } from "../_followup-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DISPATCH_PER_RUN = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const { data: due, error } = await supabase
      .from("followup_messages")
      .select("*")
      .is("sent_at", null)
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_DISPATCH_PER_RUN);

    if (error) throw error;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const msg of due) {
      try {
        // Re-check tracking (pode ter sido cancelado)
        const { data: tracking } = await supabase
          .from("followup_tracking")
          .select("status, ai_active:user_id")
          .eq("id", msg.tracking_id)
          .maybeSingle();

        if (!tracking || tracking.status !== "scheduled") {
          // Tracking cancelado/exausto — apaga a mensagem
          await supabase.from("followup_messages").delete().eq("id", msg.id);
          skipped++;
          continue;
        }

        // Carrega config para validar janela e ai_active
        const { data: config } = await supabase
          .from("followup_config")
          .select("*")
          .eq("user_id", msg.user_id)
          .maybeSingle();

        if (!config || !config.enabled) {
          await supabase.from("followup_messages").delete().eq("id", msg.id);
          skipped++;
          continue;
        }

        // Verifica janela
        if (!isWithinWindow(config)) {
          // Empurra para o próximo slot válido
          const next = generateScheduleSequence(config, 1)[0];
          await supabase.from("followup_messages").update({ scheduled_at: next }).eq("id", msg.id);
          skipped++;
          continue;
        }

        // Verifica ai_active na conversa
        const { data: conversation } = await supabase
          .from("whatsapp_conversations")
          .select("ai_active, messages")
          .eq("user_id", msg.user_id)
          .eq("phone", msg.phone)
          .maybeSingle();

        if (!conversation || (config.exclude_handoff && conversation.ai_active === false)) {
          // Cancela toda a sequência
          await supabase.rpc("cancel_followup_sequence", {
            p_user_id: msg.user_id,
            p_phone: msg.phone,
            p_reason: "handoff",
          });
          skipped++;
          continue;
        }

        // Carrega instância WhatsApp
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("instance_name, status")
          .eq("user_id", msg.user_id)
          .maybeSingle();

        if (!instance || instance.status !== "connected") {
          skipped++;
          continue;
        }

        // Composing fire-and-forget
        const composingDelay = 1500 + Math.random() * 1500;
        fetch(`${evolutionUrl}/chat/presence/${instance.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: msg.phone, delay: Math.floor(composingDelay), presence: "composing" }),
        }).catch(() => {});

        await new Promise((r) => setTimeout(r, Math.min(composingDelay, 1500)));

        const sendResp = await fetch(
          `${evolutionUrl}/message/sendText/${instance.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({ number: msg.phone, text: msg.content }),
          },
        );

        if (!sendResp.ok) {
          console.error(`Send failed for ${msg.phone}:`, await sendResp.text());
          await supabase.from("followup_messages").update({ status: "failed" }).eq("id", msg.id);
          skipped++;
          continue;
        }

        // Marca como enviada
        await supabase.from("followup_messages")
          .update({ sent_at: new Date().toISOString(), status: "sent" })
          .eq("id", msg.id);

        // Persiste na conversa
        const messages = (conversation.messages as any[]) || [];
        const followupMsg = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: true,
          content: msg.content,
          type: "text",
          sent_by: "followup_ai",
        };
        await supabase.from("whatsapp_conversations")
          .update({
            messages: [...messages, followupMsg],
            last_message_at: new Date().toISOString(),
            total_messages: messages.length + 1,
          })
          .eq("user_id", msg.user_id)
          .eq("phone", msg.phone);

        // Atualiza tracking
        const { count: remaining } = await supabase
          .from("followup_messages")
          .select("*", { count: "exact", head: true })
          .eq("tracking_id", msg.tracking_id)
          .is("sent_at", null);

        const trackingUpdate: any = {
          current_step: msg.step,
          last_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!remaining || remaining === 0) {
          trackingUpdate.status = "exhausted";
        } else {
          // Próxima mensagem agendada
          const { data: next } = await supabase
            .from("followup_messages")
            .select("scheduled_at")
            .eq("tracking_id", msg.tracking_id)
            .is("sent_at", null)
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (next) trackingUpdate.next_scheduled_at = next.scheduled_at;
        }
        await supabase.from("followup_tracking").update(trackingUpdate).eq("id", msg.tracking_id);

        sent++;
        console.log(`[followup-dispatch] sent step ${msg.step} to ${msg.phone}`);
      } catch (e) {
        console.error(`Dispatch error for msg ${msg.id}:`, e);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("followup-dispatch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
