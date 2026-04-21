import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface AIConfig {
  id: string;
  user_id: string;
  active: boolean;
  agent_name: string;
  custom_prompt: string | null;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  out_of_hours_message: string;
  handoff_message: string;
  max_messages_without_human: number;
  pre_service_active: boolean;
  initial_message_1: string | null;
  initial_message_2: string | null;
  initial_message_3: string | null;
  delay_between_messages: number;
  trigger_keywords: string[];
  keyword_activation_enabled: boolean;
  response_delay_seconds: number;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_message_template: string | null;
  business_address: string | null;
  business_latitude: number | null;
  business_longitude: number | null;
  business_location_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useAIConfig() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config", accountId],
    queryFn: async () => {
      if (!user || !accountId) return null;
      const { data, error } = await supabase
        .from("whatsapp_ai_config")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AIConfig | null;
    },
    enabled: !!user && !!accountId,
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: Partial<AIConfig>) => {
      if (!user) throw new Error("Usuário não autenticado");
      const ctx = await resolveAccountContext(user.id);

      const { data: existing } = await supabase
        .from("whatsapp_ai_config")
        .select("id")
        .eq("account_id", ctx?.accountId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .insert({ user_id: user.id, account_id: ctx?.accountId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", accountId] });
      toast.success("Configurações salvas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      if (!user) throw new Error("Usuário não autenticado");
      const ctx = await resolveAccountContext(user.id);

      const { data: existing } = await supabase
        .from("whatsapp_ai_config")
        .select("id")
        .eq("account_id", ctx?.accountId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update({ active })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .insert({ user_id: user.id, account_id: ctx?.accountId, active });
        if (error) throw error;
      }
    },
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", accountId] });
      toast.success(active ? "Agente IA ativado!" : "Agente IA desativado.");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    config,
    isLoading,
    saveConfig,
    toggleActive,
  };
}
