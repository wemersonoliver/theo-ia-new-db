import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import type { Message } from "@/hooks/useConversations";

export interface SystemConversation {
  id: string;
  phone: string;
  contact_name: string | null;
  messages: Message[];
  last_message_at: string | null;
  total_messages: number;
  ai_active: boolean;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  finalized_by: string | null;
}

export function useSystemConversations() {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["system-conversations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        messages: (d.messages as unknown as Message[]) || [],
      })) as SystemConversation[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("system-conversations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_whatsapp_conversations" },
        () => queryClient.invalidateQueries({ queryKey: ["system-conversations"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const toggleAI = useMutation({
    mutationFn: async ({ phone, active }: { phone: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from("system_whatsapp_conversations")
        .update({ ai_active: active, updated_at: new Date().toISOString() })
        .eq("phone", phone);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["system-conversations"] });
      toast.success(active ? "IA reativada!" : "IA desativada - assumindo conversa.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteConversation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await (supabase as any)
        .from("system_whatsapp_conversations")
        .delete()
        .eq("phone", phone);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-conversations"] });
      toast.success("Conversa excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizeConversation = useMutation({
    mutationFn: async ({ phone, finalize }: { phone: string; finalize: boolean }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("system_whatsapp_conversations")
        .update({
          finalized_at: finalize ? new Date().toISOString() : null,
          finalized_by: finalize ? userRes.user?.id ?? null : null,
          ai_active: finalize ? false : true,
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);
      if (error) throw error;
    },
    onSuccess: (_, { finalize }) => {
      queryClient.invalidateQueries({ queryKey: ["system-conversations"] });
      toast.success(finalize ? "Atendimento finalizado!" : "Atendimento reaberto!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ phone, content }: { phone: string; content: string }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: { phone, content, system: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { phone }) => {
      queryClient.invalidateQueries({ queryKey: ["system-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["system-conversation", phone] });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar: ${e.message}`),
  });

  const sendMedia = useMutation({
    mutationFn: async ({ phone, file, caption }: { phone: string; file: File; caption?: string }) => {
      const mt = (file.type || "").toLowerCase();
      const mediaType: "image" | "video" | "audio" | "document" =
        mt.startsWith("image/") ? "image" :
        mt.startsWith("video/") ? "video" :
        mt.startsWith("audio/") ? "audio" : "document";

      const safeName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `system/${phone}/outgoing/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const mediaUrl = pub.publicUrl;

      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone,
          mediaUrl,
          mediaType,
          filename: file.name,
          caption: caption || "",
          mimetype: file.type || undefined,
          system: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { phone }) => {
      queryClient.invalidateQueries({ queryKey: ["system-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["system-conversation", phone] });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar mídia: ${e.message}`),
  });

  return { conversations: conversations || [], isLoading, toggleAI, sendMessage, sendMedia, deleteConversation, finalizeConversation };
}

export function useSystemConversation(phone: string) {
  const queryClient = useQueryClient();

  const { data: conversation, isLoading } = useQuery({
    queryKey: ["system-conversation", phone],
    queryFn: async () => {
      if (!phone) return null;
      const { data, error } = await (supabase as any)
        .from("system_whatsapp_conversations")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, messages: (data.messages as unknown as Message[]) || [] } as SystemConversation;
    },
    enabled: !!phone,
  });

  useEffect(() => {
    if (!phone) return;
    const channel = supabase
      .channel(`system-conversation-${phone}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_whatsapp_conversations" },
        (payload) => {
          const record = payload.new as any;
          if (record.phone === phone) {
            queryClient.invalidateQueries({ queryKey: ["system-conversation", phone] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [phone, queryClient]);

  return { conversation, isLoading, messages: conversation?.messages || [] };
}
