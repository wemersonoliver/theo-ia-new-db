// D5 — observabilidade obrigatória.
// Emite traces (com nível) e events (com prioridade) para igreen_traces / igreen_state_events.
// Failsafe-friendly: nenhum erro de log pode quebrar o fluxo principal.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EventPriority, IgreenEvent, TraceLevel } from "../types.ts";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

export async function getTraceLevel(accountId: string): Promise<TraceLevel> {
  try {
    const { data } = await svc()
      .from("igreen_observability_config")
      .select("trace_level")
      .eq("account_id", accountId)
      .maybeSingle();
    return (data?.trace_level as TraceLevel) ?? "standard";
  } catch {
    return "standard";
  }
}

export async function trace(params: {
  account_id: string;
  phone?: string | null;
  step: string;
  level?: TraceLevel;
  payload?: Record<string, unknown>;
  duration_ms?: number;
}): Promise<void> {
  try {
    await svc().from("igreen_traces").insert({
      account_id: params.account_id,
      phone: params.phone ?? null,
      trace_level: params.level ?? "standard",
      step: params.step,
      payload: params.payload ?? {},
      duration_ms: params.duration_ms ?? null,
    });
  } catch (e) {
    console.error("[igreen_v2] trace failed (non-blocking)", e);
  }
}

export async function emitEvents(
  account_id: string,
  phone: string,
  events: IgreenEvent[] | undefined,
): Promise<void> {
  if (!events || events.length === 0) return;
  try {
    await svc().from("igreen_state_events").insert(
      events.map((e) => ({
        account_id,
        phone,
        event_type: e.type,
        event_priority: (e.priority ?? "medium") as EventPriority,
        payload: e.payload ?? {},
        source: e.source ?? null,
      })),
    );
  } catch (e) {
    console.error("[igreen_v2] emitEvents failed (non-blocking)", e);
  }
}