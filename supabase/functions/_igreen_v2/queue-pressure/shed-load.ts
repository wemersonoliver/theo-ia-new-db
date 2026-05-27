import type { Tier } from "../conversation-priority/scorer.ts";
import type { PressureSnapshot } from "./monitor.ts";
export interface ShedDecision { shed: boolean; reason?: string; retry_after_ms?: number }
export function shouldShed(snap: PressureSnapshot, tier: Tier): ShedDecision {
  if (snap.mode !== "shed_load") return { shed: false };
  if (tier === "hot") return { shed: false };
  if (tier === "warm") return { shed: true, reason: "shed_warm_under_critical", retry_after_ms: 5_000 };
  return { shed: true, reason: "shed_cold_under_critical", retry_after_ms: 15_000 };
}
