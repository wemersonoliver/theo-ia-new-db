// One-shot admin util: força as sessões WAHA a assinar o evento "message.any"
// (que inclui mensagens enviadas pelo próprio aparelho — fromMe=true).
// Sem isso, o WAHA envia apenas "message" (incoming), então mensagens digitadas
// no celular do dono do número não chegam ao webhook e a IA não é pausada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeWahaUrl, wahaSessionUpdate } from "../_waha.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const wahaUrl = normalizeWahaUrl(Deno.env.get("WAHA_API_URL"));
    const wahaKey = Deno.env.get("WAHA_API_KEY");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;

    if (!wahaUrl || !wahaKey) {
      return new Response(JSON.stringify({ error: "WAHA_API_URL/KEY não configurados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Coleta todas as sessões WAHA (whatsapp_instances + system)
    const results: any[] = [];

    const { data: userInstances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name")
      .eq("provider", "waha");

    const { data: sysInstances } = await supabase
      .from("system_whatsapp_instance")
      .select("id, instance_name, provider")
      .eq("provider", "waha");

    const sessions = [
      ...(userInstances || []).map((r: any) => ({ scope: "user", name: r.instance_name })),
      ...(sysInstances || []).map((r: any) => ({ scope: "system", name: r.instance_name })),
    ].filter((s) => !!s.name);

    for (const s of sessions) {
      const r = await wahaSessionUpdate({
        wahaUrl,
        wahaKey,
        session: s.name,
        webhookUrl,
        events: ["message.any", "session.status"],
      });
      results.push({ session: s.name, scope: s.scope, ok: r.ok, status: r.status, text: r.text?.slice(0, 200) });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});