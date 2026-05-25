// Stub Fase 3: calcula typing/delay sugeridos por chunk.
// O transport real consumirá esses valores em fases futuras.

export interface HumanizationHint {
  typing_ms: number;
  delay_ms: number;
}

export function humanize(text: string): HumanizationHint {
  const len = text.length;
  return {
    typing_ms: Math.min(4000, Math.max(800, len * 35)),
    delay_ms: Math.min(1500, Math.max(300, len * 8)),
  };
}