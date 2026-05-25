import type { ToolDefinition } from "../tool-router/types.ts";

interface Args { produto: "green" | "telecom" | "expansao" }

export const setProductTool: ToolDefinition<Args> = {
  name: "set_product",
  description: "Define o produto principal da conversa e move o funil para qualificacao.",
  idempotencyKey: (a) => `set_product:${a.produto}`,
  validate: (raw) => {
    const r = raw as Args;
    if (!r || !["green", "telecom", "expansao"].includes(r.produto)) {
      throw new Error("produto must be one of: green, telecom, expansao");
    }
    return { produto: r.produto };
  },
  execute: async (ctx, args) => {
    if (ctx.state.produto === args.produto) {
      return { success: true, skipped: true, skip_reason: "state_unchanged" };
    }
    return {
      success: true,
      events: [{ type: "product_selected", priority: "medium", source: "tool",
        payload: { produto: args.produto } }],
      suggested_state_patch: {
        produto: args.produto,
        etapa_funil: "qualificacao",
      },
    };
  },
};