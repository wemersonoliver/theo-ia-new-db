import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["knowledge-documents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("knowledge_base_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as KnowledgeDocument[];
    },
    enabled: !!user,
  });

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from("knowledge_base_documents")
        .insert({
          user_id: user.id,
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
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", user?.id] });
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
