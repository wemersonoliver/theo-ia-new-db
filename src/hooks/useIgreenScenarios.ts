import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export type ScenarioKey = "CENARIO1" | "CENARIO2" | "CENARIO3";
export type ItemType = "text" | "audio" | "video" | "image" | "document";
export type DelayUnit = "seconds" | "minutes";
export type Period = "morning" | "evening";

export interface IgreenScenario {
  id: string;
  account_id: string;
  scenario_key: ScenarioKey;
  name: string;
  description: string | null;
  enabled: boolean;
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

const DEFAULTS: { key: ScenarioKey; name: string }[] = [
  { key: "CENARIO1", name: "Cenário 1" },
  { key: "CENARIO2", name: "Cenário 2" },
  { key: "CENARIO3", name: "Cenário 3" },
];

export function useIgreenScenarios() {
  const accountId = useAccountId();
  const qc = useQueryClient();

  const scenariosQ = useQuery({
    queryKey: ["igreen-scenarios", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("igreen_scenarios")
        .select("*")
        .eq("account_id", accountId!)
        .order("scenario_key");

      const present = new Set((existing ?? []).map((s: any) => s.scenario_key));
      const missing = DEFAULTS.filter((d) => !present.has(d.key));
      if (missing.length) {
        await supabase.from("igreen_scenarios").insert(
          missing.map((m) => ({
            account_id: accountId,
            scenario_key: m.key,
            name: m.name,
            enabled: true,
          }))
        );
        const { data: refreshed } = await supabase
          .from("igreen_scenarios")
          .select("*")
          .eq("account_id", accountId!)
          .order("scenario_key");
        return (refreshed ?? []) as IgreenScenario[];
      }
      return (existing ?? []) as IgreenScenario[];
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

  return { scenariosQ, updateScenario };
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