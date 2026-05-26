// Phase 5 — Media queue FIFO por phone via lock em igreen_locks.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

const LOCK_TTL_SEC = 60;

export interface AcquiredLock {
  key: string;
  holder: string;
  acquired: boolean;
}

/**
 * Atomic acquire usando upsert ignoreDuplicates + double-check.
 * Funciona contra a tabela igreen_locks já existente da Fase 4.
 */
export async function acquireTransportLock(phone: string, ttlSec = LOCK_TTL_SEC): Promise<AcquiredLock> {
  const key = `transport:${phone}`;
  const holder = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expires = new Date(Date.now() + ttlSec * 1000).toISOString();
  // Tenta liberar locks expirados antes
  try {
    await svc().from("igreen_locks").delete().lt("expires_at", new Date().toISOString());
  } catch { /* ignore */ }
  const { error } = await svc().from("igreen_locks").insert({
    lock_key: key,
    holder,
    expires_at: expires,
  });
  if (error) return { key, holder, acquired: false };
  return { key, holder, acquired: true };
}

export async function releaseTransportLock(lock: AcquiredLock): Promise<void> {
  if (!lock.acquired) return;
  try {
    await svc().from("igreen_locks").delete().eq("lock_key", lock.key).eq("holder", lock.holder);
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