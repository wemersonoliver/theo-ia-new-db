import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, phone, full_name } = body || {};
    if (!user_id || !phone) {
      return new Response(JSON.stringify({ error: "user_id and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read config
    const { data: cfg } = await supabase
      .from("system_ai_config")
      .select("welcome_sequence_enabled, welcome_delay_minutes")
      .limit(1)
      .maybeSingle();

    if (cfg && cfg.welcome_sequence_enabled === false) {
      return new Response(JSON.stringify({ skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const delayMin = cfg?.welcome_delay_minutes ?? 3;
    const scheduledAt = new Date(Date.now() + delayMin * 60_000).toISOString();
    const normalized = normalizePhone(phone);

    const { error } = await supabase.from("system_welcome_queue").insert({
      user_id,
      phone: normalized,
      full_name: full_name || null,
      scheduled_at: scheduledAt,
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, scheduled_at: scheduledAt, phone: normalized }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("schedule-welcome-message error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
