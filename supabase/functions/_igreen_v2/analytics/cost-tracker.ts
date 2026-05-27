import { recordMetric } from "./recorder.ts";
export async function trackTurnCost(opts: {
  account_id: string; correlation_id: string;
  estimated_cost_cents: number; estimated_savings_cents: number; model: string;
}): Promise<void> {
  await Promise.all([
    recordMetric({ account_id: opts.account_id, correlation_id: opts.correlation_id, metric: "cost.turn_cents", value: opts.estimated_cost_cents, dims: { model: opts.model } }),
    recordMetric({ account_id: opts.account_id, correlation_id: opts.correlation_id, metric: "cost.turn_savings_cents", value: opts.estimated_savings_cents, dims: { model: opts.model } }),
  ]);
}
