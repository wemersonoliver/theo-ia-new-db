import type { ProfileConfig } from "./profile-loader.ts";
export function adjustForPressure(cfg: ProfileConfig, pressure: "low" | "medium" | "high" | "critical"): ProfileConfig {
  if (pressure === "low" || pressure === "medium") return cfg;
  if (pressure === "high") return { ...cfg, rag_top_k: Math.max(1, Math.floor(cfg.rag_top_k / 2)), rag_threshold: Math.min(0.92, cfg.rag_threshold + 0.05), max_retries: 1 };
  return { ...cfg, rag_top_k: 0, rag_threshold: 0.95, max_retries: 0 };
}
