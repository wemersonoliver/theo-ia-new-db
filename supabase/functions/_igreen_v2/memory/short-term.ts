// Phase 5 — Memory short-term. Janela de N=12 com TTL 24h.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { maskAll } from "./pii-guard.ts";
import { estimateTokens } from "../cost-governor/token-budget.ts";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export const SHORT_TERM_N = 12;
export const SHORT_TERM_TTL_HOURS = 24;

export interface MemoryMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at?: string;
  token_count?: number;
}

export async function appendMessage(args: {
  account_id: string;
  phone: string;
  role: MemoryMessage["role"];
  content: string;
  correlation_id?: string | null;
}) {
  const masked = maskAll(args.content);
  try {
    await svc().from("igreen_memory_window").insert({
      account_id: args.account_id,
      phone: args.phone,
      role: args.role,
      content: masked,
      correlation_id: args.correlation_id ?? null,
      token_count: estimateTokens(masked),
      expires_at: new Date(Date.now() + SHORT_TERM_TTL_HOURS * 3600 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[memory:short-term] append failed", e);
  }
}

export async function getWindow(account_id: string, phone: string, n = SHORT_TERM_N): Promise<MemoryMessage[]> {
  try {
    const { data } = await svc()
      .from("igreen_memory_window")
      .select("role,content,created_at,token_count")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(n);
    const arr = (data ?? []) as MemoryMessage[];
    return arr.reverse();
  } catch {
    return [];
  }
}

export async function pruneExpired(account_id?: string): Promise<number> {
  try {
    const q = svc().from("igreen_memory_window").delete().lt("expires_at", new Date().toISOString());
    const { count } = account_id ? await q.eq("account_id", account_id).select("*", { count: "exact", head: true }) : await q.select("*", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getOldestForSummary(account_id: string, phone: string, keepRecent = SHORT_TERM_N, batch = 8): Promise<MemoryMessage[]> {
  try {
    const { data } = await svc()
      .from("igreen_memory_window")
      .select("id,role,content,created_at,token_count")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Array<MemoryMessage & { id: string }>;
    if (rows.length <= keepRecent) return [];
    return rows.slice(0, Math.min(batch, rows.length - keepRecent));
  } catch {
    return [];
  }
}