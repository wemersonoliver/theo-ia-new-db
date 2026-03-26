import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

export function useSupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  const createTicket = useMutation({
    mutationFn: async ({ subject, description, priority }: { subject: string; description: string; priority?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .insert({ user_id: user.id, subject, description, priority: priority || "medium" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTicket> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("support_tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { tickets: tickets || [], isLoading, createTicket, updateTicket };
}

export function useTicketMessages(ticketId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!ticketId,
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, senderType }: { content: string; senderType?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase as any)
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          sender_type: senderType || "user",
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { messages: messages || [], isLoading, sendMessage };
}

// Admin-specific: fetch ALL tickets
export function useAdminSupportTickets() {
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTicket> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("support_tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Ticket atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { tickets: tickets || [], isLoading, updateTicket };
}
