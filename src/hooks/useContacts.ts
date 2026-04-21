import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { resolveAccountContext } from "@/lib/account-context";
import { useAccountId } from "@/hooks/useAccount";

export interface Contact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export function useContacts() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", accountId],
    enabled: !!user && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("account_id", accountId!)
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
        .eq("account_id", accountId!);
      if (convErr) throw convErr;

      if (!convs || convs.length === 0) return;

      const ctx = await resolveAccountContext(user!.id);
      // Upsert ignorando duplicatas (a constraint unique já cuida)
      const rows = convs.map((c) => ({
        user_id: user!.id,
        account_id: ctx?.accountId,
        phone: c.phone,
        name: c.contact_name || null,
      }));

      const { error } = await supabase
        .from("contacts")
        .upsert(rows, { onConflict: "user_id,phone", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (contact: Partial<Contact> & { id: string }) => {
      const updates: Record<string, any> = {};
      if (contact.name !== undefined) updates.name = contact.name;
      if (contact.email !== undefined) updates.email = contact.email;
      if (contact.notes !== undefined) updates.notes = contact.notes;
      if (contact.phone !== undefined) updates.phone = contact.phone;
      if (contact.tags !== undefined) updates.tags = contact.tags;
      if (contact.assigned_to !== undefined) updates.assigned_to = contact.assigned_to;
      const { error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", accountId] });
      toast.success("Contato atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", accountId] });
      toast.success("Contato removido!");
    },
    onError: () => toast.error("Erro ao remover contato"),
  });

  const createContact = useMutation({
    mutationFn: async (data: { phone: string; name?: string; email?: string; notes?: string; tags?: string[] }) => {
      const ctx = await resolveAccountContext(user!.id);
      const { error } = await supabase.from("contacts").insert({
        user_id: user!.id,
        account_id: ctx?.accountId,
        assigned_to: user!.id,
        phone: data.phone,
        name: data.name || null,
        email: data.email || null,
        notes: data.notes || null,
        tags: data.tags || [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", accountId] });
      toast.success("Contato criado!");
    },
    onError: (e: Error) => toast.error(e.message.includes("unique") ? "Telefone já cadastrado" : "Erro ao criar contato"),
  });

  return { contacts, isLoading, updateContact, deleteContact, createContact, syncFromConversations };
}
