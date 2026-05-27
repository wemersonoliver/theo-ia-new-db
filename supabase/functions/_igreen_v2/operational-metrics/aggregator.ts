import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export async function getRecentMetrics(account_id: string) {
  const { data } = await supa().from("igreen_phase6_metrics").select("*")
    .eq("account_id", account_id).order("bucket_hour", { ascending: false }).limit(200);
  return data ?? [];
}
