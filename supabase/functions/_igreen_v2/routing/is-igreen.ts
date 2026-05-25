// D13 — roteamento estrito por accounts.is_igreen.
// Único ponto que decide se a vertical Igreen V2 deve processar a mensagem.

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

export async function isIgreenAccount(accountId: string): Promise<boolean> {
  if (!accountId) return false;
  const { data, error } = await svc()
    .from("accounts")
    .select("is_igreen")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    console.error("[igreen_v2] isIgreenAccount error", error);
    return false;
  }
  return !!data?.is_igreen;
}