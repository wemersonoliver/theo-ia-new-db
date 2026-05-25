// D8 — Fast Path roda ANTES de qualquer carga pesada (sem histórico, sem LLM).
// Usa apenas state mínimo + última mensagem.

import type { IgreenConversationState } from "../types.ts";

export type FastPathAction = "noop" | "resend_last" | "handoff_now";

export interface FastPathDecision {
  bypass: boolean;
  action?: FastPathAction;
  reason?: string;
}

const HUMAN_KEYWORDS = [
  "humano", "humana", "atendente", "pessoa de verdade", "falar com alguém",
  "falar com alguem", "consultor", "vendedor",
];

export function decideFastPath(args: {
  state: Pick<IgreenConversationState, "handoff_ativo">;
  message: string | null | undefined;
}): FastPathDecision {
  const raw = (args.message ?? "").trim();

  if (!raw) {
    return { bypass: true, action: "noop", reason: "empty_message" };
  }

  if (args.state.handoff_ativo === true) {
    return { bypass: true, action: "noop", reason: "handoff_active" };
  }

  const lower = raw.toLowerCase();
  for (const kw of HUMAN_KEYWORDS) {
    if (lower.includes(kw)) {
      return { bypass: true, action: "handoff_now", reason: `keyword:${kw}` };
    }
  }

  return { bypass: false };
}