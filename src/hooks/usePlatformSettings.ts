import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface PlatformSettings {
  id: string;
  user_id: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlatformSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platform-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as PlatformSettings | null;
    },
    enabled: !!user,
  });

  const saveSettings = useMutation({
    mutationFn: async (updates: Partial<PlatformSettings>) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("platform_settings")
          .update(updates)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert({ user_id: user.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings", user?.id] });
      toast.success("Configurações salvas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  return {
    settings,
    isLoading,
    saveSettings,
  };
}
