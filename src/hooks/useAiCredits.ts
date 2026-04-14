import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AiCredits {
  id: string;
  user_id: string;
  balance_cents: number;
  total_added_cents: number;
  total_consumed_cents: number;
  voice_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiCreditTransaction {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

// Hook for admin — manage all users' credits
export function useAdminAiCredits() {
  const queryClient = useQueryClient();

  const { data: allCredits, isLoading } = useQuery({
    queryKey: ["admin-ai-credits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_credits")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AiCredits[];
    },
  });

  const addCredits = useMutation({
    mutationFn: async ({ userId, amountCents, description }: { userId: string; amountCents: number; description?: string }) => {
      // Get or create credits record
      const { data: existing } = await (supabase as any)
        .from("ai_credits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let newBalance: number;
      let newTotalAdded: number;

      if (existing) {
        newBalance = existing.balance_cents + amountCents;
        newTotalAdded = existing.total_added_cents + amountCents;
        const { error } = await (supabase as any)
          .from("ai_credits")
          .update({ balance_cents: newBalance, total_added_cents: newTotalAdded })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        newBalance = amountCents;
        newTotalAdded = amountCents;
        const { error } = await (supabase as any)
          .from("ai_credits")
          .insert({ user_id: userId, balance_cents: amountCents, total_added_cents: amountCents, voice_enabled: true });
        if (error) throw error;
      }

      // Record transaction
      await (supabase as any).from("ai_credit_transactions").insert({
        user_id: userId,
        type: "credit",
        amount_cents: amountCents,
        balance_after_cents: newBalance,
        description: description || "Recarga manual pelo admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-credits"] });
      toast.success("Créditos adicionados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVoice = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const { data: existing } = await (supabase as any)
        .from("ai_credits")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from("ai_credits")
          .update({ voice_enabled: enabled })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("ai_credits")
          .insert({ user_id: userId, voice_enabled: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-credits"] });
      toast.success("Configuração de voz atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { allCredits, isLoading, addCredits, toggleVoice };
}

// Hook for user — read own credits
export function useUserAiCredits() {
  const { data: credits, isLoading } = useQuery({
    queryKey: ["user-ai-credits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_credits")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as AiCredits | null;
    },
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["user-ai-credit-transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AiCreditTransaction[];
    },
  });

  return { credits, transactions, isLoading, loadingTx };
}
