// Correlation ID — Fase 4.
// Formato: igr_{timestampMs}_{randomHex6}
// Gerado no início do handler; propagado por traces/events/tools/automations/validator.

export function newCorrelationId(): string {
  const ts = Date.now().toString();
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `igr_${ts}_${hex}`;
}

export function isCorrelationId(s: unknown): s is string {
  return typeof s === "string" && /^igr_\d+_[0-9a-f]{6}$/.test(s);
}