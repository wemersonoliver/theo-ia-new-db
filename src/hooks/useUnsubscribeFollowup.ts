import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Desinscreve um telefone de todos os tipos de follow-up automático:
 * - custom_followup_enrollments (fluxos personalizados ativos) → status = 'stopped'
 * - custom_followup_queue (mensagens pendentes na fila) → status = 'cancelled'
 * - followup_tracking (follow-up automático da IA) → status = 'declined'
 */
export function useUnsubscribeFollowup() {
  const { accountId } = useAccountId();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      if (!phone) throw new Error("Telefone ausente");
      if (!accountId && !user?.id) throw new Error("Sem conta/usuário");

      const results = { enrollments: 0, queue: 0, ai: 0 };

      // 1) Custom follow-up: inscrições ativas
      if (accountId) {
        const { data: enr, error: e1 } = await supabase
          .from("custom_followup_enrollments")
          .update({
            status: "stopped",
            stop_reason: "manual_unsubscribe",
            next_scheduled_at: null,
          })
          .eq("account_id", accountId)
          .eq("phone", phone)
          .eq("status", "active")
          .select("id");
        if (e1) throw e1;
        results.enrollments = enr?.length ?? 0;

        // 2) Custom follow-up: fila pendente
        const { data: q, error: e2 } = await supabase
          .from("custom_followup_queue")
          .update({ status: "cancelled", last_error: "manual_unsubscribe" })
          .eq("account_id", accountId)
          .eq("phone", phone)
          .in("status", ["pending", "scheduled"])
          .select("id");
        if (e2) throw e2;
        results.queue = q?.length ?? 0;
      }

      // 3) Follow-up automático da IA
      if (user?.id) {
        const { data: ai, error: e3 } = await supabase
          .from("followup_tracking")
          .update({
            status: "declined",
            cancellation_reason: "manual_unsubscribe",
            next_scheduled_at: null,
          })
          .eq("user_id", user.id)
          .eq("phone", phone)
          .in("status", ["pending", "scheduled", "engaged"])
          .select("id");
        if (e3) throw e3;
        results.ai = ai?.length ?? 0;
      }

      return results;
    },
    onSuccess: (r) => {
      const total = r.enrollments + r.queue + r.ai;
      if (total === 0) {
        toast.info("Nenhum follow-up ativo encontrado para este contato.");
      } else {
        const parts: string[] = [];
        if (r.enrollments) parts.push(`${r.enrollments} fluxo(s)`);
        if (r.queue) parts.push(`${r.queue} mensagem(ns) na fila`);
        if (r.ai) parts.push(`${r.ai} sequência(s) de IA`);
        toast.success(`Contato desinscrito: ${parts.join(", ")}.`);
      }
      qc.invalidateQueries({ queryKey: ["custom-followup-enrollments"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao desinscrever: ${err?.message ?? String(err)}`);
    },
  });
}