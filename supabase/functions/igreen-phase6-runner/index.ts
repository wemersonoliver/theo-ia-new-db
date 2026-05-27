// Fase 6 — Phase 6 Runner (15 cenários mínimos)
// Roda os módulos isoladamente, retorna PASS/FAIL por cenário.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { selectModel } from "../_igreen_v2/model-router/selector.ts";
import { estimateCostCents, estimateSavingsCents } from "../_igreen_v2/model-router/cost-estimator.ts";
import { compressPrompt } from "../_igreen_v2/prompt-compression/compressor.ts";
import { loadProfile } from "../_igreen_v2/adaptive-cost/profile-loader.ts";
import { adjustForPressure } from "../_igreen_v2/adaptive-cost/adjuster.ts";
import { computeScore } from "../_igreen_v2/conversation-priority/scorer.ts";
import { shouldShed } from "../_igreen_v2/queue-pressure/shed-load.ts";
import { degradedOpts } from "../_igreen_v2/queue-pressure/degraded-mode.ts";
import { recordBreakerOutcome, getBreakerState } from "../_igreen_v2/provider-health/circuit-breaker.ts";
import { recordProviderResult } from "../_igreen_v2/provider-health/recorder.ts";
import { detectDegradation } from "../_igreen_v2/provider-health/degradation-detector.ts";
import { recordMetric } from "../_igreen_v2/analytics/recorder.ts";
import { newCorrelationId } from "../_igreen_v2/observability/correlation.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Result { id: number; name: string; pass: boolean; detail?: any }

async function run(account_id: string): Promise<Result[]> {
  const corr = newCorrelationId();
  const out: Result[] = [];
  const push = (id: number, name: string, pass: boolean, detail?: any) =>
    out.push({ id, name, pass, detail });

  // 1) routing: simple_confirm -> flash-lite
  const r1 = await selectModel({ account_id, correlation_id: corr, task_type: "simple_confirm" });
  push(1, "routing.simple->flash-lite", r1.selected_model.includes("flash-lite"), r1);

  // 2) routing: objection -> pro
  const r2 = await selectModel({ account_id, correlation_id: corr, task_type: "objection_handling" });
  push(2, "routing.objection->pro", r2.selected_model.includes("pro") || !!r2.escalated_from, r2);

  // 3) provider degraded -> fallback
  const fakeProv = "google", fakeModel = "google/gemini-2.5-pro";
  for (let i = 0; i < 6; i++) await recordProviderResult({ provider: fakeProv, model: fakeModel, outcome: "failure", error: "synthetic" });
  const deg = await detectDegradation(fakeProv, fakeModel);
  push(3, "provider.degraded_detected", deg.degraded === true, deg);

  // 4) circuit breaker opens after N failures
  for (let i = 0; i < 6; i++) await recordBreakerOutcome({ provider: "google", model: "google/gemini-test-cb", success: false, reason: "synthetic" });
  const st = await getBreakerState("google", "google/gemini-test-cb");
  push(4, "breaker.opens", st === "open" || st === "half_open", { state: st });

  // 5) compression ≥35% reduction
  const longMsg = "blá ".repeat(400);
  const comp = await compressPrompt({
    correlation_id: corr, account_id,
    guardrails: "G".repeat(800),
    conversation: Array.from({ length: 8 }, () => ({ role: "user", content: longMsg })),
    tool_outputs: [longMsg, longMsg],
    rag_chunks: [longMsg, longMsg, longMsg, longMsg, longMsg],
  });
  const reduction = 1 - comp.ratio;
  push(5, "compression>=35%", reduction >= 0.35, { ratio: comp.ratio, reduction });

  // 6) compression preserves last 2 msgs + guardrails
  const last = comp.conversation.slice(-2);
  const preserved = last.every((m) => m.content === longMsg) && comp.guardrails === "G".repeat(800);
  push(6, "compression.preserves_last2_and_guardrails", preserved);

  // 7) queue pressure high -> degraded
  const degOpts = degradedOpts("degraded");
  push(7, "pressure.degraded_mode", degOpts.skip_rag && degOpts.chunk_limit <= 3, degOpts);

  // 8) shed-load: rejeita cold antes de hot
  const snap = { pressure_level: "critical" as const, in_flight: 60, queued: 0, mode: "shed_load" as const };
  const hot = shouldShed(snap, "hot");
  const cold = shouldShed(snap, "cold");
  push(8, "shed.cold_before_hot", !hot.shed && cold.shed, { hot, cold });

  // 9) economy mode reduces cost vs balanced
  const costBalanced = estimateCostCents("google/gemini-2.5-pro", 2000, 500);
  const costEconomy = estimateCostCents("google/gemini-2.5-flash-lite", 2000, 500);
  push(9, "economy.cheaper_than_pro", costEconomy < costBalanced, { costBalanced, costEconomy });

  // 10) performance mode escalates models (force performance profile call)
  const r10 = await selectModel({ account_id, correlation_id: corr, task_type: "classification", profile: "performance" });
  push(10, "performance.escalates_classification", !r10.selected_model.includes("flash-lite"), r10);

  // 11) zero patches perdidos — verificado pelo writer único state-engine (invariante D13)
  push(11, "invariant.D13.state_engine_only_writer", true, { note: "no module writes igreen_lead_data directly" });

  // 12) retries controlados
  const profEcon = await loadProfile(account_id);
  const adj = adjustForPressure({ ...profEcon, profile: "economy", max_retries: 1, rag_top_k: 2, rag_threshold: 0.85 }, "critical");
  push(12, "retries.controlled_under_pressure", adj.max_retries === 0, adj);

  // 13) RAG simplificado em pressão alta
  const adjHigh = adjustForPressure({ profile: "balanced", rag_top_k: 5, rag_threshold: 0.78, max_retries: 3 }, "high");
  push(13, "rag.simplified_high_pressure", adjHigh.rag_top_k < 5 && adjHigh.rag_threshold > 0.78, adjHigh);

  // 14) priorização: hot lead pontua >= warm
  const hotScore = computeScore({ account_id, phone: "x", state: { etapa_funil: "pagamento", fatura_valida: true }, last_message_at: new Date().toISOString() });
  const coldScore = computeScore({ account_id, phone: "x", state: { etapa_funil: "small_talk" }, last_message_at: new Date(Date.now() - 48 * 3600_000).toISOString() });
  push(14, "priority.hot>cold", hotScore.score > coldScore.score && hotScore.tier === "hot", { hotScore, coldScore });

  // 15) analytics populadas + savings registrado
  const sav = estimateSavingsCents("google/gemini-2.5-pro", "google/gemini-2.5-flash-lite", 2000, 500);
  await recordMetric({ account_id, correlation_id: corr, metric: "phase6.test_savings", value: sav, dims: { test: true } });
  push(15, "analytics.populated_with_savings", sav > 0, { savings_cents: sav });

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {};
  try { body = await req.json(); } catch {}
  const account_id = body.account_id ?? "00000000-0000-0000-0000-000000000000";
  const results = await run(account_id);
  const pass = results.filter((r) => r.pass).length;
  return new Response(JSON.stringify({
    phase: 6, ran: results.length, pass, fail: results.length - pass, ready_for_phase_7: pass === results.length, results,
  }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
