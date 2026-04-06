import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdminCRMStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useAdminCRMStages(pipelineId: string | null) {
  const { toast } = useToast();
  const [stages, setStages] = useState<AdminCRMStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    if (!pipelineId) { setStages([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_crm_stages")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true });
    if (data) setStages(data);
    if (error) toast({ title: "Erro ao carregar etapas", variant: "destructive" });
    setLoading(false);
  }, [pipelineId, toast]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const addStage = async (name: string, color: string) => {
    if (!pipelineId) return;
    const position = stages.length;
    const { data, error } = await supabase
      .from("admin_crm_stages")
      .insert({ pipeline_id: pipelineId, name, color, position })
      .select()
      .single();
    if (data) setStages(prev => [...prev, data]);
    if (error) toast({ title: "Erro ao criar etapa", variant: "destructive" });
  };

  const updateStage = async (id: string, updates: Partial<AdminCRMStage>) => {
    const { error } = await supabase.from("admin_crm_stages").update(updates).eq("id", id);
    if (!error) setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteStage = async (id: string) => {
    const { error } = await supabase.from("admin_crm_stages").delete().eq("id", id);
    if (!error) setStages(prev => prev.filter(s => s.id !== id));
  };

  return { stages, loading, addStage, updateStage, deleteStage };
}
