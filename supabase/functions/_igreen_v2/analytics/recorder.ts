import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export async function recordMetric(opts: {
  account_id?: string | null; correlation_id?: string | null;
  metric: string; value: number; dims?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supa().from("igreen_operational_metrics").insert({
      account_id: opts.account_id ?? null, correlation_id: opts.correlation_id ?? null,
      metric: opts.metric, value: opts.value, dims: opts.dims ?? {},
    });
  } catch (e) { console.error("[analytics] recordMetric failed", e); }
}
