import type { AutomationResult, IgreenConversationState } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";

export async function mediaDispatchAutomation(args: {
  account_id: string;
  phone: string;
  media_key: string;
  state: IgreenConversationState;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "media-dispatch",
      idempotency_key: `media:${args.account_id}:${args.phone}:${args.media_key}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      const extras = (args.state.extras ?? {}) as Record<string, unknown>;
      const dispatched = Array.isArray(extras.dispatched_media) ? [...(extras.dispatched_media as unknown[])] : [];
      if (dispatched.includes(args.media_key)) {
        return { skipped: true, reason: "state_unchanged" };
      }
      dispatched.push(args.media_key);
      return {
        success: true,
        events: [{
          type: "media_dispatched", priority: "medium", source: "automation",
          payload: { media_key: args.media_key },
        }],
        suggested_state_patch: {
          extras: { ...extras, dispatched_media: dispatched },
        },
      };
    },
  );
}