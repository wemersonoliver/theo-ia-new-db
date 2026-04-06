import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdminCRMPipeline {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useAdminCRMPipelines() {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<AdminCRMPipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_crm_pipelines")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar pipelines", variant: "destructive" });
    } else if (data && data.length > 0) {
      setPipelines(data);
      if (!activePipelineId) setActivePipelineId(data[0].id);
    }
    setLoading(false);
  }, [activePipelineId, toast]);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);

  const createPipeline = async (name: string) => {
    const { data, error } = await supabase
      .from("admin_crm_pipelines")
      .insert({ name })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar pipeline", variant: "destructive" });
    } else if (data) {
      setPipelines(prev => [...prev, data]);
      setActivePipelineId(data.id);
    }
  };

  const renamePipeline = async (id: string, name: string) => {
    const { error } = await supabase.from("admin_crm_pipelines").update({ name }).eq("id", id);
    if (!error) setPipelines(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const deletePipeline = async (id: string) => {
    const { error } = await supabase.from("admin_crm_pipelines").delete().eq("id", id);
    if (!error) {
      setPipelines(prev => prev.filter(p => p.id !== id));
      if (activePipelineId === id) {
        const remaining = pipelines.filter(p => p.id !== id);
        setActivePipelineId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  return { pipelines, activePipelineId, setActivePipelineId, loading, createPipeline, renamePipeline, deletePipeline };
}
