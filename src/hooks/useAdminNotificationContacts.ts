import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AdminNotificationContact {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAdminNotificationContacts() {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["admin-notification-contacts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_notification_contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdminNotificationContact[];
    },
  });

  const createContact = useMutation({
    mutationFn: async (data: { phone: string; name?: string }) => {
      const { error } = await (supabase as any)
        .from("admin_notification_contacts")
        .insert({ phone: data.phone, name: data.name || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-contacts"] });
      toast.success("Contato de notificação adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleContact = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from("admin_notification_contacts")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("admin_notification_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-contacts"] });
      toast.success("Contato removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { contacts, isLoading, createContact, toggleContact, deleteContact };
}
