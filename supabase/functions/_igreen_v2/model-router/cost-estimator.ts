// Fase 6 — Cost Estimator
export interface ModelPricing { input_per_1k: number; output_per_1k: number }

export const MODEL_PRICES: Record<string, ModelPricing> = {
  "google/gemini-2.5-flash-lite": { input_per_1k: 0.0075, output_per_1k: 0.03 },
  "google/gemini-2.5-flash":      { input_per_1k: 0.0125, output_per_1k: 0.05 },
  "google/gemini-2.5-pro":        { input_per_1k: 0.125,  output_per_1k: 0.50 },
  "google/gemini-3-flash-preview":{ input_per_1k: 0.015,  output_per_1k: 0.06 },
};

export function estimateCostCents(model: string, tokens_in: number, tokens_out: number): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES["google/gemini-2.5-flash"];
  return (tokens_in / 1000) * p.input_per_1k + (tokens_out / 1000) * p.output_per_1k;
}

export function estimateSavingsCents(baseline: string, selected: string, tin: number, tout: number): number {
  if (baseline === selected) return 0;
  return Math.max(0, estimateCostCents(baseline, tin, tout) - estimateCostCents(selected, tin, tout));
}