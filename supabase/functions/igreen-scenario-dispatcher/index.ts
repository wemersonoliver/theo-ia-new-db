import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stub: dispatcher de cenários Igreen.
// Próxima iteração: ler igreen_scenario_enrollments com next_run_at <= now,
// montar a sequência de itens da mensagem (manhã/tarde) respeitando delays,
// enviar via Evolution API e agendar próximo período/dia.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ ok: true, todo: "implementar envio" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});