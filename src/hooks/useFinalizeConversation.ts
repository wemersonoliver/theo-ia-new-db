import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConversationOutcome = "won" | "lost" | "abandoned";

export function useFinalizeConversation() {
  const qc = useQueryClient();

  const finalize = useMutation({
    mutationFn: async (params: {
      conversationId: string;
      outcome: ConversationOutcome;
      reason?: string | null;
      valueCents?: number | null;
      stageId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("finalize_conversation", {
        _conversation_id: params.conversationId,
        _outcome: params.outcome,
        _reason: params.reason ?? null,
        _value_cents: params.valueCents ?? null,
        _stage_id: params.stageId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
      qc.invalidateQueries({ queryKey: ["crm-deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Atendimento finalizado!");
    },
    onError: (e: Error) => toast.error(`Erro ao finalizar: ${e.message}`),
  });

  const reopen = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.rpc("reopen_conversation", {
        _conversation_id: conversationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Atendimento reaberto.");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return { finalize, reopen };
}
