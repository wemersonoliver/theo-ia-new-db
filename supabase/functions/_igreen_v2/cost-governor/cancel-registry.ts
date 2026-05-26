// Phase 5 — Cancel registry. Cancela follow-ups quando lead responde.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export async function registerCancellation(args: {
  correlation_id: string;
  account_id?: string | null;
  phone?: string | null;
  reason?: string;
}) {
  try {
    await svc().from("igreen_cancellations").upsert({
      correlation_id: args.correlation_id,
      account_id: args.account_id ?? null,
      phone: args.phone ?? null,
      reason: args.reason ?? "lead_replied",
      cancelled_at: new Date().toISOString(),
    }, { onConflict: "correlation_id" });
  } catch (e) {
    console.error("[igreen_v2:cancel] register failed", e);
  }
}

export async function isCancelled(correlation_id: string): Promise<boolean> {
  try {
    const { data } = await svc()
      .from("igreen_cancellations")
      .select("correlation_id")
      .eq("correlation_id", correlation_id)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}