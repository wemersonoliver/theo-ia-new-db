import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { resolveAccountContext } from "@/lib/account-context";

export interface CRMPipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_STAGES = [
  { name: "Atendimento IA", position: 0, color: "#6366f1" },
  { name: "Atendimento humano", position: 1, color: "#8b5cf6" },
  { name: "Agendamento Realizado", position: 2, color: "#f59e0b" },
  { name: "Agendamento Confirmado", position: 3, color: "#f97316" },
  { name: "Compareceu", position: 4, color: "#22c55e" },
  { name: "Venda realizada", position: 5, color: "#6366f1" },
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
    const ctx = await resolveAccountContext(user.id);
    if (!ctx) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("account_id", ctx.accountId)
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
        .insert({ user_id: user.id, account_id: ctx?.accountId, name: "Vendas" })
        .select()
        .single();

      if (!createError && newPipeline) {
        const stages = DEFAULT_STAGES.map((s) => ({
          ...s,
          pipeline_id: newPipeline.id,
          user_id: user.id,
          account_id: ctx?.accountId,
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
    const ctx = await resolveAccountContext(user.id);
    const { data, error } = await supabase
      .from("crm_pipelines")
      .insert({ user_id: user.id, account_id: ctx?.accountId, name })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar pipeline", variant: "destructive" });
    } else if (data) {
      const stages = DEFAULT_STAGES.map((s) => ({
        ...s,
        pipeline_id: data.id,
        user_id: user.id,
        account_id: ctx?.accountId,
      }));
      await supabase.from("crm_stages").insert(stages);
      setPipelines((prev) => [...prev, data]);
      setActivePipelineId(data.id);
    }
  };

  const renamePipeline = async (id: string, name: string) => {
    const { error } = await supabase.from("crm_pipelines").update({ name }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao renomear pipeline", variant: "destructive" });
    } else {
      setPipelines((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    }
  };

  const deletePipeline = async (id: string) => {
    const { error } = await supabase.from("crm_pipelines").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir pipeline", variant: "destructive" });
    } else {
      setPipelines((prev) => prev.filter((p) => p.id !== id));
      if (activePipelineId === id) {
        const remaining = pipelines.filter((p) => p.id !== id);
        setActivePipelineId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  return { pipelines, activePipelineId, setActivePipelineId, loading, createPipeline, renamePipeline, deletePipeline, refetch: fetchPipelines };
}
