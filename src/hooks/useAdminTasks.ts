import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminTask {
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
  deal_title: string | null;
  owner_name: string | null;
  owner_email: string | null;
  assignee_name: string | null;
  account_name: string | null;
}

export function useAdminTasks() {
  return useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async (): Promise<AdminTask[]> => {
      const { data: rows, error } = await supabase
        .from("crm_deal_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const dealIds = Array.from(new Set((rows || []).map((r) => r.deal_id).filter(Boolean)));
      const userIds = Array.from(
        new Set(
          (rows || [])
            .flatMap((r) => [r.user_id, r.assigned_to])
            .filter(Boolean) as string[]
        )
      );
      const accountIds = Array.from(
        new Set((rows || []).map((r) => r.account_id).filter(Boolean) as string[])
      );

      const [dealsRes, profilesRes, accountsRes] = await Promise.all([
        dealIds.length
          ? supabase.from("crm_deals").select("id, title").in("id", dealIds)
          : Promise.resolve({ data: [] as any[] } as any),
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
        accountIds.length
          ? supabase.from("accounts").select("id, name").in("id", accountIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const dealMap = new Map<string, string>();
      (dealsRes.data || []).forEach((d: any) => dealMap.set(d.id, d.title));
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      (profilesRes.data || []).forEach((p: any) =>
        profileMap.set(p.user_id, { full_name: p.full_name, email: p.email })
      );
      const accountMap = new Map<string, string>();
      (accountsRes.data || []).forEach((a: any) => accountMap.set(a.id, a.name));

      return (rows || []).map((r: any) => {
        const owner = profileMap.get(r.user_id);
        const assignee = r.assigned_to ? profileMap.get(r.assigned_to) : null;
        return {
          ...r,
          deal_title: dealMap.get(r.deal_id) ?? null,
          owner_name: owner?.full_name ?? null,
          owner_email: owner?.email ?? null,
          assignee_name: assignee?.full_name ?? null,
          account_name: r.account_id ? accountMap.get(r.account_id) ?? null : null,
        } as AdminTask;
      });
    },
    staleTime: 30_000,
  });
}

export interface UserPerformance {
  user_id: string;
  name: string;
  email: string | null;
  account_name: string | null;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number; // 0-100
  avgCompletionHours: number | null;
  lastActivity: string | null;
}

export function aggregateByUser(tasks: AdminTask[]): UserPerformance[] {
  const map = new Map<string, UserPerformance & { _completionTimes: number[]; _lastTs: number }>();
  const now = Date.now();

  for (const t of tasks) {
    const key = t.assigned_to ?? t.user_id;
    const name = t.assignee_name ?? t.owner_name ?? "Desconhecido";
    const email = t.owner_email;
    if (!map.has(key)) {
      map.set(key, {
        user_id: key,
        name,
        email,
        account_name: t.account_name,
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        completionRate: 0,
        avgCompletionHours: null,
        lastActivity: null,
        _completionTimes: [],
        _lastTs: 0,
      });
    }
    const u = map.get(key)!;
    u.total += 1;
    if (t.completed) {
      u.completed += 1;
      if (t.completed_at && t.created_at) {
        const hrs = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000;
        if (hrs >= 0) u._completionTimes.push(hrs);
      }
    } else {
      u.pending += 1;
      if (t.due_date && new Date(t.due_date).getTime() < now) u.overdue += 1;
    }
    const ts = new Date(t.updated_at || t.created_at).getTime();
    if (ts > u._lastTs) {
      u._lastTs = ts;
      u.lastActivity = t.updated_at || t.created_at;
    }
  }

  return Array.from(map.values()).map((u) => ({
    ...u,
    completionRate: u.total ? Math.round((u.completed / u.total) * 100) : 0,
    avgCompletionHours:
      u._completionTimes.length > 0
        ? Math.round((u._completionTimes.reduce((a, b) => a + b, 0) / u._completionTimes.length) * 10) / 10
        : null,
  }));
}