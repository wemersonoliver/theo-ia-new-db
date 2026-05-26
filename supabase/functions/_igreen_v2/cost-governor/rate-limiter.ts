// Phase 5 — Rate limiter token-bucket Postgres-only (sem Redis).
// Atômico via UPDATE ... RETURNING + INSERT ... ON CONFLICT DO UPDATE.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export interface RateCheckArgs {
  key: string;            // e.g. "phone:5547..." or "acct:uuid"
  capacity: number;       // max tokens
  refillPerSec: number;   // tokens per second
  scope?: "phone" | "account";
  cost?: number;
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retry_after_ms?: number;
}

/**
 * Token-bucket atômico. Faz upsert calculando refill e consumindo `cost` tokens
 * em uma única chamada SQL (via supabase rpc fallback se necessário). Como não
 * temos rpc dedicado, usamos um UPDATE com RETURNING + retry-once em caso de
 * conflito de row inexistente.
 */
export async function consumeRate(args: RateCheckArgs): Promise<RateResult> {
  const cost = args.cost ?? 1;
  const now = new Date().toISOString();

  // 1. Tenta upsert criando linha se não existir.
  await svc().from("igreen_rate_buckets").upsert({
    bucket_key: args.key,
    tokens: args.capacity,
    capacity: args.capacity,
    refill_rate: args.refillPerSec,
    last_refill_at: now,
    scope: args.scope ?? "phone",
  }, { onConflict: "bucket_key", ignoreDuplicates: true });

  // 2. Faz leitura + cálculo + update condicional.
  // Como não temos transações na API JS, fazemos compare-and-swap.
  for (let i = 0; i < 5; i++) {
    const { data: row } = await svc()
      .from("igreen_rate_buckets")
      .select("tokens,capacity,refill_rate,last_refill_at")
      .eq("bucket_key", args.key)
      .maybeSingle();
    if (!row) {
      // Retry seed
      await svc().from("igreen_rate_buckets").upsert({
        bucket_key: args.key,
        tokens: args.capacity,
        capacity: args.capacity,
        refill_rate: args.refillPerSec,
        last_refill_at: now,
        scope: args.scope ?? "phone",
      });
      continue;
    }
    const r = row as { tokens: number; capacity: number; refill_rate: number; last_refill_at: string };
    const elapsed = (Date.now() - new Date(r.last_refill_at).getTime()) / 1000;
    const refilled = Math.min(r.capacity, r.tokens + elapsed * r.refill_rate);
    if (refilled < cost) {
      const need = cost - refilled;
      const retry = Math.ceil((need / Math.max(r.refill_rate, 0.0001)) * 1000);
      return { allowed: false, remaining: refilled, retry_after_ms: retry };
    }
    const newTokens = refilled - cost;
    // Compare-and-swap: só atualiza se tokens ainda for o antigo.
    const { data: updated, error } = await svc()
      .from("igreen_rate_buckets")
      .update({
        tokens: newTokens,
        last_refill_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("bucket_key", args.key)
      .eq("last_refill_at", r.last_refill_at)
      .select("tokens")
      .maybeSingle();
    if (!error && updated) {
      return { allowed: true, remaining: (updated as { tokens: number }).tokens };
    }
    // race lost — retry
  }
  // Fallback conservador: nega
  return { allowed: false, remaining: 0, retry_after_ms: 1000 };
}

export async function checkPhoneRate(account_id: string, phone: string, perMin = 8): Promise<RateResult> {
  return consumeRate({
    key: `phone:${account_id}:${phone}`,
    capacity: perMin,
    refillPerSec: perMin / 60,
    scope: "phone",
  });
}

export async function checkAccountRate(account_id: string, perMin = 120): Promise<RateResult> {
  return consumeRate({
    key: `acct:${account_id}`,
    capacity: perMin,
    refillPerSec: perMin / 60,
    scope: "account",
  });
}