import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateConversationMetrics,
  shiftRangeBack,
  pctVariation,
  type DateRange,
  type ConversationLite,
} from "@/lib/dashboard-metrics";
import type { Message } from "@/hooks/useConversations";

export interface AdminDashboardMetrics {
  current: {
    totalUsers: number;
    activeSubscriptions: number;
    newUsers: number;
    connectedInstances: number;
    totalInstances: number;
    aiConfigs: number;
    leads: number;
    services: number;
    appointments: number;
    sales: number;
    salesValueCents: number;
    mrrCents: number;
    avgFirstResponseSec: number;
    avgServiceTimeSec: number;
    openTickets: number;
  };
  variation: {
    newUsers: number | null;
    leads: number | null;
    services: number | null;
    appointments: number | null;
    sales: number | null;
    avgFirstResponseSec: number | null;
    avgServiceTimeSec: number | null;
  };
  topAccounts: Array<{
    account_id: string;
    account_name: string;
    leads: number;
    services: number;
    appointments: number;
    sales: number;
    salesValueCents: number;
  }>;
  signupsByDay: Array<{ date: string; count: number }>;
  planBreakdown: Array<{ plan: string; count: number; mrrCents: number }>;
}

export function useAdminDashboardMetrics(range: DateRange) {
  const previous = shiftRangeBack(range);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-metrics", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const fetchStart = previous.start.toISOString();
      const fetchEnd = range.end.toISOString();
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

      // Profiles (all users + period filter for new signups)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      const totalUsers = profiles?.length || 0;
      const newUsersCur = (profiles || []).filter((p: any) => inRange(p.created_at)).length;
      const newUsersPrev = (profiles || []).filter((p: any) => inPrev(p.created_at)).length;

      // Signups by day (within range)
      const dayMap: Record<string, number> = {};
      const dayCount = Math.max(
        1,
        Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000))
      );
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(range.start);
        d.setDate(d.getDate() + i);
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const p of profiles || []) {
        if (!inRange((p as any).created_at)) continue;
        const k = new Date((p as any).created_at).toISOString().slice(0, 10);
        if (k in dayMap) dayMap[k]++;
      }
      const signupsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

      // Subscriptions
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status, plan_type, amount_cents, started_at");
      const activeSubs = (subs || []).filter((s: any) => s.status === "active");
      const activeSubscriptions = activeSubs.length;
      const mrrCents = activeSubs.reduce((acc: number, s: any) => {
        const amt = s.amount_cents || 0;
        // anual -> /12, mensal -> /1
        const isYearly = (s.plan_type || "").toLowerCase().includes("anual") || amt > 50000;
        return acc + (isYearly ? Math.round(amt / 12) : amt);
      }, 0);

      const planMap: Record<string, { count: number; mrrCents: number }> = {};
      for (const s of activeSubs as any[]) {
        const key = s.plan_type || "indefinido";
        if (!planMap[key]) planMap[key] = { count: 0, mrrCents: 0 };
        planMap[key].count++;
        const amt = s.amount_cents || 0;
        const isYearly = (s.plan_type || "").toLowerCase().includes("anual") || amt > 50000;
        planMap[key].mrrCents += isYearly ? Math.round(amt / 12) : amt;
      }
      const planBreakdown = Object.entries(planMap).map(([plan, v]) => ({
        plan,
        count: v.count,
        mrrCents: v.mrrCents,
      }));

      // WhatsApp instances
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("status");
      const totalInstances = instances?.length || 0;
      const connectedInstances = (instances || []).filter((i: any) => i.status === "connected").length;

      // AI configs ativos
      const { count: aiConfigs } = await supabase
        .from("whatsapp_ai_config")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Conversations (todas) — para leads, atendimentos e tempos médios
      const { data: convsRaw } = await supabase
        .from("whatsapp_conversations")
        .select("phone, assigned_to, last_message_at, created_at, messages, account_id");
      const conversations: ConversationLite[] = (convsRaw || []).map((c: any) => ({
        phone: c.phone,
        assigned_to: c.assigned_to,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        messages: ((c.messages as Message[]) || []),
      }));

      const convCur = aggregateConversationMetrics(conversations, range);
      const convPrev = aggregateConversationMetrics(conversations, previous);

      // Appointments
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, account_id, created_at")
        .gte("created_at", fetchStart)
        .lte("created_at", fetchEnd);
      const apptCur = (appts || []).filter((a: any) => inRange(a.created_at)).length;
      const apptPrev = (appts || []).filter((a: any) => inPrev(a.created_at)).length;

      // Deals ganhos
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("id, account_id, won_at, value_cents")
        .not("won_at", "is", null)
        .gte("won_at", fetchStart)
        .lte("won_at", fetchEnd);
      const salesCur = (deals || []).filter((d: any) => inRange(d.won_at));
      const salesPrev = (deals || []).filter((d: any) => inPrev(d.won_at));
      const salesValueCur = salesCur.reduce(
        (s: number, d: any) => s + (d.value_cents || 0),
        0
      );

      // Tickets abertos
      const { count: openTickets } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);

      // Top accounts (ranking)
      const { data: accountsList } = await supabase
        .from("accounts")
        .select("id, name");
      const accountNames: Record<string, string> = {};
      for (const a of (accountsList || []) as any[]) accountNames[a.id] = a.name || "—";

      const accountMap: Record<
        string,
        { account_id: string; account_name: string; leads: number; services: number; appointments: number; sales: number; salesValueCents: number }
      > = {};
      const ensureAcc = (aid: string | null) => {
        const k = aid || "__none__";
        if (!accountMap[k]) {
          accountMap[k] = {
            account_id: k,
            account_name: accountNames[k] || "Sem conta",
            leads: 0,
            services: 0,
            appointments: 0,
            sales: 0,
            salesValueCents: 0,
          };
        }
        return accountMap[k];
      };

      for (const c of (convsRaw || []) as any[]) {
        const conv: ConversationLite = {
          phone: c.phone,
          assigned_to: c.assigned_to,
          last_message_at: c.last_message_at,
          created_at: c.created_at,
          messages: ((c.messages as Message[]) || []),
        };
        const m = aggregateConversationMetrics([conv], range);
        const row = ensureAcc(c.account_id);
        row.leads += m.leads;
        row.services += m.services;
      }
      for (const a of (appts || []) as any[]) {
        if (inRange(a.created_at)) ensureAcc(a.account_id).appointments++;
      }
      for (const d of salesCur as any[]) {
        const row = ensureAcc(d.account_id);
        row.sales++;
        row.salesValueCents += d.value_cents || 0;
      }
      const topAccounts = Object.values(accountMap)
        .sort((a, b) => b.salesValueCents - a.salesValueCents || b.leads - a.leads)
        .slice(0, 10);

      const result: AdminDashboardMetrics = {
        current: {
          totalUsers,
          activeSubscriptions,
          newUsers: newUsersCur,
          connectedInstances,
          totalInstances,
          aiConfigs: aiConfigs || 0,
          leads: convCur.leads,
          services: convCur.services,
          appointments: apptCur,
          sales: salesCur.length,
          salesValueCents: salesValueCur,
          mrrCents,
          avgFirstResponseSec: convCur.avgFirstResponseSec,
          avgServiceTimeSec: convCur.avgServiceTimeSec,
          openTickets: openTickets || 0,
        },
        variation: {
          newUsers: pctVariation(newUsersCur, newUsersPrev),
          leads: pctVariation(convCur.leads, convPrev.leads),
          services: pctVariation(convCur.services, convPrev.services),
          appointments: pctVariation(apptCur, apptPrev),
          sales: pctVariation(salesCur.length, salesPrev.length),
          avgFirstResponseSec: pctVariation(convCur.avgFirstResponseSec, convPrev.avgFirstResponseSec),
          avgServiceTimeSec: pctVariation(convCur.avgServiceTimeSec, convPrev.avgServiceTimeSec),
        },
        topAccounts,
        signupsByDay,
        planBreakdown,
      };
      return result;
    },
    refetchInterval: 60000,
  });

  return { metrics: data, loading: isLoading };
}