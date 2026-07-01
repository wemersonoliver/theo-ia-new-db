import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export type SystemWaProvider = "evolution" | "waha";

interface Row {
  id: string;
  default_provider: SystemWaProvider;
  updated_at: string;
  updated_by: string | null;
}

export function useSystemWaProvider() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["system-wa-provider"],
    queryFn: async (): Promise<Row | null> => {
      const { data, error } = await (supabase as any)
        .from("system_wa_provider")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  const mutate = useMutation({
    mutationFn: async (provider: SystemWaProvider) => {
      const existing = query.data;
      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("system_wa_provider")
          .update({ default_provider: provider, updated_by: user?.id ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("system_wa_provider")
          .insert({ default_provider: provider, updated_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: (_d, provider) => {
      qc.invalidateQueries({ queryKey: ["system-wa-provider"] });
      toast.success(
        `Provedor padrão de WhatsApp alterado para ${provider === "waha" ? "WAHA" : "Evolution API"}`,
      );
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  return {
    provider: (query.data?.default_provider ?? "evolution") as SystemWaProvider,
    isLoading: query.isLoading,
    updatedAt: query.data?.updated_at ?? null,
    setProvider: mutate.mutate,
    isSaving: mutate.isPending,
  };
}
