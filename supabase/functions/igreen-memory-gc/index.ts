// Phase 5 — Memory GC. Limpa janela expirada e cache de RAG expirado.
// Pode ser chamado por pg_cron a cada 10 minutos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  let memory = 0, rag = 0, tool = 0;
  try {
    const r1 = await svc.from("igreen_memory_window").delete({ count: "exact" }).lt("expires_at", now);
    memory = r1.count ?? 0;
  } catch (e) { console.error("[memory-gc] window", e); }
  try {
    const r2 = await svc.from("igreen_rag_cache").delete({ count: "exact" }).lt("expires_at", now);
    rag = r2.count ?? 0;
  } catch (e) { console.error("[memory-gc] rag_cache", e); }
  try {
    const r3 = await svc.from("igreen_tool_output_cache").delete({ count: "exact" }).lt("expires_at", now);
    tool = r3.count ?? 0;
  } catch (e) { console.error("[memory-gc] tool_cache", e); }
  return new Response(JSON.stringify({ ok: true, deleted: { memory, rag, tool }, at: now }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});