import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import {
  aggregateConversationMetrics,
  shiftRangeBack,
  pctVariation,
  type DateRange,
  type ConversationLite,
} from "@/lib/dashboard-metrics";
import type { Message } from "@/hooks/useConversations";

export interface DashboardMetrics {
  current: {
    leads: number;
    services: number;
    appointments: number;
    sales: number;
    salesValueCents: number;
    avgFirstResponseSec: number;
    avgServiceTimeSec: number;
    perAttendant: Record<string, { tma: number; count: number }>;
  };
  variation: {
    leads: number | null;
    services: number | null;
    appointments: number | null;
    sales: number | null;
    avgFirstResponseSec: number | null;
    avgServiceTimeSec: number | null;
  };
  perSeller: Array<{
    user_id: string;
    leads: number;
    services: number;
    appointments: number;
    sales: number;
    salesValueCents: number;
  }>;
  loading: boolean;
}

export function useDashboardMetrics(
  range: DateRange,
  sellerId: string | "all",
  pipelineId: string | "all"
) {
  const { accountId } = useAccountId();
  const previous = shiftRangeBack(range);

  const { data, isLoading } = useQuery({
    queryKey: [
      "dashboard-metrics",
      accountId,
      range.start.toISOString(),
      range.end.toISOString(),
      sellerId,
      pipelineId,
    ],
    enabled: !!accountId,
    queryFn: async () => {
      // Fetch conversations active in the wider window (current + previous)
      const fetchStart = previous.start.toISOString();
      const fetchEnd = range.end.toISOString();

      let convQuery = supabase
        .from("whatsapp_conversations")
        .select("phone, assigned_to, last_message_at, created_at, messages")
        .eq("account_id", accountId);
      if (sellerId !== "all") convQuery = convQuery.eq("assigned_to", sellerId);
      const { data: convsRaw } = await convQuery;
      const conversations: ConversationLite[] = (convsRaw || []).map((c: any) => ({
        phone: c.phone,
        assigned_to: c.assigned_to,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        messages: ((c.messages as Message[]) || []),
      }));

      // Appointments
      let apptQuery = supabase
        .from("appointments")
        .select("id, assigned_to, created_at")
        .eq("account_id", accountId)
        .gte("created_at", fetchStart)
        .lte("created_at", fetchEnd);
      if (sellerId !== "all") apptQuery = apptQuery.eq("assigned_to", sellerId);
      const { data: appts } = await apptQuery;

      // Deals
      let dealQuery = supabase
        .from("crm_deals")
        .select("id, assigned_to, won_at, value_cents, stage_id")
        .eq("account_id", accountId)
        .not("won_at", "is", null)
        .gte("won_at", fetchStart)
        .lte("won_at", fetchEnd);
      if (sellerId !== "all") dealQuery = dealQuery.eq("assigned_to", sellerId);
      const { data: deals } = await dealQuery;

      // If pipelineId specified, filter deals by stage's pipeline_id
      let validDeals = deals || [];
      if (pipelineId !== "all" && validDeals.length > 0) {
        const stageIds = Array.from(new Set(validDeals.map((d: any) => d.stage_id)));
        const { data: stages } = await supabase
          .from("crm_stages")
          .select("id, pipeline_id")
          .in("id", stageIds);
        const allowed = new Set(
          (stages || []).filter((s: any) => s.pipeline_id === pipelineId).map((s: any) => s.id)
        );
        validDeals = validDeals.filter((d: any) => allowed.has(d.stage_id));
      }

      const startMs = range.start.getTime();
      const endMs = range.end.getTime();
      const prevStartMs = previous.start.getTime();
      const prevEndMs = previous.end.getTime();

      const inRange = (iso: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= startMs && t <= endMs;
      };
      const inPrev = (iso: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= prevStartMs && t < prevEndMs;
      };

      const convMetricsCur = aggregateConversationMetrics(conversations, range);
      const convMetricsPrev = aggregateConversationMetrics(conversations, previous);

      const apptCur = (appts || []).filter((a: any) => inRange(a.created_at)).length;
      const apptPrev = (appts || []).filter((a: any) => inPrev(a.created_at)).length;

      const salesCur = validDeals.filter((d: any) => inRange(d.won_at));
      const salesPrev = validDeals.filter((d: any) => inPrev(d.won_at));
      const salesValueCur = salesCur.reduce((s: number, d: any) => s + (d.value_cents || 0), 0);

      // Per seller breakdown
      const sellerMap: Record<
        string,
        { user_id: string; leads: number; services: number; appointments: number; sales: number; salesValueCents: number }
      > = {};
      const ensure = (uid: string | null) => {
        const k = uid || "__unassigned__";
        if (!sellerMap[k]) {
          sellerMap[k] = {
            user_id: k,
            leads: 0,
            services: 0,
            appointments: 0,
            sales: 0,
            salesValueCents: 0,
          };
        }
        return sellerMap[k];
      };
      for (const conv of conversations) {
        const m = aggregateConversationMetrics([conv], range);
        const row = ensure(conv.assigned_to);
        row.leads += m.leads;
        row.services += m.services;
      }
      for (const a of appts || []) {
        if (inRange((a as any).created_at)) ensure((a as any).assigned_to).appointments++;
      }
      for (const d of salesCur) {
        const row = ensure((d as any).assigned_to);
        row.sales++;
        row.salesValueCents += (d as any).value_cents || 0;
      }

      const result: DashboardMetrics = {
        current: {
          leads: convMetricsCur.leads,
          services: convMetricsCur.services,
          appointments: apptCur,
          sales: salesCur.length,
          salesValueCents: salesValueCur,
          avgFirstResponseSec: convMetricsCur.avgFirstResponseSec,
          avgServiceTimeSec: convMetricsCur.avgServiceTimeSec,
          perAttendant: convMetricsCur.perAttendant,
        },
        variation: {
          leads: pctVariation(convMetricsCur.leads, convMetricsPrev.leads),
          services: pctVariation(convMetricsCur.services, convMetricsPrev.services),
          appointments: pctVariation(apptCur, apptPrev),
          sales: pctVariation(salesCur.length, salesPrev.length),
          avgFirstResponseSec: pctVariation(
            convMetricsCur.avgFirstResponseSec,
            convMetricsPrev.avgFirstResponseSec
          ),
          avgServiceTimeSec: pctVariation(
            convMetricsCur.avgServiceTimeSec,
            convMetricsPrev.avgServiceTimeSec
          ),
        },
        perSeller: Object.values(sellerMap),
        loading: false,
      };
      return result;
    },
    refetchInterval: 30000,
  });

  return {
    metrics: data,
    loading: isLoading,
  };
}

export function useUserGoals() {
  const { accountId } = useAccountId();
  const { data } = useQuery({
    queryKey: ["user-goals", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_goals")
        .select("*")
        .eq("account_id", accountId)
        .eq("period_type", "monthly")
        .maybeSingle();
      return (
        data || {
          leads_goal: 100,
          services_goal: 80,
          appointments_goal: 40,
          sales_goal: 20,
          sales_value_cents_goal: 0,
        }
      );
    },
  });
  return data;
}