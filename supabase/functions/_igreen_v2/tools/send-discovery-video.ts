import type { ToolDefinition } from "../tool-router/types.ts";

interface Args { produto: string }

export const sendDiscoveryVideoTool: ToolDefinition<Args> = {
  name: "send_discovery_video",
  description: "Marca o envio do vídeo de descoberta. Idempotente por (produto, phone).",
  idempotencyKey: (a, ctx) => `video:${a.produto}:${ctx.phone}`,
  validate: (raw) => {
    const r = raw as Args;
    if (!r?.produto) throw new Error("produto required");
    return { produto: r.produto };
  },
  execute: async (ctx, _args) => {
    const extras = (ctx.state.extras ?? {}) as Record<string, unknown>;
    if (extras.video_sent) {
      return { success: true, skipped: true, skip_reason: "state_unchanged" };
    }
    return {
      success: true,
      events: [{ type: "discovery_video_sent", priority: "medium", source: "tool", payload: {} }],
      suggested_state_patch: {
        extras: { ...extras, video_sent: true, video_sent_at: new Date().toISOString() },
      },
    };
  },
};