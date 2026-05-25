// Resolve qual AgentRunner usar com base em state.specialist.
// Mantém supervisor desacoplado da execução do agent.

import type { AgentRunner } from "../agents/_types.ts";
import { runGreen } from "../agents/green/run.ts";
import { runFailsafe } from "../agents/failsafe/run.ts";

export interface ResolvedSpecialist {
  specialist: string;
  runner: AgentRunner;
  reason: "matched" | "fallback_unknown" | "fallback_unimplemented";
}

const IMPLEMENTED = new Set(["green", "failsafe"]);

export function resolveSpecialist(specialist: string | null | undefined): ResolvedSpecialist {
  const name = (specialist ?? "").toLowerCase();
  if (name === "green") return { specialist: "green", runner: runGreen, reason: "matched" };
  if (name === "failsafe") return { specialist: "failsafe", runner: runFailsafe, reason: "matched" };
  if (!name) return { specialist: "failsafe", runner: runFailsafe, reason: "fallback_unknown" };
  if (!IMPLEMENTED.has(name)) {
    return { specialist: "failsafe", runner: runFailsafe, reason: "fallback_unimplemented" };
  }
  return { specialist: "failsafe", runner: runFailsafe, reason: "fallback_unknown" };
}