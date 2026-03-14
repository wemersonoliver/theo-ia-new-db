import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export interface CRMPipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_STAGES = [
  { name: "Novo Lead", position: 0, color: "#6366f1" },
  { name: "Qualificado", position: 1, color: "#8b5cf6" },
  { name: "Proposta", position: 2, color: "#f59e0b" },
  { name: "Negociação", position: 3, color: "#f97316" },
  { name: "Fechado/Ganho", position: 4, color: "#22c55e" },
  { name: "Perdido", position: 5, color: "#ef4444" },
];

export function useCRMPipelines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPipelines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar pipelines", variant: "destructive" });
    } else if (data && data.length > 0) {
      setPipelines(data);
      if (!activePipelineId) setActivePipelineId(data[0].id);
    } else {
      // Create default pipeline with stages
      const { data: newPipeline, error: createError } = await supabase
        .from("crm_pipelines")
        .insert({ user_id: user.id, name: "Vendas" })
        .select()
        .single();

      if (!createError && newPipeline) {
        const stages = DEFAULT_STAGES.map((s) => ({
          ...s,
          pipeline_id: newPipeline.id,
          user_id: user.id,
        }));
        await supabase.from("crm_stages").insert(stages);
        setPipelines([newPipeline]);
        setActivePipelineId(newPipeline.id);
      }
    }
    setLoading(false);
  }, [user, activePipelineId, toast]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const createPipeline = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("crm_pipelines")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar pipeline", variant: "destructive" });
    } else if (data) {
      const stages = DEFAULT_STAGES.map((s) => ({
        ...s,
        pipeline_id: data.id,
        user_id: user.id,
      }));
      await supabase.from("crm_stages").insert(stages);
      setPipelines((prev) => [...prev, data]);
      setActivePipelineId(data.id);
    }
  };

  return { pipelines, activePipelineId, setActivePipelineId, loading, createPipeline, refetch: fetchPipelines };
}
