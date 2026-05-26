// Phase 5 — Token budget enforcement por turno e por dia.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export interface AccountLimits {
  account_id: string;
  daily_input_tokens: number;
  daily_output_tokens: number;
  per_turn_input_tokens: number;
  per_turn_output_tokens: number;
  context_total_budget: number;
}

const DEFAULTS: Omit<AccountLimits, "account_id"> = {
  daily_input_tokens: 400_000,
  daily_output_tokens: 80_000,
  per_turn_input_tokens: 6_000,
  per_turn_output_tokens: 1_200,
  context_total_budget: 8_000,
};

export async function getLimits(account_id: string): Promise<AccountLimits> {
  try {
    const { data } = await svc()
      .from("igreen_account_limits")
      .select("*")
      .eq("account_id", account_id)
      .maybeSingle();
    if (data) return data as AccountLimits;
  } catch (e) {
    console.error("[token-budget] getLimits failed", e);
  }
  return { account_id, ...DEFAULTS };
}

export async function getDailyUsage(account_id: string): Promise<{ input: number; output: number }> {
  try {
    const { data } = await svc()
      .from("igreen_token_usage")
      .select("input_tokens,output_tokens")
      .eq("account_id", account_id)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    let i = 0, o = 0;
    for (const r of data ?? []) {
      i += (r as any).input_tokens ?? 0;
      o += (r as any).output_tokens ?? 0;
    }
    return { input: i, output: o };
  } catch {
    return { input: 0, output: 0 };
  }
}

export class TokenBudgetError extends Error {
  constructor(public kind: "per_turn" | "daily", public detail: string) {
    super(`token-budget:${kind}:${detail}`);
    this.name = "TokenBudgetError";
  }
}

export async function checkBudget(args: {
  account_id: string;
  estimated_input: number;
  estimated_output: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const limits = await getLimits(args.account_id);
  if (args.estimated_input > limits.per_turn_input_tokens) {
    return { ok: false, reason: `per_turn_input>${limits.per_turn_input_tokens}` };
  }
  if (args.estimated_output > limits.per_turn_output_tokens) {
    return { ok: false, reason: `per_turn_output>${limits.per_turn_output_tokens}` };
  }
  const usage = await getDailyUsage(args.account_id);
  if (usage.input + args.estimated_input > limits.daily_input_tokens) {
    return { ok: false, reason: `daily_input>${limits.daily_input_tokens}` };
  }
  if (usage.output + args.estimated_output > limits.daily_output_tokens) {
    return { ok: false, reason: `daily_output>${limits.daily_output_tokens}` };
  }
  return { ok: true };
}

export async function recordUsage(args: {
  account_id: string;
  correlation_id?: string | null;
  phone?: string | null;
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd?: number;
}) {
  try {
    await svc().from("igreen_token_usage").insert({
      account_id: args.account_id,
      correlation_id: args.correlation_id ?? null,
      phone: args.phone ?? null,
      model: args.model ?? null,
      input_tokens: args.input_tokens,
      output_tokens: args.output_tokens,
      cost_usd: args.cost_usd ?? 0,
    });
  } catch (e) {
    console.error("[token-budget] recordUsage failed", e);
  }
}

// Estimativa naive: ~4 chars por token (PT-BR aproximado).
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}