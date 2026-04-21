import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AccountRole = "owner" | "manager" | "seller" | "agent";

export interface AccountMembership {
  account_id: string;
  account_name: string;
  owner_user_id: string;
  role: AccountRole;
  permissions: Record<string, boolean>;
  status: string;
}

const ROLE_DEFAULT_PERMS: Record<AccountRole, string[]> = {
  owner: [
    "conversations", "crm", "contacts", "appointments", "appointment_settings",
    "knowledge_base", "ai_config", "whatsapp_instance", "team_management",
    "billing", "settings", "support", "view_all_assigned",
  ],
  manager: [
    "conversations", "crm", "contacts", "appointments", "appointment_settings",
    "knowledge_base", "ai_config", "whatsapp_instance", "settings", "support",
    "view_all_assigned",
  ],
  seller: ["conversations", "crm", "contacts", "appointments", "settings", "support"],
  agent: ["conversations", "appointments", "contacts", "settings", "support"],
};

export function hasPermission(membership: AccountMembership | null | undefined, perm: string): boolean {
  if (!membership) return false;
  if (Object.prototype.hasOwnProperty.call(membership.permissions, perm)) {
    return !!membership.permissions[perm];
  }
  return ROLE_DEFAULT_PERMS[membership.role]?.includes(perm) ?? false;
}

export function useAccount() {
  const { user } = useAuth();

  const { data: membership, isLoading } = useQuery({
    queryKey: ["account-membership", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccountMembership | null> => {
      const { data, error } = await supabase
        .from("account_members")
        .select("account_id, role, permissions, status, accounts!inner(id, name, owner_user_id)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      const acc = (data as any).accounts;
      return {
        account_id: data.account_id,
        account_name: acc?.name || "",
        owner_user_id: acc?.owner_user_id,
        role: data.role as AccountRole,
        permissions: (data.permissions as Record<string, boolean>) || {},
        status: data.status,
      };
    },
  });

  const isOwner = membership?.role === "owner";
  const isManager = membership?.role === "manager";
  const isMember = !!membership;

  const can = (perm: string) => hasPermission(membership, perm);

  return { membership, isLoading, isOwner, isManager, isMember, can };
}

/**
 * Hook utilitário: retorna apenas o account_id e ownerId do usuário logado.
 * Útil para hooks de queries que precisam filtrar por account_id.
 */
export function useAccountId() {
  const { membership, isLoading } = useAccount();
  return {
    accountId: membership?.account_id ?? null,
    ownerId: membership?.owner_user_id ?? null,
    isLoading,
  };
}