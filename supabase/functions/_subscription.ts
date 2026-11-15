import { resolveAccountId } from "./_account.ts";

// Account-scoped subscriptions plus legacy owner records without account_id.
export async function activeAccountSubscription(client: any, accountId: string | null, ownerId: string) {
  let query = client.from("subscriptions").select("*").eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  query = accountId
    ? query.or(`account_id.eq.${accountId},and(account_id.is.null,user_id.eq.${ownerId})`)
    : query.eq("user_id", ownerId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function userSubscriptionContext(client: any, userId: string) {
  const accountId = await resolveAccountId(client, userId);
  if (!accountId) return { accountId: null, ownerId: userId };
  const { data, error } = await client.from("accounts").select("owner_user_id").eq("id", accountId).single();
  if (error) throw error;
  return { accountId, ownerId: data.owner_user_id as string };
}