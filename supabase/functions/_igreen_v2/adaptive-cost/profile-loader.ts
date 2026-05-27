import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { CostProfile } from "../model-router/selector.ts";

const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export interface ProfileConfig {
  profile: CostProfile;
  rag_top_k: number; rag_threshold: number; max_retries: number;
  daily_budget_cents?: number | null;
}
const DEFAULTS: Record<CostProfile, Omit<ProfileConfig, "profile" | "daily_budget_cents">> = {
  balanced: { rag_top_k: 5, rag_threshold: 0.78, max_retries: 3 },
  economy: { rag_top_k: 2, rag_threshold: 0.85, max_retries: 1 },
  performance: { rag_top_k: 8, rag_threshold: 0.72, max_retries: 3 },
};
export async function loadProfile(account_id: string): Promise<ProfileConfig> {
  const { data } = await supa().from("igreen_cost_profiles").select("*").eq("account_id", account_id).maybeSingle();
  const profile = (data?.profile as CostProfile) ?? "balanced";
  const base = DEFAULTS[profile];
  const ov = (data?.overrides ?? {}) as Partial<ProfileConfig>;
  return {
    profile,
    rag_top_k: ov.rag_top_k ?? base.rag_top_k,
    rag_threshold: ov.rag_threshold ?? base.rag_threshold,
    max_retries: ov.max_retries ?? base.max_retries,
    daily_budget_cents: data?.daily_budget_cents ?? null,
  };
}
