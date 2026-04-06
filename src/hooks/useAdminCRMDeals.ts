import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdminCRMDeal {
  id: string;
  stage_id: string;
  user_ref_id: string | null;
  title: string;
  value_cents: number | null;
  priority: string;
  description: string | null;
  tags: string[];
  position: number;
  onboarding_completed: boolean;
  subscription_status: string | null;
  subscription_plan: string | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined from profiles
  user_email?: string | null;
  user_phone?: string | null;
}

export function useAdminCRMDeals(pipelineId: string | null, stageIds: string[]) {
  const { toast } = useToast();
  const [deals, setDeals] = useState<AdminCRMDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    if (stageIds.length === 0) { setDeals([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_crm_deals")
      .select("*")
      .in("stage_id", stageIds)
      .order("position", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar deals", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch profiles for user info
      const userIds = [...new Set(data.filter(d => d.user_ref_id).map(d => d.user_ref_id!))];
      let profilesMap: Record<string, { email: string | null; phone: string | null; onboarding_completed: boolean }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, phone, onboarding_completed")
          .in("user_id", userIds);
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.user_id] = { email: p.email, phone: p.phone, onboarding_completed: p.onboarding_completed };
          });
        }
      }

      // Fetch subscriptions
      let subsMap: Record<string, { status: string; plan_type: string | null }> = {};
      if (userIds.length > 0) {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("user_id, status, plan_type")
          .in("user_id", userIds);
        if (subs) {
          subs.forEach(s => { subsMap[s.user_id] = { status: s.status, plan_type: s.plan_type }; });
        }
      }

      const mapped = data.map(d => ({
        ...d,
        user_email: d.user_ref_id ? profilesMap[d.user_ref_id]?.email || null : null,
        user_phone: d.user_ref_id ? profilesMap[d.user_ref_id]?.phone || null : null,
        onboarding_completed: d.user_ref_id ? profilesMap[d.user_ref_id]?.onboarding_completed ?? d.onboarding_completed : d.onboarding_completed,
        subscription_status: d.user_ref_id ? subsMap[d.user_ref_id]?.status || d.subscription_status : d.subscription_status,
        subscription_plan: d.user_ref_id ? subsMap[d.user_ref_id]?.plan_type || d.subscription_plan : d.subscription_plan,
      }));
      setDeals(mapped);
    }
    setLoading(false);
  }, [stageIds, toast]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const createDeal = async (deal: {
    stage_id: string;
    title: string;
    value_cents?: number | null;
    priority?: string;
    description?: string | null;
    expected_close_date?: string | null;
  }) => {
    const position = deals.filter(d => d.stage_id === deal.stage_id).length;
    const { data, error } = await supabase
      .from("admin_crm_deals")
      .insert({ ...deal, position })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar deal", variant: "destructive" });
    } else if (data) {
      setDeals(prev => [...prev, { ...data, user_email: null, user_phone: null }]);
    }
  };

  const updateDeal = async (id: string, updates: Partial<AdminCRMDeal>) => {
    const { error } = await supabase.from("admin_crm_deals").update(updates).eq("id", id);
    if (!error) setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const moveDeal = async (dealId: string, newStageId: string, newPosition: number) => {
    await supabase.from("admin_crm_deals").update({ stage_id: newStageId, position: newPosition }).eq("id", dealId);
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: newStageId, position: newPosition } : d));
  };

  const deleteDeal = async (id: string) => {
    await supabase.from("admin_crm_deals").delete().eq("id", id);
    setDeals(prev => prev.filter(d => d.id !== id));
  };

  return { deals, loading, createDeal, updateDeal, moveDeal, deleteDeal, refetch: fetchDeals };
}
