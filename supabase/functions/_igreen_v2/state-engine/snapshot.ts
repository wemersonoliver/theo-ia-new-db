// Snapshot do state — usado em torno da validação documental (D9).
// Não escreve em igreen_conversation_state — apenas grava cópia em igreen_state_snapshots.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadState } from "./update.ts";

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

export async function snapshot(args: {
  account_id: string;
  phone: string;
  label: string;
  correlation_id?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    const state = await loadState(args.account_id, args.phone);
    await svc().from("igreen_state_snapshots").insert({
      account_id: args.account_id,
      phone: args.phone,
      reason: args.label,
      state: {
        ...(state ?? {}),
        _snapshot: {
          label: args.label,
          correlation_id: args.correlation_id ?? null,
          ...(args.extra ?? {}),
        },
      },
    });
  } catch (e) {
    console.error("[state-engine:snapshot] failed (non-blocking)", e);
  }
}