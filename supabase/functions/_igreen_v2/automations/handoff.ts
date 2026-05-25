import type { IgreenEvent, AutomationResult } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";

export async function handoffAutomation(args: {
  account_id: string;
  phone: string;
  reason: string;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "handoff",
      idempotency_key: `handoff:${args.account_id}:${args.phone}:${args.reason}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      const events: IgreenEvent[] = [{
        type: "handoff_triggered", priority: "critical", source: "automation",
        payload: { reason: args.reason },
      }];
      return {
        success: true,
        events,
        suggested_state_patch: { handoff_ativo: true, specialist: "failsafe" },
      };
    },
  );
}