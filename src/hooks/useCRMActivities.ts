import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface CRMActivity {
  id: string;
  deal_id: string;
  user_id: string;
  account_id: string | null;
  type: string; // 'note' | 'stage_change' | 'created' | 'won' | 'lost' | 'appointment_created' | 'assigned'
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // joined
  author_name?: string | null;
}

export function useCRMActivities(dealId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["crm-activities", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<CRMActivity[]> => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((a: any) => a.user_id).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        nameMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.user_id, p.full_name || p.email || "Usuário"])
        );
      }
      return (data || []).map((a: any) => ({
        ...a,
        author_name: nameMap[a.user_id] || null,
      }));
    },
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !dealId) throw new Error("Sem contexto");
      const ctx = await resolveAccountContext(user.id);
      const { error } = await supabase.from("crm_activities").insert({
        deal_id: dealId,
        user_id: user.id,
        account_id: ctx?.accountId,
        type: "note",
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-activities", dealId] });
      toast.success("Anotação adicionada");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return { activities, isLoading, addNote };
}

/** Helper standalone para inserir eventos automáticos (sem hook). */
export async function logDealActivity(
  dealId: string,
  userId: string,
  type: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  try {
    const ctx = await resolveAccountContext(userId);
    await supabase.from("crm_activities").insert({
      deal_id: dealId,
      user_id: userId,
      account_id: ctx?.accountId,
      type,
      content,
      metadata: (metadata ?? {}) as any,
    });
  } catch (e) {
    console.warn("[logDealActivity] failed", e);
  }
}