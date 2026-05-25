import type { ToolDefinition } from "../tool-router/types.ts";

interface Args { etapa: string }

export const setStageTool: ToolDefinition<Args> = {
  name: "set_stage",
  description: "Wrapper para alterar etapa_funil (validada pelo state-engine).",
  idempotencyKey: (a, ctx) => `set_stage:${ctx.phone}:${a.etapa}`,
  validate: (raw) => {
    const r = raw as Args;
    if (!r?.etapa) throw new Error("etapa required");
    return { etapa: r.etapa };
  },
  execute: async (ctx, args) => {
    if ((ctx.state.etapa_funil ?? "").toLowerCase() === args.etapa.toLowerCase()) {
      return { success: true, skipped: true, skip_reason: "state_unchanged" };
    }
    return {
      success: true,
      events: [{
        type: "stage_changed_by_tool", priority: "medium", source: "tool",
        payload: { from: ctx.state.etapa_funil ?? null, to: args.etapa },
      }],
      suggested_state_patch: { etapa_funil: args.etapa },
    };
  },
};