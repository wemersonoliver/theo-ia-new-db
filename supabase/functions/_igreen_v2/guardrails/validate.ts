// Guardrails — rodam APÓS specialist e ANTES do behavior-engine.
// Falha grave → marca degrade_to_failsafe = true (caller troca pelo failsafe).
// Falha leve → trunca/filtra e emite evento medium.

import type { AgentResult, AgentToolCall } from "../agents/_types.ts";
import type { IgreenConversationState, IgreenEvent } from "../types.ts";

const MAX_CHUNK_LENGTH = 1000;
const MAX_CHUNKS = 5;

const TOOL_STAGE_COMPAT: Record<string, string[]> = {
  send_discovery_video: ["novo", "qualificacao"],
  request_invoice: ["qualificacao", "fatura_enviada"],
  set_product: ["novo", "qualificacao"],
  set_stage: ["novo", "qualificacao", "fatura_enviada", "fatura_rejeitada", "fatura_validada", "documento_enviado", "documento_validado"],
  validate_green_invoice: ["qualificacao", "fatura_enviada", "fatura_rejeitada"],
  noop: ["novo", "qualificacao", "fatura_enviada", "fatura_rejeitada", "fatura_validada", "documento_enviado", "documento_validado", "handoff", "fechado", "descartado"],
};

export interface GuardrailReport {
  result: AgentResult;
  events: IgreenEvent[];
  applied: string[];
  degrade_to_failsafe: boolean;
}

export function validateAgentResult(args: {
  result: AgentResult;
  state: IgreenConversationState;
  recentMessages?: string[];
}): GuardrailReport {
  const events: IgreenEvent[] = [];
  const applied: string[] = [];
  let degrade = false;

  let messages = args.result.messages.slice();
  let tool_calls = args.result.tool_calls.slice();

  // 1. max-length
  messages = messages.map((m, i) => {
    if (m.length > MAX_CHUNK_LENGTH) {
      applied.push("max-length");
      events.push({
        type: "guardrail_truncated", priority: "medium", source: "specialist",
        payload: { rule: "max-length", index: i, original_length: m.length },
      });
      return m.slice(0, MAX_CHUNK_LENGTH);
    }
    return m;
  });

  // 2. max-chunks
  if (messages.length > MAX_CHUNKS) {
    applied.push("max-chunks");
    events.push({
      type: "guardrail_truncated", priority: "medium", source: "specialist",
      payload: { rule: "max-chunks", original: messages.length },
    });
    messages = messages.slice(0, MAX_CHUNKS);
  }

  // 3. text-loop (mesma string consecutiva)
  messages = dedupConsecutive(messages, applied, events);

  // 4. semantic-repeat vs recentes
  const recent = (args.recentMessages ?? []).map(normalize);
  const repeated = messages.filter((m) => recent.includes(normalize(m)));
  if (repeated.length >= 2) {
    applied.push("semantic-repeat");
    events.push({
      type: "guardrail_semantic_repeat", priority: "high", source: "specialist",
      payload: { repeated_count: repeated.length },
    });
    degrade = true;
  }

  // 5. tool-stage compat
  const etapa = (args.state.etapa_funil ?? "novo").toLowerCase();
  const filteredTools: AgentToolCall[] = [];
  for (const tc of tool_calls) {
    const allowed = TOOL_STAGE_COMPAT[tc.name];
    if (!allowed) { filteredTools.push(tc); continue; }
    if (allowed.includes(etapa)) {
      filteredTools.push(tc);
    } else {
      applied.push("tool-stage-compat");
      events.push({
        type: "guardrail_tool_blocked", priority: "high", source: "specialist",
        payload: { tool: tc.name, etapa, allowed },
      });
    }
  }
  tool_calls = filteredTools;

  return {
    result: { ...args.result, messages, tool_calls },
    events,
    applied,
    degrade_to_failsafe: degrade,
  };
}

function dedupConsecutive(
  messages: string[],
  applied: string[],
  events: IgreenEvent[],
): string[] {
  const out: string[] = [];
  let last = "";
  for (const m of messages) {
    if (normalize(m) === last && last) {
      applied.push("text-loop");
      events.push({
        type: "guardrail_text_loop", priority: "medium", source: "specialist",
        payload: { text_preview: m.slice(0, 60) },
      });
      continue;
    }
    out.push(m);
    last = normalize(m);
  }
  return out;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}