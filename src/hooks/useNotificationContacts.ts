import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface NotificationContact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  notify_appointments: boolean;
  notify_handoffs: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotificationContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["notification_contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_contacts" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as NotificationContact[];
    },
  });

  const createContact = useMutation({
    mutationFn: async (data: { phone: string; name?: string; notify_appointments?: boolean; notify_handoffs?: boolean }) => {
      const { error } = await supabase.from("notification_contacts" as any).insert({
        user_id: user!.id,
        phone: data.phone,
        name: data.name || null,
        notify_appointments: data.notify_appointments ?? true,
        notify_handoffs: data.notify_handoffs ?? true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_contacts", user?.id] });
      toast.success("Contato de notificação adicionado!");
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("unique") ? "Este telefone já está cadastrado" : "Erro ao adicionar contato"),
  });

  const updateContact = useMutation({
    mutationFn: async (contact: Partial<NotificationContact> & { id: string }) => {
      const { error } = await supabase
        .from("notification_contacts" as any)
        .update({
          name: contact.name,
          phone: contact.phone,
          notify_appointments: contact.notify_appointments,
          notify_handoffs: contact.notify_handoffs,
        } as any)
        .eq("id", contact.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_contacts", user?.id] });
      toast.success("Contato atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_contacts" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_contacts", user?.id] });
      toast.success("Contato removido!");
    },
    onError: () => toast.error("Erro ao remover contato"),
  });

  return { contacts, isLoading, createContact, updateContact, deleteContact };
}
