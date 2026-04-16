import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WelcomeQueueItem {
  id: string;
  user_id: string;
  phone: string;
  full_name: string | null;
  scheduled_at: string;
  processed: boolean;
  processed_at: string | null;
  skipped_reason: string | null;
  error_message: string | null;
  created_at: string;
}

export function useWelcomeQueue() {
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["system-welcome-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_welcome_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as WelcomeQueueItem[];
    },
    refetchInterval: 15000,
  });

  const sendTest = useMutation({
    mutationFn: async (params: { phone: string; full_name?: string }) => {
      const cleanPhone = params.phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) throw new Error("Telefone inválido");
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) throw new Error("Não autenticado");

      // Insert with scheduled_at = now() so the cron picks immediately
      const { error } = await (supabase as any)
        .from("system_welcome_queue")
        .insert({
          user_id: uid,
          phone: cleanPhone.length === 10 || cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone,
          full_name: params.full_name || "Teste",
          scheduled_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teste enfileirado! Será enviado em até 1 minuto.");
      qc.invalidateQueries({ queryKey: ["system-welcome-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("send-welcome-sequence");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Processamento disparado");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["system-welcome-queue"] }), 1500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { items: items || [], isLoading, sendTest, runNow };
}
