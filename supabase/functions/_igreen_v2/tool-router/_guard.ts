// D4 — lock de execução em igreen_tool_locks.
// Conflito = outra execução em curso → retornamos null e o caller faz skip.

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

export interface LockHandle {
  id: string;
}

export async function acquireLock(args: {
  account_id: string;
  phone: string;
  tool: string;
  lock_key: string;
  ttl_seconds?: number;
}): Promise<LockHandle | null> {
  const ttl = args.ttl_seconds ?? 60;
  const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
  const { data, error } = await svc()
    .from("igreen_tool_locks")
    .insert({
      account_id: args.account_id,
      phone: args.phone,
      tool: args.tool,
      lock_key: args.lock_key,
      expires_at,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function releaseLock(handle: LockHandle | null): Promise<void> {
  if (!handle) return;
  await svc().from("igreen_tool_locks").delete().eq("id", handle.id);
}