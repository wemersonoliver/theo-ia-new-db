// Tool add_contact_tag — registra movimento de etapa CRM como evento + flag em extras.
// Implementação mínima: emite evento e patcha extras.tags. O CRM consome o evento.

import type { ToolDefinition } from "../tool-router/types.ts";
import type { ToolResult } from "../types.ts";

const ALLOWED_TAGS = new Set([
  "em atendimento",
  "enviou fatura",
  "enviou documento",
  "objection_security",
  "auto_cadastro_enviado",
]);

interface Args { tag: string }

export const addContactTagTool: ToolDefinition<Args> = {
  name: "add_contact_tag",
  description: "Adiciona uma tag/etiqueta de etapa ao contato (move o card no CRM).",
  idempotencyKey: (a, ctx) => `tag:${ctx.phone}:${(a.tag ?? "").toLowerCase()}`,
  validate: (raw) => {
    const r = (raw ?? {}) as Args;
    const tag = String(r.tag ?? "").toLowerCase().trim();
    if (!tag) throw new Error("tag required");
    if (!ALLOWED_TAGS.has(tag)) throw new Error(`tag must be one of: ${[...ALLOWED_TAGS].join(", ")}`);
    return { tag };
  },
  execute: async (ctx, args): Promise<ToolResult> => {
    const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(currentExtras.tags) ? (currentExtras.tags as string[]) : [];
    if (existing.includes(args.tag)) {
      return { success: true, skipped: true, skip_reason: "tag_already_present" };
    }
    return {
      success: true,
      events: [{
        type: "contact_tag_added", priority: "medium", source: "tool",
        payload: { tag: args.tag },
      }],
      suggested_state_patch: {
        extras: { ...currentExtras, tags: [...existing, args.tag] },
      },
      data: { tag: args.tag },
    };
  },
};