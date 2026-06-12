import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export type SystemAIProvider = "gemini" | "openai";

interface Row {
  id: string;
  primary_provider: SystemAIProvider;
  updated_at: string;
  updated_by: string | null;
}

export function useSystemAIProvider() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["system-ai-provider"],
    queryFn: async (): Promise<Row | null> => {
      const { data, error } = await (supabase as any)
        .from("system_ai_provider")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  const mutate = useMutation({
    mutationFn: async (provider: SystemAIProvider) => {
      const existing = query.data;
      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("system_ai_provider")
          .update({ primary_provider: provider, updated_by: user?.id ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("system_ai_provider")
          .insert({ primary_provider: provider, updated_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: (_d, provider) => {
      qc.invalidateQueries({ queryKey: ["system-ai-provider"] });
      toast.success(`IA padrão alterada para ${provider === "openai" ? "OpenAI (GPT)" : "Gemini (Google)"}`);
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  return {
    provider: (query.data?.primary_provider ?? "gemini") as SystemAIProvider,
    isLoading: query.isLoading,
    updatedAt: query.data?.updated_at ?? null,
    setProvider: mutate.mutate,
    isSaving: mutate.isPending,
  };
}
