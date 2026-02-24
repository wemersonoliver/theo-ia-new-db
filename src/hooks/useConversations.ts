import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { toast } from "sonner";

export interface Message {
  id: string;
  timestamp: string;
  from_me: boolean;
  content: string;
  type: "text" | "image" | "audio" | "video" | "document";
  sent_by: "human" | "ai" | "ai_first_contact";
}

export interface Conversation {
  id: string;
  user_id: string;
  phone: string;
  contact_name: string | null;
  messages: Message[];
  last_message_at: string | null;
  total_messages: number;
  ai_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        messages: (d.messages as unknown as Message[]) || [],
      })) as Conversation[];
    },
    enabled: !!user,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ phone, content }: { phone: string; content: string }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: { phone, content },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const toggleAI = useMutation({
    mutationFn: async ({ phone, active }: { phone: string; active: boolean }) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ ai_active: active, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("phone", phone);
      
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      toast.success(active ? "IA reativada para esta conversa!" : "IA desativada para esta conversa.");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    conversations: conversations || [],
    isLoading,
    sendMessage,
    toggleAI,
  };
}

export function useConversation(phone: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading } = useQuery({
    queryKey: ["conversation", user?.id, phone],
    queryFn: async () => {
      if (!user || !phone) return null;
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("phone", phone)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        messages: (data.messages as unknown as Message[]) || [],
      } as Conversation;
    },
    enabled: !!user && !!phone,
  });

  // Subscribe to realtime updates for this specific conversation
  useEffect(() => {
    if (!user || !phone) return;

    const channel = supabase
      .channel(`conversation-${phone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const record = payload.new as Conversation;
          if (record.phone === phone) {
            queryClient.invalidateQueries({ queryKey: ["conversation", user.id, phone] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, phone, queryClient]);

  return {
    conversation,
    isLoading,
    messages: (conversation?.messages as Message[]) || [],
  };
}
