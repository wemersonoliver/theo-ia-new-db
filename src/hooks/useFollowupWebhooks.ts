import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface FollowupWebhook {
  id: string;
  account_id: string;
  user_id: string;
  flow_id: string | null;
  name: string;
  url: string;
  events: string[];
  headers: Record<string, string> | null;
  secret: string | null;
  enabled: boolean;
  last_status: number | null;
  last_error: string | null;
  last_fired_at: string | null;
  created_at: string;
}

export const WEBHOOK_EVENTS = ["sent", "completed", "stopped", "failed", "enrolled"] as const;

export function useFollowupWebhooks() {
  const { accountId } = useAccountId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["custom-followup-webhooks", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("custom_followup_webhooks").select("*")
        .eq("account_id", accountId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FollowupWebhook[];
    },
    enabled: !!accountId,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<FollowupWebhook>) => {
      if (!accountId || !user) throw new Error("Sem conta");
      const payload = {
        account_id: accountId, user_id: user.id,
        name: input.name || "Webhook",
        url: input.url || "",
        events: input.events && input.events.length ? input.events : ["sent", "completed", "stopped", "failed"],
        headers: input.headers || {},
        secret: input.secret || null,
        flow_id: input.flow_id || null,
        enabled: input.enabled ?? true,
      };
      const { data, error } = await supabase.from("custom_followup_webhooks").insert(payload).select("*").single();
      if (error) throw error;
      return data as FollowupWebhook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-webhooks", accountId] });
      toast.success("Webhook criado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FollowupWebhook> & { id: string }) => {
      const { error } = await supabase.from("custom_followup_webhooks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-webhooks", accountId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_followup_webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-webhooks", accountId] });
      toast.success("Webhook removido");
    },
  });

  return { listQuery, create, update, remove };
}

export interface FlowMetrics {
  enrolled: number;
  sent: number;
  completed: number;
  stopped_replied: number;
  stopped_handoff: number;
  failed: number;
  reply_rate: number; // 0..1
  completion_rate: number;
}

export function useFlowMetrics(flowId?: string, days = 30) {
  const { accountId } = useAccountId();
  return useQuery({
    queryKey: ["custom-followup-metrics", accountId, flowId, days],
    queryFn: async (): Promise<FlowMetrics> => {
      if (!accountId) throw new Error("no account");
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      let q = supabase.from("custom_followup_events")
        .select("event_type, meta", { count: "exact" })
        .eq("account_id", accountId)
        .gte("created_at", since);
      if (flowId) q = q.eq("flow_id", flowId);
      const { data, error } = await q.limit(10000);
      if (error) throw error;

      const m: FlowMetrics = {
        enrolled: 0, sent: 0, completed: 0,
        stopped_replied: 0, stopped_handoff: 0, failed: 0,
        reply_rate: 0, completion_rate: 0,
      };
      for (const e of (data || []) as any[]) {
        if (e.event_type === "sent") m.sent++;
        else if (e.event_type === "completed") m.completed++;
        else if (e.event_type === "failed") m.failed++;
        else if (e.event_type === "enrolled") m.enrolled++;
        else if (e.event_type === "stopped") {
          const r = e.meta?.reason;
          if (r === "replied") m.stopped_replied++;
          else if (r === "handoff") m.stopped_handoff++;
        }
      }
      // Enrolled count via enrollments table (more reliable)
      let eq = supabase.from("custom_followup_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("created_at", since);
      if (flowId) eq = eq.eq("flow_id", flowId);
      const { count: enrolledCount } = await eq;
      m.enrolled = enrolledCount || 0;

      const denom = m.enrolled || 1;
      m.reply_rate = (m.stopped_replied) / denom;
      m.completion_rate = (m.completed) / denom;
      return m;
    },
    enabled: !!accountId,
  });
}