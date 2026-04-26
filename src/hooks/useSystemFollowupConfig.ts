import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SystemFollowupConfig {
  id: string;
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

export interface SystemFollowupTracking {
  id: string;
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

export interface SystemFollowupAnalytics {
  totalPending: number;
  totalEngaged: number;
  totalExhausted: number;
  totalDeclined: number;
  reactivationByDay: { day: number; count: number }[];
  heatmap: { morning: number; afternoon: number };
}

export function useSystemFollowupConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["system-followup-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_followup_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SystemFollowupConfig | null;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: Partial<SystemFollowupConfig>) => {
      const { data: existing } = await supabase
        .from("system_followup_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_followup_config")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_followup_config")
          .insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-followup-config"] });
      toast.success("Configurações de Follow-Up do Suporte salvas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["system-followup-analytics"],
    queryFn: async (): Promise<SystemFollowupAnalytics> => {
      const { data: trackingData, error } = await supabase
        .from("system_followup_tracking")
        .select("*");

      if (error) throw error;

      const items = (trackingData || []) as SystemFollowupTracking[];

      const totalPending = items.filter((i) => i.status === "pending").length;
      const totalEngaged = items.filter((i) => i.status === "engaged").length;
      const totalExhausted = items.filter((i) => i.status === "exhausted").length;
      const totalDeclined = items.filter((i) => i.status === "declined").length;

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
  });

  const { data: trackings, isLoading: trackingsLoading } = useQuery({
    queryKey: ["system-followup-trackings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_followup_tracking")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as SystemFollowupTracking[];
    },
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