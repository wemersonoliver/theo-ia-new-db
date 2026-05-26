// Phase 5 — Media queue FIFO por phone via lock em igreen_tool_locks (reuso Fase 4).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

const LOCK_TTL_SEC = 60;

export interface AcquiredLock {
  id: string | null;
  lock_key: string;
  acquired: boolean;
}

export async function acquireTransportLock(phone: string, ttlSec = LOCK_TTL_SEC): Promise<AcquiredLock> {
  const lock_key = `transport:${phone}`;
  const expires = new Date(Date.now() + ttlSec * 1000).toISOString();
  try {
    await svc().from("igreen_tool_locks").delete().lt("expires_at", new Date().toISOString());
  } catch { /* ignore */ }
  const { data, error } = await svc().from("igreen_tool_locks").insert({
    account_id: "00000000-0000-0000-0000-000000000000",
    phone,
    tool: "transport",
    lock_key,
    expires_at: expires,
  }).select("id").maybeSingle();
  if (error || !data) return { id: null, lock_key, acquired: false };
  return { id: (data as { id: string }).id, lock_key, acquired: true };
}

export async function releaseTransportLock(lock: AcquiredLock): Promise<void> {
  if (!lock.acquired || !lock.id) return;
  try {
    await svc().from("igreen_tool_locks").delete().eq("id", lock.id);
  } catch { /* ignore */ }
}

/** Espera ativa simples — retorna após adquirir ou timeoutMs. */
export async function waitForLock(phone: string, timeoutMs = 30_000): Promise<AcquiredLock | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const lock = await acquireTransportLock(phone);
    if (lock.acquired) return lock;
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
  }
  return null;
}