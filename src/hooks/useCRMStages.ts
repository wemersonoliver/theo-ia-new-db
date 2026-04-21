import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveAccountContext } from "@/lib/account-context";

export interface CRMStage {
  id: string;
  pipeline_id: string;
  user_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useCRMStages(pipelineId: string | null) {
  const { user } = useAuth();
  const [stages, setStages] = useState<CRMStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    if (!user || !pipelineId) return;
    setLoading(true);
    const { data } = await supabase
      .from("crm_stages")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    setStages(data || []);
    setLoading(false);
  }, [user, pipelineId]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  const addStage = async (name: string, color: string = "#6366f1") => {
    if (!user || !pipelineId) return;
    const position = stages.length;
    const ctx = await resolveAccountContext(user.id);
    const { data } = await supabase
      .from("crm_stages")
      .insert({ pipeline_id: pipelineId, user_id: user.id, account_id: ctx?.accountId, name, position, color })
      .select()
      .single();
    if (data) setStages((prev) => [...prev, data]);
  };

  const updateStage = async (id: string, updates: Partial<Pick<CRMStage, "name" | "color" | "position">>) => {
    await supabase.from("crm_stages").update(updates).eq("id", id);
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteStage = async (id: string) => {
    await supabase.from("crm_stages").delete().eq("id", id);
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  return { stages, loading, addStage, updateStage, deleteStage, refetch: fetchStages };
}
