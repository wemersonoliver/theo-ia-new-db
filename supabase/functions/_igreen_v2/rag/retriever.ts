// Phase 5 — RAG retriever (pgvector cosine, threshold ≥0.78).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed } from "./embedding-worker.ts";
import { hashQuery, getCached, setCached } from "./cache.ts";
import { withTimeout, DEFAULT_TIMEOUTS } from "../cost-governor/timeout-orchestrator.ts";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export interface RetrievedChunk {
  id: string;
  content: string;
  source_id: string;
  score: number;
  token_count: number;
}

export const SIMILARITY_THRESHOLD = 0.78;

export async function retrieve(args: {
  query: string;
  account_id: string;
  correlation_id: string;
  topK?: number;
  threshold?: number;
}): Promise<{ chunks: RetrievedChunk[]; cache_hit: boolean; latency_ms: number; query_hash: string }> {
  const t0 = Date.now();
  const k = args.topK ?? 5;
  const th = args.threshold ?? SIMILARITY_THRESHOLD;
  const query_hash = await hashQuery(args.query, args.account_id);

  const cached = await getCached(query_hash);
  if (cached) {
    const chunks = (cached.result as RetrievedChunk[]) ?? [];
    await recordTrace({ correlation_id: args.correlation_id, account_id: args.account_id, query: args.query, query_hash, cache_hit: true, chunks_returned: chunks.length, top_score: chunks[0]?.score, latency_ms: Date.now() - t0 });
    return { chunks, cache_hit: true, latency_ms: Date.now() - t0, query_hash };
  }

  let chunks: RetrievedChunk[] = [];
  try {
    const result = await withTimeout("rag.retrieve", DEFAULT_TIMEOUTS.ragMs, async () => {
      const v = await embed(args.query);
      if (!v) return [] as RetrievedChunk[];
      // pgvector: use rpc-less raw query via PostgREST is awkward; use a custom view-less SQL via .rpc not defined.
      // Fallback: filtra por account_id e calcula similaridade no servidor via SQL function se existir,
      // ou retorna vazio. Para Fase 5 v2 inicial, retornamos vazio se sem rpc.
      const { data, error } = await svc().rpc("match_igreen_chunks", {
        query_embedding: v,
        match_threshold: th,
        match_count: k,
        p_account_id: args.account_id,
      });
      if (error) {
        console.warn("[rag:retriever] match_igreen_chunks rpc missing or failed:", error.message);
        return [] as RetrievedChunk[];
      }
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        content: String(r.content),
        source_id: String(r.source_id),
        score: Number(r.similarity ?? 0),
        token_count: Number(r.token_count ?? 0),
      }));
    });
    chunks = result;
  } catch (e) {
    console.error("[rag:retriever] timeout/error", e);
    chunks = [];
  }

  await setCached({ query_hash, account_id: args.account_id, query_preview: args.query.slice(0, 200), result: chunks });
  await recordTrace({ correlation_id: args.correlation_id, account_id: args.account_id, query: args.query, query_hash, cache_hit: false, chunks_returned: chunks.length, top_score: chunks[0]?.score, latency_ms: Date.now() - t0 });
  return { chunks, cache_hit: false, latency_ms: Date.now() - t0, query_hash };
}

async function recordTrace(args: {
  correlation_id: string;
  account_id: string;
  query: string;
  query_hash: string;
  cache_hit: boolean;
  chunks_returned: number;
  top_score?: number;
  latency_ms: number;
}) {
  try {
    await svc().from("igreen_rag_traces").insert({
      correlation_id: args.correlation_id,
      account_id: args.account_id,
      query: args.query.slice(0, 500),
      query_hash: args.query_hash,
      cache_hit: args.cache_hit,
      chunks_returned: args.chunks_returned,
      top_score: args.top_score ?? null,
      latency_ms: args.latency_ms,
    });
  } catch (e) {
    console.error("[rag:retriever] trace failed", e);
  }
}