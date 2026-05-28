// D5+ — auditoria comportamental observacional do supervisor.
// Best-effort: nenhum erro pode quebrar o fluxo principal.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

export interface BehaviorAuditEntry {
  correlation_id?: string | null;
  account_id: string;
  phone: string;
  specialist_before?: string | null;
  specialist_after?: string | null;
  intent?: string | null;
  confidence?: number | null;
  decision_source?: string | null;
  trigger_reason?: string | null;
  conversation_snapshot?: Record<string, unknown>;
}

export async function auditDecision(entry: BehaviorAuditEntry): Promise<void> {
  try {
    await svc().from("igreen_behavior_audits").insert({
      correlation_id: entry.correlation_id ?? null,
      account_id: entry.account_id,
      phone: entry.phone,
      specialist_before: entry.specialist_before ?? null,
      specialist_after: entry.specialist_after ?? null,
      intent: entry.intent ?? null,
      confidence: entry.confidence ?? null,
      decision_source: entry.decision_source ?? null,
      trigger_reason: entry.trigger_reason ?? null,
      conversation_snapshot: entry.conversation_snapshot ?? {},
    });
  } catch (e) {
    console.error("[igreen_v2] auditDecision failed (non-blocking)", e);
  }
}