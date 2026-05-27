import type { Tier } from "./scorer.ts";
export function tierWeight(tier: Tier): number { return tier === "hot" ? 3 : tier === "warm" ? 2 : 1; }
