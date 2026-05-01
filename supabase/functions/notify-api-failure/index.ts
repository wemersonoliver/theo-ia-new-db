import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_LABELS: Record<string, string> = {
  evolution_api: "Evolution API (WhatsApp)",
  gemini: "Google Gemini (IA)",
  groq: "Groq (Transcrição)",
  elevenlabs: "ElevenLabs (Voz)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // Pega instância de WhatsApp do sistema
    const { data: instance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .maybeSingle();

    if (!instance || instance.status !== "connected") {
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
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "no_super_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", ids);

    const recipients = (profiles || [])
      .filter((p) => p.phone && p.phone.replace(/\D/g, "").length >= 10)
      .map((p) => {
        const digits = p.phone!.replace(/\D/g, "");
        // Normaliza para formato internacional (prefixa 55 se 10/11 dígitos)
        const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
        return { phone: normalized, name: p.full_name || "" };
      });

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "no_phones" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      console.error("[notify-api-failure] Evolution API not configured");
      return new Response(JSON.stringify({ ok: false, reason: "evolution_not_configured" }), {
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