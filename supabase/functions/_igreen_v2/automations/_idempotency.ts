// D15 — toda automação é idempotente.
//
// Helpers para garantir que uma automação não execute duas vezes:
//   - alreadyExecuted(key) → checa registro em igreen_automation_executions
//   - recordExecution(key, ...) → grava com UNIQUE (idempotency_key)
//   - withIdempotency(key, fn) → wrapper que combina os dois
//
// Convenção de chave: "{automation}:{account_id}:{phone}:{ref}"

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AutomationResult } from "../types.ts";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

export async function alreadyExecuted(idempotency_key: string): Promise<boolean> {
  const { data } = await svc()
    .from("igreen_automation_executions")
    .select("id")
    .eq("idempotency_key", idempotency_key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

export async function recordExecution(args: {
  account_id: string;
  phone?: string | null;
  automation: string;
  idempotency_key: string;
  result?: Record<string, unknown>;
  ttl_days?: number;
}): Promise<{ recorded: boolean; conflict?: boolean }> {
  const ttl = args.ttl_days ?? 30;
  const expires_at = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await svc().from("igreen_automation_executions").insert({
    account_id: args.account_id,
    phone: args.phone ?? null,
    automation: args.automation,
    idempotency_key: args.idempotency_key,
    result: args.result ?? {},
    expires_at,
  });
  if (error) {
    // 23505 = unique_violation → outra execução ganhou a corrida
    if ((error as { code?: string }).code === "23505") {
      return { recorded: false, conflict: true };
    }
    console.error("[idempotency] recordExecution error", error);
    return { recorded: false };
  }
  return { recorded: true };
}

/**
 * Executa `fn` somente se `idempotency_key` ainda não foi executado.
 * Em caso de race condition (duas execuções simultâneas), apenas uma vence.
 */
export async function withIdempotency(
  args: {
    account_id: string;
    phone?: string | null;
    automation: string;
    idempotency_key: string;
    ttl_days?: number;
  },
  fn: () => Promise<AutomationResult>,
): Promise<AutomationResult> {
  if (await alreadyExecuted(args.idempotency_key)) {
    return { skipped: true, reason: "already_executed" };
  }
  // Reserva o slot ANTES de executar para vencer races.
  const reserve = await recordExecution({
    account_id: args.account_id,
    phone: args.phone,
    automation: args.automation,
    idempotency_key: args.idempotency_key,
    result: { status: "running" },
    ttl_days: args.ttl_days,
  });
  if (reserve.conflict) return { skipped: true, reason: "race_lost" };
  if (!reserve.recorded) return { skipped: true, reason: "reserve_failed" };

  try {
    const result = await fn();
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}