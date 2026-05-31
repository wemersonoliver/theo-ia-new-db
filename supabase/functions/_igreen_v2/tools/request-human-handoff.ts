// Tool request_human_handoff — pausa IA e marca handoff ativo.
// IA NÃO envia mais texto no mesmo turno (specialist deve checar e silenciar).

import type { ToolDefinition } from "../tool-router/types.ts";
import type { ToolResult } from "../types.ts";

interface Args { reason?: string }

export const requestHumanHandoffTool: ToolDefinition<Args> = {
  name: "request_human_handoff",
  description: "Solicita transferência para humano: marca handoff_ativo=true, pausa IA, move funil para handoff.",
  idempotencyKey: (_a, ctx) => `handoff:${ctx.phone}`,
  validate: (raw) => ({ reason: ((raw as Args)?.reason ?? "").toString().slice(0, 200) || undefined }),
  execute: async (ctx, args): Promise<ToolResult> => {
    if (ctx.state.handoff_ativo) {
      return { success: true, skipped: true, skip_reason: "handoff_already_active" };
    }
    return {
      success: true,
      events: [{
        type: "handoff_requested", priority: "critical", source: "tool",
        payload: { reason: args.reason ?? null },
      }],
      suggested_state_patch: {
        handoff_ativo: true,
        etapa_funil: "handoff",
      },
      data: { handoff: true },
    };
  },
};