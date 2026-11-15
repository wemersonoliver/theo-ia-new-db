import { supabase } from "@/integrations/supabase/client";
export { isActiveSubscription, preferSubscription } from "../../supabase/functions/_subscription_rules";

export async function getActiveSubscription(ownerId: string, accountId?: string | null) {
  let query = supabase.from("subscriptions").select("*").eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  query = accountId
    ? query.or(`account_id.eq.${accountId},and(account_id.is.null,user_id.eq.${ownerId})`)
    : query.eq("user_id", ownerId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}