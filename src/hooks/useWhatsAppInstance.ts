import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { toFunctionError } from "@/lib/supabase-function-error";
import { useEffect } from "react";
import { toast } from "sonner";

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: "pending" | "qr_ready" | "connected" | "disconnected";
  qr_code_base64: string | null;
  pairing_code: string | null;
  phone_number: string | null;
  profile_name: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WhatsAppConnectionResponse {
  success: boolean;
  message?: string;
  qrCode?: string | null;
  pairingCode?: string | null;
  status?: WhatsAppInstance["status"];
}

export function useWhatsAppInstance() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: instance, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-instance", accountId],
    queryFn: async () => {
      if (!user || !accountId) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WhatsAppInstance | null;
    },
    enabled: !!user && !!accountId,
    refetchInterval: (query) => {
      const status = (query.state.data as WhatsAppInstance | null | undefined)?.status;
      return status === "pending" || status === "qr_ready" ? 2500 : false;
    },
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!user || !accountId) return;
    const channel = supabase
      .channel("whatsapp-instance-changes")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "whatsapp_instances",
        filter: `account_id=eq.${accountId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", accountId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, accountId, queryClient]);

  const createInstance = useMutation({
    mutationFn: async (phoneNumber?: string | void) => {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-instance", {
        body: phoneNumber ? { phoneNumber } : {},
      });
      if (error) throw await toFunctionError(error);
      return data as WhatsAppConnectionResponse;
    },
    onSuccess: (data, phoneNumber) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", accountId] });

      if (phoneNumber) {
        if (data?.pairingCode) {
          toast.success("Código de conexão gerado com sucesso.");
        } else {
          toast.error(data?.message || "Não foi possível gerar um código válido de conexão.");
        }
        return;
      }

      toast.success("Instância criada! Conecte seu WhatsApp.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar instância: ${error.message}`);
    },
  });

  const disconnectInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("disconnect-whatsapp-instance");
      if (error) throw await toFunctionError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", accountId] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  const refreshQRCode = useMutation({
    mutationFn: async (phoneNumber?: string | void) => {
      const { data, error } = await supabase.functions.invoke("refresh-whatsapp-qrcode", {
        body: phoneNumber ? { phoneNumber } : {},
      });
      if (error) throw await toFunctionError(error);
      return data as WhatsAppConnectionResponse;
    },
    onSuccess: (data, phoneNumber) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", accountId] });

      if (!phoneNumber) return;

      if (data?.pairingCode) {
        toast.success("Novo código de conexão gerado.");
      } else {
        toast.error(data?.message || "Não foi possível gerar um código válido de conexão.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar conexão: ${error.message}`);
    },
  });

  return {
    instance,
    isLoading,
    refetch,
    createInstance,
    disconnectInstance,
    refreshQRCode,
  };
}
