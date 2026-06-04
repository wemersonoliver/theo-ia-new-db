// D9 + D14 — whitelist de transições de etapa_funil.
// Patches que tentem etapa_funil fora desta whitelist são rejeitados.

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  novo: ["qualificacao", "handoff", "descartado"],
  qualificacao: ["fatura_enviada", "fatura_validada", "fatura_rejeitada", "handoff", "descartado"],
  fatura_enviada: ["fatura_validada", "fatura_rejeitada", "qualificacao", "handoff", "descartado"],
  // Permite recuperação quando a fatura foi rejeitada só por titularidade
  // divergente e o cliente confirma autorização familiar: a fatura passa a
  // ser válida e o próximo anexo deve ser RG/CNH, não nova fatura.
  fatura_rejeitada: ["fatura_enviada", "fatura_validada", "documento_enviado", "documento_validado", "qualificacao", "handoff", "descartado"],
  fatura_validada: ["documento_enviado", "documento_validado", "fatura_rejeitada", "handoff", "descartado"],
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