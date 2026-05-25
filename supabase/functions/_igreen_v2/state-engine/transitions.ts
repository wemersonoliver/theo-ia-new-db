// D9 + D14 — whitelist de transições de etapa_funil.
// Patches que tentem etapa_funil fora desta whitelist são rejeitados.

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  novo: ["qualificacao", "handoff", "descartado"],
  qualificacao: ["fatura_enviada", "handoff", "descartado"],
  fatura_enviada: ["fatura_validada", "qualificacao", "handoff", "descartado"],
  fatura_validada: ["documento_enviado", "handoff", "descartado"],
  documento_enviado: ["documento_validado", "fatura_validada", "handoff", "descartado"],
  documento_validado: ["handoff", "fechado"],
  handoff: ["fechado", "descartado"],
  fechado: [],
  descartado: [],
};

export function validateTransition(current: string | null | undefined, next: string): boolean {
  const from = (current ?? "novo").toLowerCase();
  if (from === next) return true; // no-op
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(next);
}