import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface RouletteConfig {
  id: string;
  account_id: string;
  enabled: boolean;
  participant_user_ids: string[];
  last_assigned_user_id: string | null;
  last_assigned_at: string | null;
}

export function useRouletteConfig() {
  const { membership } = useAccount();
  const qc = useQueryClient();
  const accountId = membership?.account_id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["roulette-config", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<RouletteConfig | null> => {
      const { data, error } = await (supabase as any)
        .from("roulette_config")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data as RouletteConfig | null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Omit<RouletteConfig, "id" | "account_id">>) => {
      if (!accountId) throw new Error("Sem conta");
      const payload = {
        account_id: accountId,
        enabled: patch.enabled ?? config?.enabled ?? false,
        participant_user_ids: patch.participant_user_ids ?? config?.participant_user_ids ?? [],
      };
      const { error } = await (supabase as any)
        .from("roulette_config")
        .upsert(payload, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roulette-config", accountId] });
      toast.success("Roleta atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { config, isLoading, upsert };
}
