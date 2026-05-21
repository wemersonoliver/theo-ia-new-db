import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export type ScenarioKey = string;
export type ProductKey = "green" | "telecom" | "expansao" | string;
export type ItemType = "text" | "audio" | "video" | "image" | "document";
export type DelayUnit = "seconds" | "minutes";
export type Period = "morning" | "evening";

export interface IgreenProduct {
  key: ProductKey;
  name: string;
  description: string | null;
  enabled: boolean;
  position: number;
}

export interface IgreenScenario {
  id: string;
  account_id: string;
  scenario_key: ScenarioKey | null;
  product_key: ProductKey;
  trigger_tag: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  final_tag: string | null;
  final_tag_delay_hours: number;
  created_at: string;
  updated_at: string;
}

export interface IgreenDay {
  id: string;
  scenario_id: string;
  day_number: number;
  enabled: boolean;
}

export interface IgreenMessage {
  id: string;
  day_id: string;
  period: Period;
  label: string | null;
}

export interface IgreenItem {
  id: string;
  message_id: string;
  position: number;
  type: ItemType;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  delay_value: number;
  delay_unit: DelayUnit;
}

export function useIgreenScenarios() {
  const { accountId } = useAccountId();
  const qc = useQueryClient();

  const productsQ = useQuery({
    queryKey: ["igreen-products", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("igreen_account_products")
        .select("key, name, description, enabled, position")
        .eq("account_id", accountId!)
        .eq("enabled", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as IgreenProduct[];
    },
  });

  const scenariosQ = useQuery({
    queryKey: ["igreen-scenarios", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("igreen_scenarios")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as IgreenScenario[];
    },
  });

  const updateScenario = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<IgreenScenario> }) => {
      const { error } = await supabase
        .from("igreen_scenarios")
        .update(vars.patch)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-scenarios"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const createScenario = useMutation({
    mutationFn: async (vars: { product_key: ProductKey; name: string; trigger_tag?: string | null; description?: string | null }) => {
      if (!accountId) throw new Error("account não disponível");
      const { data, error } = await supabase
        .from("igreen_scenarios")
        .insert({
          account_id: accountId,
          product_key: vars.product_key,
          name: vars.name,
          trigger_tag: vars.trigger_tag ?? null,
          description: vars.description ?? null,
          enabled: true,
        })
        .select()
        .single();
      if (error) throw error;
      // cria dia 1 automaticamente (manhã + tarde)
      const { data: day } = await supabase
        .from("igreen_scenario_days")
        .insert({ scenario_id: data.id, day_number: 1, enabled: true })
        .select()
        .single();
      if (day) {
        await supabase.from("igreen_scenario_messages").insert([
          { day_id: day.id, period: "morning", label: "Manhã" },
          { day_id: day.id, period: "evening", label: "Tarde" },
        ]);
      }
      return data as IgreenScenario;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-scenarios"] });
      toast.success("Cenário criado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar cenário"),
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("igreen_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-scenarios"] });
      toast.success("Cenário excluído");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir cenário"),
  });

  return { scenariosQ, productsQ, updateScenario, createScenario, deleteScenario };
}

export function useIgreenDays(scenarioId: string | null) {
  const qc = useQueryClient();

  const daysQ = useQuery({
    queryKey: ["igreen-days", scenarioId],
    enabled: !!scenarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("igreen_scenario_days")
        .select("*")
        .eq("scenario_id", scenarioId!)
        .order("day_number");
      if (error) throw error;
      return (data ?? []) as IgreenDay[];
    },
  });

  const addDay = useMutation({
    mutationFn: async () => {
      const existing = daysQ.data ?? [];
      const nextNum = (existing[existing.length - 1]?.day_number ?? 0) + 1;
      const { data: day, error } = await supabase
        .from("igreen_scenario_days")
        .insert({ scenario_id: scenarioId, day_number: nextNum, enabled: true })
        .select()
        .single();
      if (error) throw error;
      // cria mensagens manhã e tarde
      await supabase.from("igreen_scenario_messages").insert([
        { day_id: day.id, period: "morning", label: "Manhã" },
        { day_id: day.id, period: "evening", label: "Tarde" },
      ]);
      return day;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-days", scenarioId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar dia"),
  });

  const toggleDay = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("igreen_scenario_days")
        .update({ enabled: vars.enabled })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-days", scenarioId] }),
  });

  const removeDay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("igreen_scenario_days").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-days", scenarioId] }),
  });

  return { daysQ, addDay, toggleDay, removeDay };
}

export function useIgreenDayContent(dayId: string | null) {
  const qc = useQueryClient();

  const contentQ = useQuery({
    queryKey: ["igreen-day-content", dayId],
    enabled: !!dayId,
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from("igreen_scenario_messages")
        .select("*")
        .eq("day_id", dayId!)
        .order("period");
      if (error) throw error;
      const msgIds = (messages ?? []).map((m: any) => m.id);
      const { data: items } = msgIds.length
        ? await supabase
            .from("igreen_scenario_items")
            .select("*")
            .in("message_id", msgIds)
            .order("position")
        : { data: [] as any[] };
      return {
        messages: (messages ?? []) as IgreenMessage[],
        items: (items ?? []) as IgreenItem[],
      };
    },
  });

  const addItem = useMutation({
    mutationFn: async (vars: Partial<IgreenItem> & { message_id: string }) => {
      const items = contentQ.data?.items.filter((i) => i.message_id === vars.message_id) ?? [];
      const position = items.length;
      const { error } = await supabase.from("igreen_scenario_items").insert({
        message_id: vars.message_id,
        position,
        type: vars.type ?? "text",
        content: vars.content ?? null,
        caption: vars.caption ?? null,
        media_url: vars.media_url ?? null,
        media_mime: vars.media_mime ?? null,
        media_filename: vars.media_filename ?? null,
        delay_value: vars.delay_value ?? 0,
        delay_unit: vars.delay_unit ?? "seconds",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-day-content", dayId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar item"),
  });

  const updateItem = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<IgreenItem> }) => {
      const { error } = await supabase
        .from("igreen_scenario_items")
        .update(vars.patch)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-day-content", dayId] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("igreen_scenario_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["igreen-day-content", dayId] }),
  });

  return { contentQ, addItem, updateItem, removeItem };
}