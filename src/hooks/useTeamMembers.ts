import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, AccountRole } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface TeamMember {
  id: string;
  account_id: string;
  user_id: string;
  role: AccountRole;
  permissions: Record<string, boolean>;
  status: string;
  invited_at: string;
  last_seen_at: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

export function useTeamMembers() {
  const { membership, isOwner } = useAccount();
  const qc = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", membership?.account_id],
    enabled: !!membership,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("account_members")
        .select("id, account_id, user_id, role, permissions, status, invited_at, last_seen_at")
        .eq("account_id", membership!.account_id)
        .neq("status", "removed")
        .order("invited_at", { ascending: true });
      if (error) throw error;

      const userIds = (data || []).map((m) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      return (data || []).map((m) => {
        const p = profiles?.find((x) => x.user_id === m.user_id);
        return {
          ...m,
          permissions: (m.permissions as Record<string, boolean>) || {},
          role: m.role as AccountRole,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
        };
      });
    },
  });

  const invite = useMutation({
    mutationFn: async (input: {
      full_name: string;
      phone: string;
      email?: string;
      role: "manager" | "seller" | "agent";
      permissions?: Record<string, boolean>;
    }) => {
      const { data, error } = await supabase.functions.invoke("team-manage", {
        body: { action: "invite", ...input },
      });
      if (error) throw new Error(error.message || "Erro ao convidar");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", membership?.account_id] });
      toast.success("Membro convidado! Senha enviada por WhatsApp.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: {
      member_id: string;
      role?: "manager" | "seller" | "agent";
      permissions?: Record<string, boolean>;
      status?: "active" | "suspended";
    }) => {
      const { data, error } = await supabase.functions.invoke("team-manage", {
        body: { action: "update", ...input },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", membership?.account_id] });
      toast.success("Membro atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (member_id: string) => {
      const { data, error } = await supabase.functions.invoke("team-manage", {
        body: { action: "remove", member_id },
      });
      if (error) throw new Error(error.message || "Erro");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", membership?.account_id] });
      toast.success("Membro removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async (member_id: string) => {
      const { data, error } = await supabase.functions.invoke("team-manage", {
        body: { action: "reset_password", member_id },
      });
      if (error) throw new Error(error.message || "Erro");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => toast.success("Nova senha enviada por WhatsApp."),
    onError: (e: Error) => toast.error(e.message),
  });

  return { members, isLoading, invite, update, remove, resetPassword, canManage: isOwner };
}