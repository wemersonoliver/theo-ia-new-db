import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface Contact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function useContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user!.id)
        .order("name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const syncFromConversations = useMutation({
    mutationFn: async () => {
      // Busca todos os phones das conversas que ainda não estão nos contatos
      const { data: convs, error: convErr } = await supabase
        .from("whatsapp_conversations")
        .select("phone, contact_name")
        .eq("user_id", user!.id);
      if (convErr) throw convErr;

      if (!convs || convs.length === 0) return;

      // Upsert ignorando duplicatas (a constraint unique já cuida)
      const rows = convs.map((c) => ({
        user_id: user!.id,
        phone: c.phone,
        name: c.contact_name || null,
      }));

      const { error } = await supabase
        .from("contacts")
        .upsert(rows, { onConflict: "user_id,phone", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", user?.id] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (contact: Partial<Contact> & { id: string }) => {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: contact.name,
          email: contact.email,
          notes: contact.notes,
          phone: contact.phone,
          tags: contact.tags,
        })
        .eq("id", contact.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", user?.id] });
      toast.success("Contato atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", user?.id] });
      toast.success("Contato removido!");
    },
    onError: () => toast.error("Erro ao remover contato"),
  });

  const createContact = useMutation({
    mutationFn: async (data: { phone: string; name?: string; email?: string; notes?: string; tags?: string[] }) => {
      const { error } = await supabase.from("contacts").insert({
        user_id: user!.id,
        phone: data.phone,
        name: data.name || null,
        email: data.email || null,
        notes: data.notes || null,
        tags: data.tags || [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", user?.id] });
      toast.success("Contato criado!");
    },
    onError: (e: Error) => toast.error(e.message.includes("unique") ? "Telefone já cadastrado" : "Erro ao criar contato"),
  });

  return { contacts, isLoading, updateContact, deleteContact, createContact, syncFromConversations };
}
