import type { ToolDefinition } from "../tool-router/types.ts";

export const noopTool: ToolDefinition<Record<string, never>> = {
  name: "noop",
  description: "No-op para validar pipeline de tools.",
  idempotencyKey: () => `noop`,
  execute: async () => ({
    success: true,
    events: [{ type: "noop_executed", priority: "low", source: "tool" }],
  }),
};