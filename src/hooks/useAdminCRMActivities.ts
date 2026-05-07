import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface AdminCRMActivity {
  id: string;
  deal_id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export function useAdminCRMActivities(dealId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["admin-crm-activities", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<AdminCRMActivity[]> => {
      const { data, error } = await supabase
        .from("admin_crm_activities" as any)
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdminCRMActivity[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !dealId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("admin_crm_activities" as any)
        .insert({ deal_id: dealId, type: "note", content, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crm-activities", dealId] });
    },
    onError: (e: Error) => toast.error(`Erro ao adicionar nota: ${e.message}`),
  });

  return { activities, isLoading, addNote };
}