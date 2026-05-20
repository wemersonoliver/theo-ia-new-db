import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULTS = [
  { key: "CENARIO1", name: "Cenário 1" },
  { key: "CENARIO2", name: "Cenário 2" },
  { key: "CENARIO3", name: "Cenário 3" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria os 3 cenários (idempotente via UNIQUE account_id+scenario_key)
    const rows = DEFAULTS.map((d) => ({
      account_id,
      scenario_key: d.key,
      name: d.name,
      enabled: true,
    }));
    await supabase.from("igreen_scenarios").upsert(rows, {
      onConflict: "account_id,scenario_key",
      ignoreDuplicates: true,
    });

    return new Response(JSON.stringify({ ok: true, scenarios: DEFAULTS.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});