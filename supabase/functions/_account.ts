// Shared helper to resolve account_id from a user_id within Edge Functions.
// Caches results in-memory for the lifetime of the function instance.

type SupabaseClient = any;

const cache = new Map<string, string | null>();

/**
 * Resolves the account_id that owns/contains the given user_id.
 * - For account owners → returns their own account.
 * - For invited members (seller/agent/manager) → returns the owner's account.
 * Returns null if the user is not part of any account.
 */
export async function resolveAccountId(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId) ?? null;

  try {
    const { data, error } = await supabase
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("resolveAccountId error:", error);
      cache.set(userId, null);
      return null;
    }

    const accountId = (data?.account_id as string | undefined) ?? null;
    cache.set(userId, accountId);
    return accountId;
  } catch (e) {
    console.error("resolveAccountId exception:", e);
    return null;
  }
}

/** Convenience: returns `{ account_id }` partial for spreading into inserts. */
export async function withAccount(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<{ account_id: string | null }> {
  return { account_id: await resolveAccountId(supabase, userId) };
}