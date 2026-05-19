import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_DISPATCH = 20;
const DELAY_BETWEEN_SENDS_MS = 3000;

function withinWindow(config: any, now: Date): boolean {
  // Hora local BR (UTC-3)
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  const brMin = now.getUTCMinutes();
  const cur = brHour * 60 + brMin;
  const toM = (s: string) => {
    const [h, m] = (s || "0:0").split(":").map(Number);
    return h * 60 + m;
  };
  const morn = cur >= toM(config.morning_window_start) && cur <= toM(config.morning_window_end);
  const even = cur >= toM(config.evening_window_start) && cur <= toM(config.evening_window_end);
  return morn || even;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function firstName(full?: string | null): string {
  if (!full) return "tudo bem";
  return full.trim().split(/\s+/)[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "").replace(/\/manager$/i, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const { data: config } = await supabase
      .from("trial_notification_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ sent: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!withinWindow(config, new Date())) {
      return new Response(JSON.stringify({ sent: 0, reason: "outside_window" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ sent: 0, reason: "not_connected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: due } = await supabase
      .from("trial_notification_messages")
      .select("*")
      .is("sent_at", null)
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_DISPATCH);

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;
    let isFirst = true;

    // Plano recomendado para checkout (pro mensal)
    const { data: plan } = await supabase
      .from("plans")
      .select("checkout_url")
      .eq("is_active", true)
      .eq("tier", "pro")
      .eq("billing_period", "monthly")
      .maybeSingle();
    const checkoutBase = plan?.checkout_url || "https://theoia.com.br/whatsapp";

    for (const msg of due) {
      try {
        // Throttle: 3s entre envios para evitar bloqueio do WhatsApp
        if (!isFirst) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
        }
        isFirst = false;

        const { data: tracking } = await supabase
          .from("trial_notification_tracking")
          .select("*")
          .eq("id", msg.tracking_id)
          .maybeSingle();

        if (!tracking || tracking.status !== "scheduled") {
          await supabase.from("trial_notification_messages").delete().eq("id", msg.id);
          skipped++;
          continue;
        }

        // Revalida: tem subscription ativa?
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, expires_at")
          .eq("account_id", tracking.account_id)
          .eq("status", "active")
          .maybeSingle();
        if (sub && (!sub.expires_at || new Date(sub.expires_at) > new Date())) {
          await supabase.rpc("cancel_trial_notification", {
            p_account_id: tracking.account_id,
            p_reason: "converted",
          });
          skipped++;
          continue;
        }

        // Render template
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", tracking.owner_user_id)
          .maybeSingle();

        const tplKey = `step_${msg.step}_template` as const;
        const template = (config as any)[tplKey] || "";
        const checkoutUrl = `${checkoutBase}${checkoutBase.includes("?") ? "&" : "?"}email=${encodeURIComponent(profile?.email || "")}`;

        const content = renderTemplate(template, {
          nome: firstName(profile?.full_name),
          business_context: tracking.business_context || "seu negócio",
          link_checkout: checkoutUrl,
          cupom: config.discount_coupon_code,
          desconto: String(config.discount_percent),
        });

        // Composing
        fetch(`${evolutionUrl}/chat/presence/${instance.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: msg.phone, delay: 1800, presence: "composing" }),
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1500));

        const resp = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: msg.phone, text: content }),
        });

        if (!resp.ok) {
          console.error(`[trial-disp] send fail ${msg.phone}:`, await resp.text());
          await supabase
            .from("trial_notification_messages")
            .update({ status: "failed", content })
            .eq("id", msg.id);
          skipped++;
          continue;
        }

        await supabase
          .from("trial_notification_messages")
          .update({ sent_at: new Date().toISOString(), status: "sent", content })
          .eq("id", msg.id);

        // Salva no histórico do sistema
        const { data: conv } = await supabase
          .from("system_whatsapp_conversations")
          .select("id, messages, total_messages")
          .eq("phone", msg.phone)
          .maybeSingle();
        const newMsg = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: true,
          content,
          type: "text",
          sent_by: "trial_notification",
        };
        if (conv) {
          const messages = (conv.messages as any[]) || [];
          await supabase.from("system_whatsapp_conversations").update({
            messages: [...messages, newMsg],
            last_message_at: new Date().toISOString(),
            total_messages: messages.length + 1,
          }).eq("id", conv.id);
        } else {
          await supabase.from("system_whatsapp_conversations").insert({
            phone: msg.phone,
            contact_name: firstName(profile?.full_name),
            messages: [newMsg],
            last_message_at: new Date().toISOString(),
            total_messages: 1,
            ai_active: true,
          });
        }

        // Atualiza tracking
        const { count: remaining } = await supabase
          .from("trial_notification_messages")
          .select("*", { count: "exact", head: true })
          .eq("tracking_id", msg.tracking_id)
          .is("sent_at", null);

        const update: any = {
          current_step: msg.step,
          last_sent_at: new Date().toISOString(),
        };
        if (!remaining || remaining === 0) {
          update.status = "exhausted";
          update.next_scheduled_at = null;
        } else {
          const { data: next } = await supabase
            .from("trial_notification_messages")
            .select("scheduled_at")
            .eq("tracking_id", msg.tracking_id)
            .is("sent_at", null)
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (next) update.next_scheduled_at = next.scheduled_at;
        }
        await supabase.from("trial_notification_tracking").update(update).eq("id", msg.tracking_id);

        sent++;
        console.log(`[trial-disp] step ${msg.step} → ${msg.phone}`);
      } catch (e) {
        console.error("dispatch loop err:", e);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trial-notification-dispatch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});