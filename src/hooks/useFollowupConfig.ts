import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface FollowupConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  inactivity_hours: number;
  max_days: number;
  morning_window_start: string;
  morning_window_end: string;
  evening_window_start: string;
  evening_window_end: string;
  bargaining_tools: string | null;
  exclude_handoff: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowupTracking {
  id: string;
  user_id: string;
  phone: string;
  current_step: number;
  status: string;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
  context_summary: string | null;
  engagement_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FollowupAnalytics {
  totalPending: number;
  totalEngaged: number;
  totalExhausted: number;
  totalDeclined: number;
  reactivationByDay: { day: number; count: number }[];
  heatmap: { morning: number; afternoon: number };
}

export function useFollowupConfig() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["followup-config", accountId],
    queryFn: async () => {
      if (!user || !accountId) return null;
      const { data, error } = await supabase
        .from("followup_config")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data as FollowupConfig | null;
    },
    enabled: !!user && !!accountId,
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: Partial<FollowupConfig>) => {
      if (!user) throw new Error("Não autenticado");
      const ctx = await resolveAccountContext(user.id);

      const { data: existing } = await supabase
        .from("followup_config")
        .select("id")
        .eq("account_id", ctx?.accountId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("followup_config")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("followup_config")
          .insert({ user_id: user.id, account_id: ctx?.accountId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-config", accountId] });
      toast.success("Configurações de Follow-Up salvas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["followup-analytics", accountId],
    queryFn: async (): Promise<FollowupAnalytics> => {
      if (!user || !accountId) return { totalPending: 0, totalEngaged: 0, totalExhausted: 0, totalDeclined: 0, reactivationByDay: [], heatmap: { morning: 0, afternoon: 0 } };

      const { data: trackingData, error } = await supabase
        .from("followup_tracking")
        .select("*")
        .eq("account_id", accountId);

      if (error) throw error;

      const items = (trackingData || []) as FollowupTracking[];

      const totalPending = items.filter((i) => i.status === "pending").length;
      const totalEngaged = items.filter((i) => i.status === "engaged").length;
      const totalExhausted = items.filter((i) => i.status === "exhausted").length;
      const totalDeclined = items.filter((i) => i.status === "declined").length;

      // Reactivation by day
      const engagedItems = items.filter((i) => i.status === "engaged");
      const dayMap: Record<number, number> = {};
      for (const item of engagedItems) {
        const engagementData = item.engagement_data || {};
        const step = (engagementData as any).engaged_at_step || item.current_step || 1;
        const day = Math.ceil(step / 2);
        dayMap[day] = (dayMap[day] || 0) + 1;
      }
      const reactivationByDay = Array.from({ length: 6 }, (_, i) => ({
        day: i + 1,
        count: dayMap[i + 1] || 0,
      }));

      // Heatmap morning vs afternoon
      let morning = 0;
      let afternoon = 0;
      for (const item of engagedItems) {
        const engagementData = item.engagement_data || {};
        const step = (engagementData as any).engaged_at_step || item.current_step || 1;
        if (step % 2 === 1) morning++;
        else afternoon++;
      }

      return { totalPending, totalEngaged, totalExhausted, totalDeclined, reactivationByDay, heatmap: { morning, afternoon } };
    },
    enabled: !!user && !!accountId,
  });

  // Active trackings list
  const { data: trackings, isLoading: trackingsLoading } = useQuery({
    queryKey: ["followup-trackings", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const { data, error } = await supabase
        .from("followup_tracking")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as FollowupTracking[];
    },
    enabled: !!user && !!accountId,
  });

  return {
    config,
    configLoading,
    saveConfig,
    analytics,
    analyticsLoading,
    trackings,
    trackingsLoading,
  };
}
