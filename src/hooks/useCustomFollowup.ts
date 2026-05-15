import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type StepType = "text" | "audio" | "video" | "image" | "document" | "sticker";
export type DelayUnit = "minutes" | "hours" | "days";
export type TriggerType =
  | "inactivity"
  | "manual"
  | "crm_stage_enter"
  | "crm_stage_exit"
  | "conversation_finalized"
  | "tag";

export interface CustomFlow {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: TriggerType;
  trigger_config: any;
  filters: any;
  window_config: any;
  exclude_handoff: boolean;
  stop_on_reply: boolean;
  throttle_seconds: number;
  max_per_hour: number;
  created_at: string;
  updated_at: string;
}

export interface CustomStep {
  id: string;
  flow_id: string;
  account_id: string;
  position: number;
  type: StepType;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  delay_value: number;
  delay_unit: DelayUnit;
  variants: any;
  conditions: any;
}

export interface CustomEnrollment {
  id: string;
  flow_id: string;
  account_id: string;
  phone: string;
  current_step: number;
  status: string;
  stop_reason: string | null;
  started_at: string;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
  triggered_by: string | null;
}

const DEFAULT_FLOW: Partial<CustomFlow> = {
  name: "Novo fluxo",
  description: "",
  enabled: false,
  trigger_type: "inactivity",
  trigger_config: { value: 24, unit: "hours" },
  filters: {},
  window_config: { morning_start: "08:00", evening_end: "19:00", skip_sundays: true, skip_holidays: true },
  exclude_handoff: true,
  stop_on_reply: true,
  throttle_seconds: 7,
  max_per_hour: 60,
};

export function useCustomFollowup() {
  const { accountId } = useAccountId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const flowsQuery = useQuery({
    queryKey: ["custom-followup-flows", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("custom_followup_flows")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomFlow[];
    },
    enabled: !!accountId,
  });

  const createFlow = useMutation({
    mutationFn: async (input: Partial<CustomFlow>) => {
      if (!accountId || !user) throw new Error("Sem conta");
      const payload = { ...DEFAULT_FLOW, ...input, account_id: accountId, user_id: user.id };
      const { data, error } = await supabase
        .from("custom_followup_flows").insert(payload as any).select("*").single();
      if (error) throw error;
      return data as CustomFlow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-flows", accountId] });
      toast.success("Fluxo criado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateFlow = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CustomFlow> & { id: string }) => {
      const { data, error } = await supabase
        .from("custom_followup_flows").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data as CustomFlow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-flows", accountId] });
    },
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_followup_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-flows", accountId] });
      toast.success("Fluxo removido");
    },
  });

  return { flowsQuery, createFlow, updateFlow, deleteFlow };
}

export function useFlowSteps(flowId?: string) {
  const { accountId } = useAccountId();
  const qc = useQueryClient();

  const stepsQuery = useQuery({
    queryKey: ["custom-followup-steps", flowId],
    queryFn: async () => {
      if (!flowId) return [];
      const { data, error } = await supabase
        .from("custom_followup_steps")
        .select("*").eq("flow_id", flowId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as CustomStep[];
    },
    enabled: !!flowId,
  });

  const createStep = useMutation({
    mutationFn: async (input: Partial<CustomStep>) => {
      if (!flowId || !accountId) throw new Error("flow ausente");
      const { data: existing } = await supabase
        .from("custom_followup_steps").select("position")
        .eq("flow_id", flowId).order("position", { ascending: false }).limit(1).maybeSingle();
      const position = ((existing?.position as number) ?? -1) + 1;
      const payload: any = {
        flow_id: flowId, account_id: accountId,
        position, type: "text", delay_value: 0, delay_unit: "minutes",
        ...input,
      };
      const { data, error } = await supabase
        .from("custom_followup_steps").insert(payload).select("*").single();
      if (error) throw error;
      return data as CustomStep;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-steps", flowId] }),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CustomStep> & { id: string }) => {
      const { data, error } = await supabase
        .from("custom_followup_steps").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data as CustomStep;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-steps", flowId] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_followup_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-steps", flowId] }),
  });

  const reorderSteps = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // bulk update positions
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase.from("custom_followup_steps").update({ position: i }).eq("id", orderedIds[i]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-steps", flowId] }),
  });

  return { stepsQuery, createStep, updateStep, deleteStep, reorderSteps };
}

export function useFlowEnrollments(flowId?: string) {
  const { accountId } = useAccountId();
  return useQuery({
    queryKey: ["custom-followup-enrollments", flowId, accountId],
    queryFn: async () => {
      if (!accountId) return [];
      let q = supabase
        .from("custom_followup_enrollments")
        .select("*").eq("account_id", accountId)
        .order("created_at", { ascending: false }).limit(200);
      if (flowId) q = q.eq("flow_id", flowId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CustomEnrollment[];
    },
    enabled: !!accountId,
  });
}

export async function uploadFollowupMedia(accountId: string, flowId: string, file: File): Promise<{ url: string; mime: string; name: string }> {
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${accountId}/${flowId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from("followup-media").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("followup-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (!data?.signedUrl) throw new Error("Falha ao gerar URL");
  return { url: data.signedUrl, mime: file.type, name: file.name };
}

export async function enrollPhones(input: { flow_id: string; phones?: string[]; contact_ids?: string[]; instance_id?: string | null; source?: string; }) {
  const { data, error } = await supabase.functions.invoke("custom-followup-enroll", { body: input });
  if (error) throw error;
  return data as { enrolled: number; skipped: number };
}

/**
 * Dispara fluxos personalizados que combinam com o evento.
 * Chama do client após auth — RLS garante que só fluxos da conta retornam.
 */
export async function fireCustomFollowupTrigger(params: {
  account_id: string;
  trigger_type: TriggerType;
  phone: string;
  match?: Record<string, any>; // ex: { stage_id, pipeline_id, outcome }
  source?: string;
}) {
  const { account_id, trigger_type, phone, match = {}, source } = params;
  if (!phone) return { fired: 0 };
  const { data: flows, error } = await supabase
    .from("custom_followup_flows")
    .select("id, trigger_config")
    .eq("account_id", account_id)
    .eq("trigger_type", trigger_type)
    .eq("enabled", true);
  if (error || !flows?.length) return { fired: 0 };

  let fired = 0;
  for (const f of flows) {
    const cfg: any = f.trigger_config || {};
    // Match opcional: se cfg tem chave, precisa bater
    let ok = true;
    for (const [k, v] of Object.entries(match)) {
      if (cfg[k] != null && cfg[k] !== v) { ok = false; break; }
    }
    if (!ok) continue;
    try {
      await enrollPhones({ flow_id: f.id, phones: [phone], source: source || trigger_type });
      fired++;
    } catch (e) {
      console.warn("fireCustomFollowupTrigger failed for flow", f.id, e);
    }
  }
  return { fired };
}