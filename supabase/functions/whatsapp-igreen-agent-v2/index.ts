// whatsapp-igreen-agent-v2 — Edge function principal da vertical Igreen V2.
//
// FASE 1 (Fundação):
//   - roteamento estrito por accounts.is_igreen (D13)
//   - cria/carrega state via state-engine (D9 + D14)
//   - emite trace minimal (D5)
//   - resposta de eco para validar o pipeline
//
// As fases seguintes plugam: fast-path, supervisor, specialists, tools,
// automações, RAG, document validator, humanização, failsafe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isIgreenAccount } from "../_igreen_v2/routing/is-igreen.ts";
import { applyPatch, ensureState, loadState } from "../_igreen_v2/state-engine/update.ts";
import { trace, emitEvents } from "../_igreen_v2/observability/trace.ts";
import { decideFastPath } from "../_igreen_v2/fast-path/decide.ts";
import { decideSupervisor } from "../_igreen_v2/supervisor/decide.ts";
import { registerAllTools } from "../_igreen_v2/tools/_register-all.ts";
import { executeTool } from "../_igreen_v2/tool-router/execute.ts";
import { resolveSpecialist } from "../_igreen_v2/specialist-router/resolve.ts";
import { runAgent } from "../_igreen_v2/agents/_run.ts";
import { runFailsafe } from "../_igreen_v2/agents/failsafe/run.ts";
import { validateAgentResult } from "../_igreen_v2/guardrails/validate.ts";
import { prepareMessages } from "../_igreen_v2/behavior-engine/prepare.ts";
import { sendOrchestrated } from "../_igreen_v2/transport/send-orchestrator.ts";
import { newCorrelationId } from "../_igreen_v2/observability/correlation.ts";
import { dispatchAutomations } from "../_igreen_v2/automation-router/dispatch.ts";
import { CURRENT_VALIDATION_VERSION } from "../_igreen_v2/document-rules-engine/version.ts";
import { withTimeout, DEFAULT_TIMEOUTS, TimeoutError } from "../_igreen_v2/cost-governor/timeout-orchestrator.ts";
import { appendMessage, getWindow } from "../_igreen_v2/memory/short-term.ts";
import { getLatestSummary } from "../_igreen_v2/memory/summarizer.ts";
import { retrieve as ragRetrieve } from "../_igreen_v2/rag/retriever.ts";
import { buildContext } from "../_igreen_v2/rag/context-builder.ts";
import { checkPhoneRate } from "../_igreen_v2/cost-governor/rate-limiter.ts";
import { isCancelled } from "../_igreen_v2/cost-governor/cancel-registry.ts";
// Phase 6 — Optimization / Scalability / Operational Intelligence
import { measurePressure } from "../_igreen_v2/queue-pressure/monitor.ts";
import { shouldShed } from "../_igreen_v2/queue-pressure/shed-load.ts";
import { degradedOpts } from "../_igreen_v2/queue-pressure/degraded-mode.ts";
import { scoreAndPersist } from "../_igreen_v2/conversation-priority/scorer.ts";
import { loadProfile } from "../_igreen_v2/adaptive-cost/profile-loader.ts";
import { adjustForPressure } from "../_igreen_v2/adaptive-cost/adjuster.ts";
import { selectModel, type TaskType } from "../_igreen_v2/model-router/selector.ts";
import { compressPrompt } from "../_igreen_v2/prompt-compression/compressor.ts";
import { recordProviderResult } from "../_igreen_v2/provider-health/recorder.ts";
import { recordBreakerOutcome } from "../_igreen_v2/provider-health/circuit-breaker.ts";
import { trackTurnCost } from "../_igreen_v2/analytics/cost-tracker.ts";
import { recordMetric } from "../_igreen_v2/analytics/recorder.ts";
import { timed } from "../_igreen_v2/operational-metrics/emitter.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cliente service-role para resolver instance_name a partir da account.
const _svcClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Resolve o instance_name real para a account. Prioriza:
//   1) state.whatsapp_instance (se já fixado)
//   2) instância conectada (status=connected) marcada como is_primary
//   3) qualquer instância conectada da account
async function resolveInstanceName(
  accountId: string,
  stateHint: string | null,
): Promise<string> {
  if (stateHint && stateHint !== "default") return stateHint;
  try {
    const { data } = await _svcClient
      .from("whatsapp_instances")
      .select("instance_name, status, is_primary")
      .eq("account_id", accountId)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });
    const connected = (data ?? []).find((i: any) => i.status === "connected");
    if (connected?.instance_name) return connected.instance_name as string;
    if ((data ?? [])[0]?.instance_name) return (data as any)[0].instance_name;
  } catch (e) {
    console.error("[igreen-v2] resolveInstanceName error", e);
  }
  return "default";
}

function intentToTaskType(intent: string): TaskType {
  const i = (intent ?? "").toLowerCase();
  if (i.includes("confirm") || i.includes("sim_nao") || i.includes("soft")) return "simple_confirm";
  if (i.includes("small_talk") || i.includes("saudacao") || i.includes("greeting")) return "small_talk";
  if (i.includes("classif")) return "classification";
  if (i.includes("resum") || i.includes("summary")) return "summary";
  if (i.includes("objec") || i.includes("duvida_pesada") || i.includes("negoc")) return "objection_handling";
  if (i.includes("analise") || i.includes("long")) return "long_analysis";
  return "rag_synthesis";
}

// Boot: registra todas as tools (D4 — duplicado quebra o boot).
registerAllTools();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingPayload {
  account_id?: string;
  phone?: string;
  message?: string;
  ping?: boolean;
  /** Quando presente, roda apenas a tool informada (debug/teste do tool-router). */
  tool?: string;
  tool_args?: unknown;
  /** Quando presente, roda specialist isolado sem supervisor (debug). */
  agent?: string;
  /** Mídia anexada (Fase 4) — usada para validate_green_invoice. */
  media?: { url: string; mime_type: string; byte_size: number };
  /** Correlation id externo (debug); senão é gerado. */
  correlation_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: IncomingPayload = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (body.ping) {
    return json({ ok: true, service: "whatsapp-igreen-agent-v2", phase: 6, validation_version: CURRENT_VALIDATION_VERSION });
  }

  const account_id = (body.account_id ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const correlation_id = body.correlation_id || newCorrelationId();
  const media = body.media ?? null;

  if (!account_id || !phone) {
    return json({ error: "account_id and phone are required" }, 400);
  }

  // D13 — roteamento estrito
  const isIgreen = await isIgreenAccount(account_id);
  if (!isIgreen) {
    return json(
      {
        routed: false,
        reason: "account_not_igreen",
        hint: "Esta edge atende apenas contas com accounts.is_igreen = true.",
      },
      403,
    );
  }

  // Modo debug: dispara apenas uma tool isolada.
  if (body.tool) {
    const state = await ensureState(account_id, phone);
    const result = await executeTool({
      ctx: { account_id, phone, state, message: body.message, correlation_id, media },
      tool_name: body.tool,
      args: body.tool_args ?? {},
    });
    // Dispara automações também em modo tool/debug (mesmo contrato do main path).
    let automations: unknown = [];
    if (result?.events?.length) {
      const refreshed = (await loadState(account_id, phone)) ?? state;
      automations = await dispatchAutomations({
        account_id, phone, correlation_id, state: refreshed, events: result.events,
      });
    }
    return json({ ok: true, phase: 4, mode: "tool", correlation_id, tool: body.tool, result, automations });
  }

  // Modo debug: roda specialist isolado (sem supervisor).
  if (body.agent) {
    const state = await ensureState(account_id, phone);
    const resolved = resolveSpecialist(body.agent);
    const agentResult = await runAgent({
      specialist: resolved.specialist,
      runner: resolved.runner,
      ctx: { account_id, phone, state, message: body.message ?? "", correlation_id, media },
    });
    return json({ ok: true, phase: 4, mode: "agent", correlation_id, agent: resolved.specialist, agentResult });
  }

  const t0 = Date.now();
  const message = (body.message ?? "").trim();

  await trace({
    account_id,
    phone,
    step: "agent.received",
    level: "minimal",
    payload: { has_message: !!message, has_media: !!media },
    correlation_id,
  });

  // Phase 5 — rate limit por phone (8/min) e checagem de cancelamento prévio.
  const rate = await checkPhoneRate(account_id, phone, 8);
  if (!rate.allowed) {
    await trace({ account_id, phone, step: "agent.rate_limited", level: "minimal", payload: { scope: "phone" }, correlation_id });
    return json({ ok: false, reason: "rate_limited", correlation_id }, 429);
  }
  if (await isCancelled(correlation_id)) {
    return json({ ok: false, reason: "cancelled", correlation_id }, 200);
  }

  // Phase 6 — queue pressure + adaptive cost + conversation priority (before heavy work).
  const [pressure, profileBase] = await Promise.all([
    measurePressure(account_id),
    loadProfile(account_id),
  ]);
  const profile = adjustForPressure(profileBase, pressure.pressure_level);
  const degraded = degradedOpts(pressure.mode);
  const priorState = await ensureState(account_id, phone);
  const priority = await scoreAndPersist({
    account_id, phone, state: priorState,
    last_message_at: (priorState as any)?.last_user_message_at ?? new Date().toISOString(),
  });
  const shed = shouldShed(pressure, priority.tier);
  if (shed.shed) {
    await trace({ account_id, phone, step: "queue.shed", level: "minimal",
      payload: { tier: priority.tier, pressure: pressure.pressure_level, reason: shed.reason }, correlation_id });
    await recordMetric({ account_id, correlation_id, metric: "queue.shed", value: 1,
      dims: { tier: priority.tier, pressure: pressure.pressure_level } });
    return json({ ok: false, reason: "shed_load", retry_after_ms: shed.retry_after_ms,
      correlation_id, pressure: pressure.pressure_level, tier: priority.tier }, 503);
  }

  // Phase 5 — registra mensagem do usuário na memória curta (com PII mask interno).
  if (message) {
    await appendMessage({ account_id, phone, role: "user", content: message, correlation_id });
  }

  // D8 — FAST PATH antes de qualquer carga pesada (sem histórico, sem LLM)
  const state = priorState;
  const fp = decideFastPath({ state, message });
  if (fp.bypass) {
    await emitEvents(account_id, phone, [
      { type: "fast_path_bypass", priority: fp.action === "handoff_now" ? "high" : "low",
        source: "fast_path", payload: { action: fp.action, reason: fp.reason } },
    ], correlation_id);
    // Soft-confirm "sim" → aplica patch de aprovação direto (D14).
    if (fp.action === "soft_confirm_yes") {
      await applyPatch({
        account_id, phone,
        patch: { etapa_funil: "fatura_validada", document_status: "validated", fatura_valida: true } as any,
        events: [{ type: "invoice_approved", priority: "high", source: "fast_path", payload: { via: "soft_confirm_yes" } }],
        source: "fast_path:soft_confirm_yes",
        correlation_id,
      });
      const refreshed = (await loadState(account_id, phone)) ?? state;
      await dispatchAutomations({
        account_id, phone, correlation_id, state: refreshed,
        events: [{ type: "invoice_approved", priority: "high", source: "fast_path" }],
      });
    } else if (fp.action === "handoff_now") {
      await dispatchAutomations({
        account_id, phone, correlation_id, state,
        events: [{ type: "handoff_requested", priority: "critical", source: "fast_path",
          payload: { reason: fp.reason } }],
      });
    }
    await trace({ account_id, phone, step: "agent.fast_path.bypass",
      level: "minimal", duration_ms: Date.now() - t0,
      payload: { action: fp.action, reason: fp.reason }, correlation_id });
    return json({ ok: true, phase: 4, correlation_id, routed: true, fast_path: fp });
  }

  // Marca recebimento (passa pelo state-engine = único writer, D14)
  await applyPatch({
    account_id, phone,
    events: [{ type: "message_received", priority: "low", source: "supervisor",
      payload: { message_preview: message.slice(0, 80), has_media: !!media } }],
    source: "agent",
    correlation_id,
  });

  // D1 — supervisor classifica intent + specialist (timeout determinístico Phase 5)
  // Busca a última pergunta da IA para dar contexto ao supervisor (evita
  // baixa-confiança em respostas curtas como "Wemerson", "Sim", "Tenho").
  let lastAiQuestion: string | null = null;
  try {
    const { data: convRow } = await _svcClient
      .from("whatsapp_conversations")
      .select("messages")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .maybeSingle();
    const msgs = (convRow?.messages as any[] | null) ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m?.from_me === true && (m?.type ?? "text") === "text" && typeof m?.content === "string") {
        lastAiQuestion = m.content as string;
        break;
      }
    }
  } catch (_) { /* non-blocking */ }

  const sup = await withTimeout(
    "supervisor",
    DEFAULT_TIMEOUTS.agentMs,
    () => decideSupervisor({ account_id, phone, message, state, last_ai_question: lastAiQuestion }),
    () => ({ intent: "unknown", specialist: "failsafe", confidence: 0, source: "timeout" as const }),
  );

  // D14 — única escrita em state via state-engine
  const afterSupervisor = await applyPatch({
    account_id, phone,
    patch: { intent: sup.intent, specialist: sup.specialist },
    events: [{
      type: sup.source === "timeout" ? "supervisor_timeout" : "supervisor_decided",
      priority: sup.source === "timeout" ? "high" : "medium",
      source: "supervisor",
      payload: { intent: sup.intent, specialist: sup.specialist, confidence: sup.confidence, decision_source: sup.source },
    }],
    source: "supervisor",
    correlation_id,
  }) ?? state;

  // Specialist Router + Agent
  const resolved = resolveSpecialist(sup.specialist);
  await trace({
    account_id, phone, step: "specialist_selected", level: "standard",
    payload: { specialist: resolved.specialist, reason: resolved.reason },
    correlation_id,
  });

  // Phase 5/6 — memory + RAG (RAG é suprimido sob degraded/shed_load).
  const skipRag = degraded.skip_rag || profile.rag_top_k === 0;
  const [memWindow, memSummaryRow, ragOut] = await Promise.all([
    getWindow(account_id, phone),
    getLatestSummary(account_id, phone),
    (!skipRag && message)
      ? timed("rag.retrieve", account_id, correlation_id,
          () => ragRetrieve({ query: message, account_id, correlation_id }))
      : Promise.resolve({ chunks: [], cache_hit: false, latency_ms: 0, query_hash: "" }),
  ]);
  const memSummary = memSummaryRow?.summary ?? null;

  // Phase 6 — Model routing decision (task_type derivado do intent).
  const taskType = intentToTaskType(sup.intent);
  const routeDecision = await selectModel({
    account_id, correlation_id, phone,
    task_type: taskType,
    profile: profile.profile,
    tokens_in_estimate: 1500,
    tokens_out_estimate: 400,
  });

  // Phase 6 — Prompt compression (telemetria + redução real do payload contextual).
  const compression = await compressPrompt({
    correlation_id, account_id,
    guardrails: "igreen-guardrails-v6",
    conversation: memWindow.map((m) => ({ role: m.role as any, content: m.content })),
    tool_outputs: [],
    rag_chunks: ragOut.chunks.map((c) => c.content),
  });

  // Context Budget Allocator — registra alocações context.* mesmo quando o specialist
  // não consome o prompt agregado (specialists Igreen têm seus próprios prompts curtos).
  await buildContext({
    correlation_id,
    account_id,
    system: "igreen-guardrails",
    conversation: compression.conversation,
    memorySummary: memSummary,
    toolOutputs: compression.tool_outputs,
    ragChunks: ragOut.chunks
      .slice(0, compression.rag_chunks.length)
      .map((c, i) => ({ id: c.id, content: compression.rag_chunks[i] ?? c.content, score: c.score })),
  });

  const specialistT0 = Date.now();
  let specialistOk = true;
  let agentResult = await withTimeout(
    "specialist",
    DEFAULT_TIMEOUTS.agentMs,
    () => timed("specialist.run", account_id, correlation_id, () => runAgent({
      specialist: resolved.specialist,
      runner: resolved.runner,
      ctx: {
        account_id, phone, state: afterSupervisor, message, intent: sup.intent, correlation_id, media,
        memory_window: memWindow, memory_summary: memSummary, rag_chunks: ragOut.chunks,
        route: routeDecision, compression: { ratio: compression.ratio, tokens_in: compression.tokens_in, tokens_out: compression.tokens_out },
      } as any,
    })),
    () => { specialistOk = false; return runFailsafe({ account_id, phone, state: afterSupervisor, message, correlation_id }); },
  );
  // Phase 6 — provider health + circuit breaker outcome.
  const specialistLatency = Date.now() - specialistT0;
  await Promise.all([
    recordProviderResult({ provider: "google", model: routeDecision.selected_model,
      outcome: specialistOk ? "success" : "timeout", latency_ms: specialistLatency,
      error: specialistOk ? undefined : "specialist_timeout" }),
    recordBreakerOutcome({ provider: "google", model: routeDecision.selected_model,
      success: specialistOk, reason: specialistOk ? undefined : "specialist_timeout", correlation_id }),
    trackTurnCost({ account_id, correlation_id,
      estimated_cost_cents: routeDecision.estimated_cost_cents,
      estimated_savings_cents: routeDecision.estimated_savings_cents,
      model: routeDecision.selected_model }),
  ]);

  // Guardrails
  const recent = await loadRecentSent(account_id, phone);
  let guard = validateAgentResult({ result: agentResult, state: afterSupervisor, recentMessages: recent });
  if (guard.events.length) await emitEvents(account_id, phone, guard.events, correlation_id);
  await trace({
    account_id, phone, step: "guardrails_applied", level: "standard",
    payload: { applied: guard.applied, degrade: guard.degrade_to_failsafe }, correlation_id,
  });
  if (guard.degrade_to_failsafe) {
    agentResult = await runFailsafe({ account_id, phone, state: afterSupervisor, message, correlation_id });
    guard = validateAgentResult({ result: agentResult, state: afterSupervisor });
  } else {
    agentResult = guard.result;
  }

  // Tool calls solicitadas pelo specialist (state-engine é o único writer)
  const toolResults: any[] = [];
  await trace({
    account_id, phone, step: "tools_requested", level: "standard",
    payload: { count: agentResult.tool_calls.length, tools: agentResult.tool_calls.map((t) => t.name) },
    correlation_id,
  });
  for (const tc of agentResult.tool_calls) {
    const currentState = (await loadState(account_id, phone)) ?? afterSupervisor;
    const r = await withTimeout(
      `tool:${tc.name}`,
      DEFAULT_TIMEOUTS.toolMs,
      () => executeTool({
        ctx: { account_id, phone, state: currentState, message, correlation_id, media },
        tool_name: tc.name,
        args: tc.args,
      }),
      () => ({ ok: false, error: "tool_timeout", events: [] } as any),
    );
    toolResults.push({ name: tc.name, ...r });
  }
  await trace({
    account_id, phone, step: "tools_executed", level: "standard",
    payload: { count: toolResults.length }, correlation_id,
  });

  // Patch sugerido pelo specialist (não-tool) via state-engine
  if (Object.keys(agentResult.suggested_state_patch).length || agentResult.events.length) {
    await applyPatch({
      account_id, phone,
      patch: agentResult.suggested_state_patch,
      events: agentResult.events,
      source: `specialist:${resolved.specialist}`,
      correlation_id,
    });
  }

  // Automation router — agrega events do specialist + tools e dispara automações.
  const allEvents = [
    ...agentResult.events,
    ...toolResults.flatMap((r) => (r.events ?? []) as any[]),
  ];
  const refreshed = (await loadState(account_id, phone)) ?? afterSupervisor;
  const automations = await dispatchAutomations({
    account_id, phone, correlation_id, state: refreshed, events: allEvents,
  });

  // Behavior engine → transport
  const prepared = prepareMessages(agentResult.messages);
  // Phase 6 — degraded mode limita número de chunks enviados.
  const chunkLimited = prepared.slice(0, Math.max(1, degraded.chunk_limit));
  await trace({
    account_id, phone, step: "behavior_chunks_generated", level: "standard",
    payload: { count: chunkLimited.length, original: prepared.length, degraded_mode: pressure.mode }, correlation_id,
  });

  // Phase 5 — transport orchestrator (lock → typing → send → record).
  const instance = await resolveInstanceName(account_id, (state as any)?.whatsapp_instance ?? null);
  const dryRun = !Deno.env.get("EVOLUTION_API_URL") || !Deno.env.get("EVOLUTION_API_KEY");
  const joined = chunkLimited.map((p) => p.text).join("\n\n");
  const sent = await withTimeout(
    "transport",
    DEFAULT_TIMEOUTS.transportMs * Math.max(chunkLimited.length, 1),
    () => timed("transport.send", account_id, correlation_id, () => sendOrchestrated({
      account_id, correlation_id, phone, instance, text: joined, dryRun,
    })),
    () => ({ delivered: false, chunks: 0, events: [], lock_acquired: false } as any),
  );

  // Phase 5 — registra mensagens do assistant na memória curta.
  if (chunkLimited.length) {
    await appendMessage({ account_id, phone, role: "assistant", content: joined, correlation_id });
  }

  await trace({
    account_id, phone, step: "agent.completed",
    level: "minimal", duration_ms: Date.now() - t0,
    payload: {
      phase: 6, specialist: resolved.specialist, intent: sup.intent,
      chunks: chunkLimited.length, rag_cache_hit: ragOut.cache_hit,
      model: routeDecision.selected_model, escalated_from: routeDecision.escalated_from ?? null,
      compression_ratio: compression.ratio, pressure: pressure.pressure_level,
      tier: priority.tier, cost_cents: routeDecision.estimated_cost_cents,
      savings_cents: routeDecision.estimated_savings_cents,
    },
    correlation_id,
  });

  await recordMetric({ account_id, correlation_id, metric: "turn.total_ms",
    value: Date.now() - t0, dims: { phase: 6, specialist: resolved.specialist } });

  return json({
    ok: true, phase: 6, correlation_id, routed: true,
    fast_path: { bypass: false },
    supervisor: sup,
    specialist: resolved.specialist,
    messages: chunkLimited.map((p) => p.text),
    tool_results: toolResults,
    automations,
    transport: sent,
    rag: { cache_hit: ragOut.cache_hit, chunks: ragOut.chunks.length, latency_ms: ragOut.latency_ms },
    phase6: {
      pressure: pressure.pressure_level, mode: pressure.mode,
      tier: priority.tier, score: priority.score,
      profile: profile.profile, model: routeDecision.selected_model,
      escalated_from: routeDecision.escalated_from ?? null,
      compression_ratio: compression.ratio,
      cost_cents: routeDecision.estimated_cost_cents,
      savings_cents: routeDecision.estimated_savings_cents,
    },
    note: "Fase 6 v2 (model router + compression + queue pressure + adaptive cost + analytics).",
  });
});

async function loadRecentSent(_account_id: string, _phone: string): Promise<string[]> {
  // Stub Fase 3: histórico real virá quando o transport for plugado.
  return [];
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}