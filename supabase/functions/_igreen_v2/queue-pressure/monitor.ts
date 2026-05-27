import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { trace } from "../observability/trace.ts";
const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type PressureLevel = "low" | "medium" | "high" | "critical";
export type Mode = "normal" | "degraded" | "shed_load";
export interface PressureSnapshot { pressure_level: PressureLevel; in_flight: number; queued: number; mode: Mode }
const THRESHOLDS = { medium: 10, high: 25, critical: 50 };

export async function measurePressure(account_id: string): Promise<PressureSnapshot> {
  const since = new Date(Date.now() - 30_000).toISOString();
  let in_flight = 0;
  try {
    const { count } = await supa().from("igreen_traces").select("id", { count: "exact", head: true })
      .eq("account_id", account_id).eq("step", "agent.received").gte("created_at", since);
    in_flight = count ?? 0;
  } catch {}
  let level: PressureLevel = "low";
  if (in_flight >= THRESHOLDS.critical) level = "critical";
  else if (in_flight >= THRESHOLDS.high) level = "high";
  else if (in_flight >= THRESHOLDS.medium) level = "medium";
  const mode: Mode = level === "critical" ? "shed_load" : level === "high" ? "degraded" : "normal";
  const snap: PressureSnapshot = { pressure_level: level, in_flight, queued: 0, mode };
  try { await supa().from("igreen_queue_pressure").insert({ account_id, pressure_level: level, in_flight, queued: 0, mode }); } catch {}
  if (level === "high" || level === "critical") {
    await trace({ account_id, step: "queue.pressure_high", level: "minimal", payload: snap as any });
  }
  return snap;
}
