import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  created_at: string;
  updated_at: string;
}

export function useAIConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("whatsapp_ai_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as AIConfig | null;
    },
    enabled: !!user,
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: Partial<AIConfig>) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existing } = await supabase
        .from("whatsapp_ai_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update(updates)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .insert({ user_id: user.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", user?.id] });
      toast.success("Configurações salvas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existing } = await supabase
        .from("whatsapp_ai_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update({ active })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .insert({ user_id: user.id, active });
        if (error) throw error;
      }
    },
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", user?.id] });
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
