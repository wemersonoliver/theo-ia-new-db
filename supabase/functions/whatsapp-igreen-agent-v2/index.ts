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
import { send as transportSend } from "../_igreen_v2/transport/send.ts";
import { newCorrelationId } from "../_igreen_v2/observability/correlation.ts";
import { dispatchAutomations } from "../_igreen_v2/automation-router/dispatch.ts";
import { CURRENT_VALIDATION_VERSION } from "../_igreen_v2/document-rules-engine/version.ts";

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
    return json({ ok: true, service: "whatsapp-igreen-agent-v2", phase: 4, validation_version: CURRENT_VALIDATION_VERSION });
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
    return json({ ok: true, phase: 4, mode: "tool", correlation_id, tool: body.tool, result });
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

  // D8 — FAST PATH antes de qualquer carga pesada (sem histórico, sem LLM)
  const state = await ensureState(account_id, phone);
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

  // D1 — supervisor classifica intent + specialist (timeout 8s; fallback failsafe)
  const sup = await decideSupervisor({ account_id, phone, message, state });

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

  let agentResult = await runAgent({
    specialist: resolved.specialist,
    runner: resolved.runner,
    ctx: { account_id, phone, state: afterSupervisor, message, intent: sup.intent, correlation_id, media },
  });

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
    const r = await executeTool({
      ctx: { account_id, phone, state: currentState, message, correlation_id, media },
      tool_name: tc.name,
      args: tc.args,
    });
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
  await trace({
    account_id, phone, step: "behavior_chunks_generated", level: "standard",
    payload: { count: prepared.length }, correlation_id,
  });
  const sent = await transportSend({ account_id, phone, messages: prepared });

  await trace({
    account_id, phone, step: "agent.completed",
    level: "minimal", duration_ms: Date.now() - t0,
    payload: { phase: 4, specialist: resolved.specialist, intent: sup.intent, chunks: prepared.length },
    correlation_id,
  });

  return json({
    ok: true, phase: 4, correlation_id, routed: true,
    fast_path: { bypass: false },
    supervisor: sup,
    specialist: resolved.specialist,
    messages: prepared.map((p) => p.text),
    tool_results: toolResults,
    automations,
    transport: sent,
    note: "Fase 4 (Document Validator + Holder Match + Thresholds + Automations).",
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