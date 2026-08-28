import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveInstanceContext, sendWhatsAppText } from "../_wa_provider.ts";
import { requireInternalKey } from "../_cron_auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const API_LABELS: Record<string, string> = {
  evolution_api: "Evolution API (WhatsApp)",
  gemini: "Google Gemini (IA)",
  groq: "Groq (Transcrição)",
  elevenlabs: "ElevenLabs (Voz)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Server-to-server only — block public callers from spamming admin WhatsApp.
  const authErr = requireInternalKey(req);
  if (authErr) return authErr;

  try {
    const { api_name, kind, error_message, consecutive_failures } = await req.json();
    if (!api_name) {
      return new Response(JSON.stringify({ error: "api_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pega instância de WhatsApp do sistema (roteada pelo provedor real)
    const ctx = await resolveInstanceContext(supabase, { system: true });

    if (!ctx || ctx.status !== "connected") {
      console.warn("[notify-api-failure] System WhatsApp not connected, skipping");
      return new Response(JSON.stringify({ ok: false, reason: "system_wa_disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos super_admins com phone preenchido
    const { data: superAdmins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    const ids = (superAdmins || []).map((r) => r.user_id);

    const normalize = (raw: string) => {
      const digits = raw.replace(/\D/g, "");
      return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    };

    const recipientsMap = new Map<string, { phone: string; name: string }>();

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", ids);

      (profiles || [])
        .filter((p) => p.phone && p.phone.replace(/\D/g, "").length >= 10)
        .forEach((p) => {
          const phone = normalize(p.phone!);
          recipientsMap.set(phone, { phone, name: p.full_name || "" });
        });
    }

    // Também envia para contatos ativos cadastrados no painel Admin → Notificações
    const { data: adminContacts } = await supabase
      .from("admin_notification_contacts")
      .select("phone, name, active")
      .eq("active", true);

    (adminContacts || [])
      .filter((c) => c.phone && c.phone.replace(/\D/g, "").length >= 10)
      .forEach((c) => {
        const phone = normalize(c.phone);
        if (!recipientsMap.has(phone)) {
          recipientsMap.set(phone, { phone, name: c.name || "" });
        }
      });

    const recipients = Array.from(recipientsMap.values());

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "no_phones" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const apiLabel = API_LABELS[api_name] || api_name;
    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    let text: string;
    if (kind === "recovery") {
      text =
        `✅ *API RESTABELECIDA - Theo IA*\n\n` +
        `🟢 *${apiLabel}* voltou a responder normalmente.\n\n` +
        `🕐 ${timestamp}`;
    } else {
      text =
        `🚨 *ALERTA CRÍTICO - Theo IA* 🚨\n\n` +
        `❌ *${apiLabel}* não está respondendo.\n` +
        `🔁 Falhas consecutivas: ${consecutive_failures ?? 1}\n\n` +
        `📋 *Erro:*\n${(error_message || "Sem detalhes").slice(0, 300)}\n\n` +
        `⚠️ Verifique imediatamente:\n` +
        `• Status do pagamento da API\n` +
        `• Logs no painel administrativo\n` +
        `• Conectividade com o provedor\n\n` +
        `🕐 ${timestamp}\n\n` +
        `_Próximo lembrete em 15 min se não for resolvido._`;
    }

    let sent = 0;
    for (const r of recipients) {
      try {
        const res = await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: `/message/sendText/${instance.instance_name}`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: r.phone, text }),
        });
        if (res.ok) sent++;
        else console.error(`[notify-api-failure] failed for ${r.phone}:`, res.text?.slice(0, 200));
      } catch (e) {
        console.error(`[notify-api-failure] exception for ${r.phone}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-api-failure] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});