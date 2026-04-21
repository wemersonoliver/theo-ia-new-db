import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a account_id e o owner_user_id para o usuário logado.
 * Cacheado em memória durante a sessão.
 */
let cache: { userId: string; accountId: string; ownerId: string } | null = null;

export async function resolveAccountContext(userId: string): Promise<{ accountId: string; ownerId: string } | null> {
  if (cache && cache.userId === userId) {
    return { accountId: cache.accountId, ownerId: cache.ownerId };
  }

  const { data, error } = await supabase
    .from("account_members")
    .select("account_id, accounts!inner(owner_user_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const accountId = data.account_id as string;
  const ownerId = (data as any).accounts?.owner_user_id as string;
  cache = { userId, accountId, ownerId };
  return { accountId, ownerId };
}

export function clearAccountContextCache() {
  cache = null;
}