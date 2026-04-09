import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toFunctionError } from "@/lib/supabase-function-error";
import { toast } from "sonner";

export interface SystemWhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  qr_code_base64: string | null;
  phone_number: string | null;
  profile_name: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSystemWhatsApp() {
  const queryClient = useQueryClient();

  const { data: instance, isLoading } = useQuery({
    queryKey: ["system-whatsapp-instance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_whatsapp_instance")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SystemWhatsAppInstance | null;
    },
    refetchInterval: 5000, // Poll every 5 seconds for QR/status updates
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-system-whatsapp", {
        body: { action: "connect" },
      });
      if (error) throw await toFunctionError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-whatsapp-instance"] });
      toast.success("Instância do sistema criada! Escaneie o QR Code.");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-system-whatsapp", {
        body: { action: "disconnect" },
      });
      if (error) throw await toFunctionError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-whatsapp-instance"] });
      toast.success("WhatsApp do sistema desconectado.");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const refreshQR = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-system-whatsapp", {
        body: { action: "refresh_qr" },
      });
      if (error) throw await toFunctionError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-whatsapp-instance"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar QR: ${error.message}`);
    },
  });

  return { instance, isLoading, connect, disconnect, refreshQR };
}
