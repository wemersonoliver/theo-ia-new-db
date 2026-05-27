export interface DegradedOpts { typing_enabled: boolean; jitter_ms_max: number; chunk_limit: number; skip_rag: boolean }
export function degradedOpts(mode: "normal" | "degraded" | "shed_load"): DegradedOpts {
  if (mode === "normal") return { typing_enabled: true, jitter_ms_max: 2800, chunk_limit: 6, skip_rag: false };
  if (mode === "degraded") return { typing_enabled: true, jitter_ms_max: 1200, chunk_limit: 3, skip_rag: true };
  return { typing_enabled: false, jitter_ms_max: 400, chunk_limit: 2, skip_rag: true };
}
