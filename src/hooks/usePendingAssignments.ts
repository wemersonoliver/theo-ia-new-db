import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/hooks/useAccount";
import { useRouletteConfig } from "@/hooks/useRouletteConfig";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "sonner";

export interface PendingAssignment {
  id: string;
  phone: string;
  contact_name: string | null;
  expires_at: string;
  assigned_at: string;
  user_id: string;
}

/**
 * Pending acceptance fluxo só fica ativo quando:
 *  - há mais de 1 membro ativo na conta
 *  - a Roleta está habilitada
 *  - require_acceptance = true
 */
export function useAcceptanceEnabled() {
  const { config } = useRouletteConfig();
  const { members } = useTeamMembers();
  const activeCount = (members || []).filter((m) => m.status === "active").length;
  return !!(config?.enabled && config?.require_acceptance && activeCount >= 2);
}

export function usePendingAssignments() {
  const { user } = useAuth();
  const { membership, isOwner, isManager } = useAccount();
  const accountId = membership?.account_id;
  const acceptanceEnabled = useAcceptanceEnabled();
  const qc = useQueryClient();

  // Pendências DESTE usuário (cards de aceite)
  const { data: myPending = [] } = useQuery({
    queryKey: ["pending-assignments", "me", accountId, user?.id],
    enabled: !!user && !!accountId && acceptanceEnabled,
    refetchInterval: 15_000,
    queryFn: async (): Promise<PendingAssignment[]> => {
      const { data, error } = await (supabase as any)
        .from("roulette_assignments")
        .select("id, phone, contact_name, expires_at, assigned_at, user_id")
        .eq("account_id", accountId)
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return (data || []) as PendingAssignment[];
    },
  });

  // Todas as pendências da conta (para esconder conversas atribuídas a outros)
  const { data: allPending = [] } = useQuery({
    queryKey: ["pending-assignments", "all", accountId],
    enabled: !!accountId && acceptanceEnabled,
    refetchInterval: 20_000,
    queryFn: async (): Promise<PendingAssignment[]> => {
      const { data, error } = await (supabase as any)
        .from("roulette_assignments")
        .select("id, phone, contact_name, expires_at, assigned_at, user_id")
        .eq("account_id", accountId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return (data || []) as PendingAssignment[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!accountId || !acceptanceEnabled) return;
    const channel = supabase
      .channel(`pending-assignments-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roulette_assignments", filter: `account_id=eq.${accountId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["pending-assignments", "me", accountId, user?.id] });
          qc.invalidateQueries({ queryKey: ["pending-assignments", "all", accountId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, user?.id, acceptanceEnabled, qc]);

  const accept = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      if (!user || !accountId) throw new Error("Sem sessão");
      const { data: assignmentId, error: rpcErr } = await (supabase as any).rpc(
        "accept_roulette_assignment",
        { _phone: phone, _user_id: user.id },
      );
      if (rpcErr) throw rpcErr;
      if (!assignmentId) {
        throw new Error("Esse atendimento expirou ou foi transferido para outro atendente.");
      }
      // Reflete em conversa, contato e deals abertos
      await supabase
        .from("whatsapp_conversations")
        .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
        .eq("account_id", accountId)
        .eq("phone", phone)
        .is("assigned_to", null);
      await supabase
        .from("contacts")
        .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
        .eq("account_id", accountId)
        .eq("phone", phone)
        .is("assigned_to", null);
      // Deals abertos do contato
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", accountId)
        .eq("phone", phone)
        .maybeSingle();
      if (contact?.id) {
        await supabase
          .from("crm_deals")
          .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
          .eq("account_id", accountId)
          .eq("contact_id", contact.id)
          .is("won_at", null)
          .is("lost_at", null)
          .is("assigned_to", null);
      }
      return assignmentId as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-assignments"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
      toast.success("Atendimento aceito! Agora é com você 🚀");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPrivilegedViewer = isOwner || isManager;

  return {
    acceptanceEnabled,
    myPending,
    allPending,
    accept,
    isPrivilegedViewer,
  };
}