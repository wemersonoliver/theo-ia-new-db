import type { TaskType } from "./selector.ts";

export function shouldEscalate(opts: {
  current_task: TaskType;
  confidence: number;
  context_tokens: number;
}): TaskType | null {
  if (opts.confidence < 0.4) return "objection_handling";
  if (opts.context_tokens > 5500) return "long_analysis";
  return null;
}