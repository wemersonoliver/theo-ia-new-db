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
  account_id: string | null;
  instance_name: string;
  display_name: string | null;
  department_slug: string | null;
  is_primary: boolean;
  ai_enabled: boolean;
  followup_enabled: boolean;
  transfer_message: string | null;
  status: "pending" | "qr_ready" | "connected" | "disconnected" | string;
  qr_code_base64: string | null;
  pairing_code: string | null;
  phone_number: string | null;
  profile_name: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateArgs {
  departmentName: string;
  phoneNumber?: string | null;
}

interface ConnectionResponse {
  success: boolean;
  message?: string;
  qrCode?: string | null;
  pairingCode?: string | null;
  status?: WhatsAppInstance["status"];
  instanceId?: string;
}

export function useWhatsAppInstances() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("account_id", accountId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as WhatsAppInstance[];
    },
    enabled: !!user && !!accountId,
    refetchInterval: (query) => {
      const list = (query.state.data as WhatsAppInstance[] | undefined) || [];
      return list.some((i) => i.status === "pending" || i.status === "qr_ready") ? 2500 : false;
    },
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`whatsapp-instances-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_instances", filter: `account_id=eq.${accountId}` },
        () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", accountId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  const createInstance = useMutation({
    mutationFn: async (args: CreateArgs) => {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-instance", {
        body: { departmentName: args.departmentName, phoneNumber: args.phoneNumber || undefined },
      });
      if (error) throw await toFunctionError(error);
      return data as ConnectionResponse;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", accountId] });
      if (vars.phoneNumber) {
        if (data?.pairingCode) toast.success("Código de conexão gerado.");
        else toast.error(data?.message || "Não foi possível gerar o código.");
        return;
      }
      toast.success(`Departamento "${vars.departmentName}" criado.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnectInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke("disconnect-whatsapp-instance", {
        body: { instanceId },
      });
      if (error) throw await toFunctionError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", accountId] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshQRCode = useMutation({
    mutationFn: async (args: { instanceId: string; phoneNumber?: string | null }) => {
      const { data, error } = await supabase.functions.invoke("refresh-whatsapp-qrcode", {
        body: { instanceId: args.instanceId, phoneNumber: args.phoneNumber || undefined },
      });
      if (error) throw await toFunctionError(error);
      return data as ConnectionResponse;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", accountId] });
      if (vars.phoneNumber) {
        if (data?.pairingCode) toast.success("Novo código gerado.");
        else toast.error(data?.message || "Não foi possível gerar o código.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateInstance = useMutation({
    mutationFn: async (args: { instanceId: string; patch: Partial<Pick<WhatsAppInstance, "display_name" | "ai_enabled" | "followup_enabled" | "transfer_message">> }) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ ...args.patch, updated_at: new Date().toISOString() })
        .eq("id", args.instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", accountId] });
      toast.success("Atualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const primary = instances.find((i) => i.is_primary) || instances[0] || null;

  return {
    instances,
    primary,
    isLoading,
    createInstance,
    disconnectInstance,
    refreshQRCode,
    updateInstance,
  };
}