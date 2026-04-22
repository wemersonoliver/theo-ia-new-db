import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveAccountContext } from "@/lib/account-context";
import { logDealActivity } from "@/hooks/useCRMActivities";
import { toast } from "sonner";

export interface CRMDealTask {
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
}

export function useCRMDealTasks(dealId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm-deal-tasks", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<CRMDealTask[]> => {
      const { data, error } = await supabase
        .from("crm_deal_tasks")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CRMDealTask[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-deal-tasks", dealId] });
    qc.invalidateQueries({ queryKey: ["crm-deal-tasks-counts"] });
  };

  const createTask = useMutation({
    mutationFn: async (input: { title: string; due_date?: string | null; assigned_to?: string | null; description?: string | null }) => {
      if (!user || !dealId) throw new Error("Sem contexto");
      const ctx = await resolveAccountContext(user.id);
      const { data, error } = await supabase
        .from("crm_deal_tasks")
        .insert({
          deal_id: dealId,
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
      logDealActivity(dealId, user.id, "note", `📋 Tarefa criada: ${input.title}`);
      return data as CRMDealTask;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(`Erro ao criar tarefa: ${e.message}`),
  });

  const toggleTask = useMutation({
    mutationFn: async (task: CRMDealTask) => {
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
      if (dealId) {
        logDealActivity(
          dealId,
          user.id,
          "note",
          completing ? `✅ Tarefa concluída: ${task.title}` : `↩️ Tarefa reaberta: ${task.title}`
        );
      }
    },
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["crm-deal-tasks", dealId] });
      const previous = qc.getQueryData<CRMDealTask[]>(["crm-deal-tasks", dealId]);
      qc.setQueryData<CRMDealTask[]>(["crm-deal-tasks", dealId], (old = []) =>
        old.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t))
      );
      return { previous };
    },
    onError: (e: Error, _task, ctx) => {
      if (ctx?.previous) qc.setQueryData(["crm-deal-tasks", dealId], ctx.previous);
      toast.error(`Erro: ${e.message}`);
    },
    onSettled: () => invalidate(),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CRMDealTask> }) => {
      const { error } = await supabase.from("crm_deal_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
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

  return { tasks, isLoading, createTask, toggleTask, updateTask, deleteTask };
}

export interface DealTaskCounts {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
}

/** Hook para buscar contadores agregados de tarefas por deal (usado nos cards do Kanban) */
export function useCRMDealTasksCounts(dealIds: string[]) {
  return useQuery({
    queryKey: ["crm-deal-tasks-counts", dealIds.slice().sort().join(",")],
    enabled: dealIds.length > 0,
    queryFn: async (): Promise<Record<string, DealTaskCounts>> => {
      const { data, error } = await supabase
        .from("crm_deal_tasks")
        .select("deal_id, completed, due_date")
        .in("deal_id", dealIds);
      if (error) throw error;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;

      const map: Record<string, DealTaskCounts> = {};
      for (const id of dealIds) {
        map[id] = { total: 0, completed: 0, overdue: 0, dueToday: 0 };
      }
      for (const row of data || []) {
        const counts = map[row.deal_id];
        if (!counts) continue;
        counts.total += 1;
        if (row.completed) {
          counts.completed += 1;
        } else if (row.due_date) {
          const ts = new Date(row.due_date).getTime();
          if (ts < todayStart) counts.overdue += 1;
          else if (ts >= todayStart && ts < todayEnd) counts.dueToday += 1;
        }
      }
      return map;
    },
    staleTime: 30_000,
  });
}
