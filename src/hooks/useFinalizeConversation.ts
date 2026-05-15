import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fireCustomFollowupTrigger } from "@/hooks/useCustomFollowup";

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
      // Dispara fluxos personalizados com gatilho "conversation_finalized"
      try {
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("account_id, phone")
          .eq("id", params.conversationId).maybeSingle();
        if (conv?.account_id && conv?.phone) {
          // 1) match por outcome específico
          await fireCustomFollowupTrigger({
            account_id: conv.account_id,
            trigger_type: "conversation_finalized",
            phone: conv.phone,
            match: { outcome: params.outcome },
            source: `finalized:${params.outcome}`,
          });
          // 2) match com outcome=any (sem cfg.outcome) — passamos outcome same para satisfazer
          await fireCustomFollowupTrigger({
            account_id: conv.account_id,
            trigger_type: "conversation_finalized",
            phone: conv.phone,
            match: { outcome: "any" },
            source: `finalized:${params.outcome}`,
          });
        }
      } catch (e) { console.warn("custom followup trigger failed", e); }
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
