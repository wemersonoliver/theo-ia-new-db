import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { logDealActivity } from "@/hooks/useCRMActivities";
import { toast } from "sonner";

export interface TaskWithRelations {
  id: string;
  deal_id: string;
  user_id: string;
  account_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  deal_title?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
}

export function useAllTasks() {
  const { user } = useAuth();
  const { membership } = useAccount();
  const qc = useQueryClient();

  const accountId = membership?.account_id ?? null;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks", accountId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TaskWithRelations[]> => {
      let query = supabase
        .from("crm_deal_tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (accountId) {
        query = query.eq("account_id", accountId);
      } else {
        query = query.eq("user_id", user!.id);
      }

      const { data: rows, error } = await query.limit(1000);
      if (error) throw error;

      const dealIds = Array.from(new Set((rows || []).map((r) => r.deal_id).filter(Boolean)));
      const userIds = Array.from(
        new Set(
          (rows || [])
            .flatMap((r) => [r.assigned_to, r.user_id])
            .filter(Boolean) as string[]
        )
      );

      const [dealsRes, profilesRes] = await Promise.all([
        dealIds.length > 0
          ? supabase.from("crm_deals").select("id, title").in("id", dealIds)
          : Promise.resolve({ data: [] as any[], error: null } as any),
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[], error: null } as any),
      ]);

      const dealMap = new Map<string, string>();
      (dealsRes.data || []).forEach((d: any) => dealMap.set(d.id, d.title));
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      (profilesRes.data || []).forEach((p: any) =>
        profileMap.set(p.user_id, { full_name: p.full_name, email: p.email })
      );

      return (rows || []).map((r: any) => {
        const ownerProfile = profileMap.get(r.assigned_to ?? r.user_id);
        return {
          ...r,
          deal_title: dealMap.get(r.deal_id) ?? null,
          assignee_name: ownerProfile?.full_name ?? null,
          assignee_email: ownerProfile?.email ?? null,
        } as TaskWithRelations;
      });
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["crm-deal-tasks"] });
    qc.invalidateQueries({ queryKey: ["crm-deal-tasks-counts"] });
  };

  const toggleTask = useMutation({
    mutationFn: async (task: TaskWithRelations) => {
      if (!user) throw new Error("Sem usuário");
      const completing = !task.completed;
      const { error } = await supabase
        .from("crm_deal_tasks")
        .update({
          completed: completing,
          completed_at: completing ? new Date().toISOString() : null,
          completed_by: completing ? user.id : null,
        })
        .eq("id", task.id);
      if (error) throw error;
      logDealActivity(
        task.deal_id,
        user.id,
        "note",
        completing ? `✅ Tarefa concluída: ${task.title}` : `↩️ Tarefa reaberta: ${task.title}`
      );
    },
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["all-tasks"] });
      const previous = qc.getQueriesData<TaskWithRelations[]>({ queryKey: ["all-tasks"] });
      qc.setQueriesData<TaskWithRelations[]>({ queryKey: ["all-tasks"] }, (old = []) =>
        (old || []).map((t) =>
          t.id === task.id ? { ...t, completed: !t.completed } : t
        )
      );
      return { previous };
    },
    onError: (e: Error, _task, ctx) => {
      ctx?.previous?.forEach(([key, val]) => qc.setQueryData(key, val));
      toast.error(`Erro: ${e.message}`);
    },
    onSettled: () => invalidate(),
  });

  const createTask = useMutation({
    mutationFn: async (input: {
      deal_id: string;
      title: string;
      description?: string | null;
      due_date?: string | null;
      assigned_to?: string | null;
    }) => {
      if (!user) throw new Error("Sem usuário");
      const ctx = await resolveAccountContext(user.id);
      const { data, error } = await supabase
        .from("crm_deal_tasks")
        .insert({
          deal_id: input.deal_id,
          user_id: user.id,
          account_id: ctx?.accountId,
          assigned_to: input.assigned_to ?? null,
          title: input.title,
          description: input.description ?? null,
          due_date: input.due_date ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      logDealActivity(input.deal_id, user.id, "note", `📋 Tarefa criada: ${input.title}`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskWithRelations> }) => {
      const { error } = await supabase.from("crm_deal_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa atualizada");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_deal_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa removida");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return { tasks, isLoading, toggleTask, createTask, updateTask, deleteTask };
}