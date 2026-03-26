import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SystemAIConfig {
  id: string;
  custom_prompt: string | null;
  agent_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSystemAIConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["system-ai-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_ai_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SystemAIConfig | null;
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Partial<SystemAIConfig>) => {
      if (config?.id) {
        const { error } = await (supabase as any)
          .from("system_ai_config")
          .update(updates)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("system_ai_config")
          .insert({ ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-ai-config"] });
      toast.success("Configuração salva!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { config, isLoading, upsertConfig };
}
