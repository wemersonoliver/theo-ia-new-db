import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface KnowledgeDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_text: string | null;
  status: "processing" | "ready" | "error";
  created_at: string;
}

export function useKnowledgeBase() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["knowledge-documents", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const { data, error } = await supabase
        .from("knowledge_base_documents")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as KnowledgeDocument[];
    },
    enabled: !!user && !!accountId,
    refetchInterval: (query) => {
      const docs = query.state.data as KnowledgeDocument[] | undefined;
      const hasProcessing = docs?.some((d) => d.status === "processing");
      return hasProcessing ? 5000 : false;
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Usuário não autenticado");
      const ctx = await resolveAccountContext(user.id);

      // Sanitize file name: remove accents and special characters
      const sanitizedName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from("knowledge_base_documents")
        .insert({
          user_id: user.id,
          account_id: ctx?.accountId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          status: "processing",
        });

      if (insertError) throw insertError;

      // Trigger processing
      await supabase.functions.invoke("process-knowledge-document", {
        body: { filePath },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", accountId] });
      toast.success("Documento enviado! Processando...");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const document = documents?.find((d) => d.id === documentId);
      if (!document) throw new Error("Documento não encontrado");

      // Delete from storage
      await supabase.storage.from("knowledge-base").remove([document.file_path]);

      // Delete from database
      const { error } = await supabase
        .from("knowledge_base_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", accountId] });
      toast.success("Documento removido!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return {
    documents: documents || [],
    isLoading,
    uploadDocument,
    deleteDocument,
  };
}
