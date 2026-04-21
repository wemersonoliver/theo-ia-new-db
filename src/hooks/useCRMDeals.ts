import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { resolveAccountContext } from "@/lib/account-context";

export interface CRMDeal {
  id: string;
  user_id: string;
  stage_id: string;
  contact_id: string | null;
  title: string;
  value_cents: number | null;
  priority: string;
  expected_close_date: string | null;
  description: string | null;
  tags: string[];
  position: number;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined
  contact_name?: string | null;
  contact_phone?: string | null;
}

export function useCRMDeals(pipelineId: string | null, stageIds: string[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    if (!user || stageIds.length === 0) { setDeals([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_deals")
      .select("*, contacts(name, phone)")
      .in("stage_id", stageIds)
      .order("position", { ascending: true });

    if (data) {
      const mapped = data.map((d: any) => ({
        ...d,
        contact_name: d.contacts?.name || null,
        contact_phone: d.contacts?.phone || null,
        contacts: undefined,
      }));
      setDeals(mapped);
    }
    if (error) toast({ title: "Erro ao carregar deals", variant: "destructive" });
    setLoading(false);
  }, [user, stageIds, toast]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const createDeal = async (deal: {
    stage_id: string;
    title: string;
    value_cents?: number | null;
    priority?: string;
    contact_id?: string | null;
    description?: string | null;
    expected_close_date?: string | null;
    tags?: string[];
  }) => {
    if (!user) return;
    const position = deals.filter((d) => d.stage_id === deal.stage_id).length;
    const ctx = await resolveAccountContext(user.id);
    const { data, error } = await supabase
      .from("crm_deals")
      .insert({ ...deal, user_id: user.id, account_id: ctx?.accountId, assigned_to: user.id, position })
      .select("*, contacts(name, phone)")
      .single();
    if (error) {
      toast({ title: "Erro ao criar deal", variant: "destructive" });
    } else if (data) {
      const mapped = { ...data, contact_name: (data as any).contacts?.name || null, contact_phone: (data as any).contacts?.phone || null };
      setDeals((prev) => [...prev, mapped]);
    }
    return data;
  };

  const updateDeal = async (id: string, updates: Partial<CRMDeal>) => {
    const { error } = await supabase.from("crm_deals").update(updates).eq("id", id);
    if (!error) setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const moveDeal = async (dealId: string, newStageId: string, newPosition: number) => {
    await supabase.from("crm_deals").update({ stage_id: newStageId, position: newPosition }).eq("id", dealId);
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId, position: newPosition } : d))
    );
  };

  const deleteDeal = async (id: string) => {
    await supabase.from("crm_deals").delete().eq("id", id);
    setDeals((prev) => prev.filter((d) => d.id !== id));
  };

  return { deals, loading, createDeal, updateDeal, moveDeal, deleteDeal, refetch: fetchDeals };
}
