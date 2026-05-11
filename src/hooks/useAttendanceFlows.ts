import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FlowStepType = "text" | "audio" | "video" | "image" | "link" | "delay";

export interface AttendanceFlow {
  id: string;
  name: string;
  description: string | null;
  trigger_text: string;
  trigger_match_mode: "exact" | "contains";
  is_active: boolean;
  pause_support_ai: boolean;
  only_first_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceFlowStep {
  id: string;
  flow_id: string;
  position: number;
  type: FlowStepType;
  content: string | null;
  caption: string | null;
  media_path: string | null;
  media_url: string | null;
  delay_before_seconds: number;
  typing_indicator: boolean;
  recording_indicator: boolean;
}

export interface AttendanceFlowRun {
  id: string;
  flow_id: string;
  phone: string;
  current_step: number;
  status: "running" | "done" | "canceled" | "error";
  next_run_at: string;
  last_error: string | null;
  started_at: string;
  finished_at: string | null;
  trigger_message: string | null;
}

export function useAttendanceFlows() {
  const qc = useQueryClient();

  const flows = useQuery({
    queryKey: ["attendance-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_flows" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AttendanceFlow[];
    },
  });

  const createFlow = useMutation({
    mutationFn: async (input: Partial<AttendanceFlow>) => {
      const payload = {
        name: input.name || "Novo fluxo",
        description: input.description || null,
        trigger_text: input.trigger_text || "",
        trigger_match_mode: input.trigger_match_mode || "exact",
        is_active: input.is_active ?? true,
        pause_support_ai: input.pause_support_ai ?? true,
        only_first_contact: input.only_first_contact ?? false,
      };
      const { data, error } = await supabase
        .from("attendance_flows" as any)
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AttendanceFlow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-flows"] });
      toast.success("Fluxo criado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar"),
  });

  const updateFlow = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AttendanceFlow> & { id: string }) => {
      const { error } = await supabase.from("attendance_flows" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-flows"] });
      qc.invalidateQueries({ queryKey: ["attendance-flow"] });
      toast.success("Fluxo atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance_flows" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-flows"] });
      toast.success("Fluxo excluído");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return { flows, createFlow, updateFlow, deleteFlow };
}

export function useAttendanceFlow(flowId: string | undefined) {
  const qc = useQueryClient();

  const flow = useQuery({
    queryKey: ["attendance-flow", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_flows" as any)
        .select("*")
        .eq("id", flowId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AttendanceFlow | null;
    },
    enabled: !!flowId,
  });

  const steps = useQuery({
    queryKey: ["attendance-flow-steps", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_flow_steps" as any)
        .select("*")
        .eq("flow_id", flowId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AttendanceFlowStep[];
    },
    enabled: !!flowId,
  });

  const runs = useQuery({
    queryKey: ["attendance-flow-runs", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_flow_runs" as any)
        .select("*")
        .eq("flow_id", flowId!)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AttendanceFlowRun[];
    },
    enabled: !!flowId,
    refetchInterval: 5000,
  });

  const createStep = useMutation({
    mutationFn: async (input: Partial<AttendanceFlowStep>) => {
      const list = steps.data || [];
      const position = list.length;
      const payload: any = {
        flow_id: flowId,
        position,
        type: input.type || "text",
        content: input.content ?? null,
        caption: input.caption ?? null,
        media_path: input.media_path ?? null,
        media_url: input.media_url ?? null,
        delay_before_seconds: input.delay_before_seconds ?? 0,
        typing_indicator: input.typing_indicator ?? true,
        recording_indicator: input.recording_indicator ?? true,
      };
      const { error } = await supabase.from("attendance_flow_steps" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-flow-steps", flowId] }),
    onError: (e: any) => toast.error(e?.message || "Erro ao adicionar passo"),
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AttendanceFlowStep> & { id: string }) => {
      const { error } = await supabase.from("attendance_flow_steps" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-flow-steps", flowId] }),
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar passo"),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance_flow_steps" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-flow-steps", flowId] }),
  });

  const reorderSteps = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Atualiza posições sequencialmente
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase.from("attendance_flow_steps" as any).update({ position: i }).eq("id", orderedIds[i]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-flow-steps", flowId] }),
  });

  const testRun = useMutation({
    mutationFn: async (phone: string) => {
      let normalized = phone.replace(/\D/g, "");
      if (normalized.length === 10 || normalized.length === 11) normalized = "55" + normalized;
      // Cancela runs anteriores
      await supabase.from("attendance_flow_runs" as any)
        .update({ status: "canceled", finished_at: new Date().toISOString() })
        .eq("flow_id", flowId!)
        .eq("phone", normalized)
        .eq("status", "running");
      const { error } = await supabase.from("attendance_flow_runs" as any).insert({
        flow_id: flowId,
        phone: normalized,
        current_step: 0,
        status: "running",
        next_run_at: new Date().toISOString(),
        trigger_message: "[teste manual]",
      });
      if (error) throw error;
      // Dispara processamento imediato
      await supabase.functions.invoke("attendance-flow-dispatch", { body: {} });
    },
    onSuccess: () => {
      toast.success("Teste enfileirado");
      qc.invalidateQueries({ queryKey: ["attendance-flow-runs", flowId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao testar"),
  });

  return { flow, steps, runs, createStep, updateStep, deleteStep, reorderSteps, testRun };
}

export async function uploadFlowMedia(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const safeBase = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);
  const path = `${crypto.randomUUID()}-${safeBase}`;
  const { error } = await supabase.storage.from("attendance-flow-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}