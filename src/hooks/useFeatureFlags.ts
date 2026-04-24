import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface FeatureFlags {
  keyword_triggers: boolean;
}

/**
 * Lê as feature flags do usuário a partir da tabela `profiles`.
 * Por padrão, todas as flags são `false` (funcionalidade oculta) até que
 * um super admin libere o acesso individual via painel /admin/users.
 */
export function useFeatureFlags() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FeatureFlags> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("feature_keyword_triggers")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error || !data) {
        return { keyword_triggers: false };
      }
      return {
        keyword_triggers: !!(data as { feature_keyword_triggers?: boolean }).feature_keyword_triggers,
      };
    },
  });

  return {
    flags: data ?? { keyword_triggers: false },
    isLoading,
  };
}