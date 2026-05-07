import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface AdminCRMDealTask {
  id: string;
  deal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdminCRMDealTasks(dealId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["admin-crm-deal-tasks", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<AdminCRMDealTask[]> => {
      const { data, error } = await supabase
        .from("admin_crm_deal_tasks" as any)
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data as unknown) || []) as AdminCRMDealTask[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-crm-deal-tasks", dealId] });

  const createTask = useMutation({
    mutationFn: async (input: { title: string; description?: string | null; due_date?: string | null }) => {
      if (!user || !dealId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("admin_crm_deal_tasks" as any)
        .insert({
          deal_id: dealId,
          title: input.title,
          description: input.description ?? null,
          due_date: input.due_date ?? null,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(`Erro ao criar tarefa: ${e.message}`),
  });

  const toggleTask = useMutation({
    mutationFn: async (task: AdminCRMDealTask) => {
      if (!user) throw new Error("Sem usuário");
      const completing = !task.completed;
      const { error } = await supabase
        .from("admin_crm_deal_tasks" as any)
        .update({
          completed: completing,
          completed_at: completing ? new Date().toISOString() : null,
          completed_by: completing ? user.id : null,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_crm_deal_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa removida");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return { tasks, isLoading, createTask, toggleTask, deleteTask };
}