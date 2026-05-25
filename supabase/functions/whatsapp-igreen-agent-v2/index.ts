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
import { applyPatch, ensureState } from "../_igreen_v2/state-engine/update.ts";
import { trace, emitEvents } from "../_igreen_v2/observability/trace.ts";
import { decideFastPath } from "../_igreen_v2/fast-path/decide.ts";
import { decideSupervisor } from "../_igreen_v2/supervisor/decide.ts";
import { registerAllTools } from "../_igreen_v2/tools/_register-all.ts";
import { executeTool } from "../_igreen_v2/tool-router/execute.ts";

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
    return json({ ok: true, service: "whatsapp-igreen-agent-v2", phase: 2 });
  }

  const account_id = (body.account_id ?? "").trim();
  const phone = (body.phone ?? "").trim();

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
      ctx: { account_id, phone, state, message: body.message },
      tool_name: body.tool,
      args: body.tool_args ?? {},
    });
    return json({ ok: true, phase: 2, mode: "tool", tool: body.tool, result });
  }

  const t0 = Date.now();
  const message = (body.message ?? "").trim();

  await trace({
    account_id,
    phone,
    step: "agent.received",
    level: "minimal",
    payload: { has_message: !!message },
  });

  // D9 — carrega state mínimo
  const state = await ensureState(account_id, phone);

  // D8 — FAST PATH antes de qualquer carga pesada (sem histórico, sem LLM)
  const fp = decideFastPath({ state, message });
  if (fp.bypass) {
    await emitEvents(account_id, phone, [
      { type: "fast_path_bypass", priority: fp.action === "handoff_now" ? "high" : "low",
        source: "fast_path", payload: { action: fp.action, reason: fp.reason } },
    ]);
    await trace({ account_id, phone, step: "agent.fast_path.bypass",
      level: "minimal", duration_ms: Date.now() - t0,
      payload: { action: fp.action, reason: fp.reason } });
    return json({ ok: true, phase: 2, routed: true, fast_path: fp });
  }

  // Marca recebimento (passa pelo state-engine = único writer, D14)
  await applyPatch({
    account_id, phone,
    events: [{ type: "message_received", priority: "low", source: "supervisor",
      payload: { message_preview: message.slice(0, 80) } }],
    source: "agent",
  });

  // D1 — supervisor classifica intent + specialist (timeout 8s; fallback failsafe)
  const sup = await decideSupervisor({ account_id, phone, message, state });

  // D14 — única escrita em state via state-engine
  await applyPatch({
    account_id, phone,
    patch: { intent: sup.intent, specialist: sup.specialist },
    events: [{
      type: sup.source === "timeout" ? "supervisor_timeout" : "supervisor_decided",
      priority: sup.source === "timeout" ? "high" : "medium",
      source: "supervisor",
      payload: { intent: sup.intent, specialist: sup.specialist, confidence: sup.confidence, decision_source: sup.source },
    }],
    source: "supervisor",
  });

  await trace({
    account_id, phone, step: "agent.completed",
    level: "minimal", duration_ms: Date.now() - t0,
    payload: { phase: 2, specialist: sup.specialist, intent: sup.intent },
  });

  return json({
    ok: true, phase: 2, routed: true,
    fast_path: { bypass: false },
    supervisor: sup,
    note: "Fase 2 (state + supervisor + fast-path + tool-router). Specialists reais na Fase 3.",
    tools_endpoint_hint: "Para testar o tool-router: POST { tool: 'set_product', tool_args: { produto: 'green' } }",
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}