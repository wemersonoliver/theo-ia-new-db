// Phase 5 — RAG ingest. Recebe documents+metadata, chunka e gera embeddings.
// Acesso: service_role only (chamado por jobs internos).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed } from "../_igreen_v2/rag/embedding-worker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 200;

function chunk(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const out: string[] = [];
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return out;
  let i = 0;
  while (i < t.length) {
    out.push(t.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, source_id, content, metadata } = body as {
      account_id?: string;
      source_id: string;
      content: string;
      metadata?: Record<string, unknown>;
    };
    if (!source_id || !content) {
      return new Response(JSON.stringify({ ok: false, error: "source_id+content required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const chunks = chunk(content);
    let inserted = 0;
    let embedded = 0;
    for (let i = 0; i < chunks.length; i++) {
      const v = await embed(chunks[i]);
      if (v) embedded++;
      const { error } = await svc.from("igreen_knowledge_chunks").insert({
        account_id: account_id ?? null,
        source_id,
        chunk_index: i,
        content: chunks[i],
        embedding: v as unknown as number[] | null,
        token_count: Math.ceil(chunks[i].length / 4),
        metadata: metadata ?? {},
      });
      if (!error) inserted++;
    }
    return new Response(JSON.stringify({ ok: true, chunks: chunks.length, inserted, embedded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rag-ingest] error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});