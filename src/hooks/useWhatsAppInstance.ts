import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { toast } from "sonner";

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: "pending" | "qr_ready" | "connected" | "disconnected";
  qr_code_base64: string | null;
  phone_number: string | null;
  profile_name: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppInstance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: instance, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-instance", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as WhatsAppInstance | null;
    },
    enabled: !!user,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("whatsapp-instance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_instances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const createInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-instance");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", user?.id] });
      toast.success("Instância criada! Escaneie o QR Code para conectar.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar instância: ${error.message}`);
    },
  });

  const disconnectInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("disconnect-whatsapp-instance");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", user?.id] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  const refreshQRCode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("refresh-whatsapp-qrcode");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", user?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar QR Code: ${error.message}`);
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
