// Phase 5 — RAG cache (Postgres-only LRU+TTL).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export async function hashQuery(query: string, account_id: string): Promise<string> {
  const enc = new TextEncoder().encode(`${account_id}::${query.trim().toLowerCase()}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCached(query_hash: string): Promise<{ result: unknown; hit_count: number } | null> {
  try {
    const { data } = await svc()
      .from("igreen_rag_cache")
      .select("result,hit_count,expires_at")
      .eq("query_hash", query_hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    // bump hit_count
    await svc().from("igreen_rag_cache").update({ hit_count: ((data as { hit_count: number }).hit_count ?? 0) + 1 }).eq("query_hash", query_hash);
    return { result: (data as { result: unknown }).result, hit_count: (data as { hit_count: number }).hit_count + 1 };
  } catch {
    return null;
  }
}

export async function setCached(args: {
  query_hash: string;
  account_id?: string | null;
  query_preview?: string;
  result: unknown;
  ttl_seconds?: number;
}) {
  const ttl = args.ttl_seconds ?? 3_600;
  try {
    await svc().from("igreen_rag_cache").upsert({
      query_hash: args.query_hash,
      account_id: args.account_id ?? null,
      query_preview: (args.query_preview ?? "").slice(0, 200),
      result: args.result,
      hit_count: 0,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    }, { onConflict: "query_hash" });
  } catch (e) {
    console.error("[rag:cache] set failed", e);
  }
}