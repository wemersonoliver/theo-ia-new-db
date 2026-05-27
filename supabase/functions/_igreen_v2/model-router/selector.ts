// Fase 6 — Smart Model Router
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getBreakerState } from "../provider-health/circuit-breaker.ts";
import { detectDegradation } from "../provider-health/degradation-detector.ts";
import { estimateCostCents, estimateSavingsCents } from "./cost-estimator.ts";
import { trace } from "../observability/trace.ts";

const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type TaskType = "simple_confirm" | "small_talk" | "classification" | "summary" | "rag_synthesis" | "objection_handling" | "long_analysis";
export type CostProfile = "balanced" | "economy" | "performance";

const PROVIDER = "google";

const TASK_TO_MODEL: Record<TaskType, string> = {
  simple_confirm: "google/gemini-2.5-flash-lite",
  small_talk: "google/gemini-2.5-flash-lite",
  classification: "google/gemini-2.5-flash-lite",
  summary: "google/gemini-2.5-flash-lite",
  rag_synthesis: "google/gemini-2.5-flash",
  objection_handling: "google/gemini-2.5-pro",
  long_analysis: "google/gemini-2.5-pro",
};

const PROFILE_OVERRIDES: Record<CostProfile, Partial<Record<TaskType, string>>> = {
  balanced: {},
  economy: {
    rag_synthesis: "google/gemini-2.5-flash-lite",
    objection_handling: "google/gemini-2.5-flash",
    long_analysis: "google/gemini-2.5-flash",
  },
  performance: {
    classification: "google/gemini-2.5-flash",
    summary: "google/gemini-2.5-flash",
    rag_synthesis: "google/gemini-2.5-pro",
  },
};

const FALLBACK_CHAIN: Record<string, string> = {
  "google/gemini-2.5-pro": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash": "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
};

export interface RouteDecision {
  selected_model: string;
  task_type: TaskType;
  reason: string;
  escalated_from?: string;
  estimated_cost_cents: number;
  estimated_savings_cents: number;
}

export async function selectModel(opts: {
  account_id: string;
  correlation_id: string;
  phone?: string;
  task_type: TaskType;
  profile?: CostProfile;
  tokens_in_estimate?: number;
  tokens_out_estimate?: number;
  force_model?: string;
}): Promise<RouteDecision> {
  const profile = opts.profile ?? "balanced";
  const tIn = opts.tokens_in_estimate ?? 1500;
  const tOut = opts.tokens_out_estimate ?? 400;

  let selected = opts.force_model ?? PROFILE_OVERRIDES[profile][opts.task_type] ?? TASK_TO_MODEL[opts.task_type];
  let reason = `task=${opts.task_type};profile=${profile}`;
  let escalated_from: string | undefined;

  let guard = 0;
  while (guard < 3) {
    const [state, deg] = await Promise.all([
      getBreakerState(PROVIDER, selected),
      detectDegradation(PROVIDER, selected),
    ]);
    if (state === "open" || deg.degraded) {
      const next = FALLBACK_CHAIN[selected];
      if (next && next !== selected) {
        escalated_from = selected;
        selected = next;
        reason += `;fallback(${state === "open" ? "breaker_open" : deg.reason})`;
        guard++;
        continue;
      }
    }
    break;
  }

  const cost = estimateCostCents(selected, tIn, tOut);
  const savings = estimateSavingsCents("google/gemini-2.5-pro", selected, tIn, tOut);

  const decision: RouteDecision = {
    selected_model: selected,
    task_type: opts.task_type,
    reason,
    escalated_from,
    estimated_cost_cents: cost,
    estimated_savings_cents: savings,
  };

  try {
    await supa().from("igreen_model_routing").insert({
      correlation_id: opts.correlation_id,
      account_id: opts.account_id,
      phone: opts.phone ?? null,
      selected_model: selected,
      task_type: opts.task_type,
      reason,
      escalated_from: escalated_from ?? null,
      estimated_cost_cents: cost,
      estimated_savings_cents: savings,
    });
  } catch (e) { console.error("[model-router] persist failed", e); }

  await trace({
    account_id: opts.account_id,
    phone: opts.phone,
    step: escalated_from ? "model_router.escalated" : "model_router.selected",
    level: "standard",
    payload: decision as any,
    correlation_id: opts.correlation_id,
  });

  return decision;
}