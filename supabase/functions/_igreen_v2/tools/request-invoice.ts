import type { ToolDefinition } from "../tool-router/types.ts";

interface Args { reason?: string }

export const requestInvoiceTool: ToolDefinition<Args> = {
  name: "request_invoice",
  description: "Solicita a fatura ao cliente e move o funil para fatura_enviada.",
  idempotencyKey: (_a, ctx) => `request_invoice:${ctx.phone}:${ctx.state.etapa_funil ?? "novo"}`,
  validate: (raw) => (raw ?? {}) as Args,
  execute: async (ctx, args) => {
    const etapa = (ctx.state.etapa_funil ?? "novo").toLowerCase();
    if (etapa === "fatura_enviada" || etapa === "fatura_validada") {
      return { success: true, skipped: true, skip_reason: "state_unchanged" };
    }
    return {
      success: true,
      events: [{
        type: "invoice_requested", priority: "medium", source: "tool",
        payload: { reason: args.reason ?? null },
      }],
      suggested_state_patch: { etapa_funil: "fatura_enviada" },
    };
  },
};