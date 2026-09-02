import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface Catalog {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  description: string | null;
  keywords: string[];
  file_url: string;
  file_path: string | null;
  file_type: "image" | "document";
  mime_type: string | null;
  file_name: string | null;
  caption: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

const SEVEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 7;

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-80);
}

export function useCatalogs() {
  const { accountId } = useAccountId();
  const qc = useQueryClient();

  const catalogsQ = useQuery({
    queryKey: ["catalogs", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogs" as any)
        .select("*")
        .eq("account_id", accountId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Catalog[];
    },
  });

  const createCatalog = useMutation({
    mutationFn: async (vars: {
      file: File;
      name: string;
      description?: string;
      keywords?: string[];
      caption?: string;
    }) => {
      if (!accountId) throw new Error("Conta não disponível");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const isImage = vars.file.type.startsWith("image/");
      const isPdf = vars.file.type === "application/pdf";
      if (!isImage && !isPdf) throw new Error("Envie apenas imagem (JPG/PNG) ou PDF.");
      if (vars.file.size > 16 * 1024 * 1024) throw new Error("Arquivo muito grande. Limite: 16MB (WhatsApp).");

      const safeName = sanitizeFileName(vars.file.name);
      const path = `catalogs/${accountId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, vars.file, { contentType: vars.file.type, upsert: true });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("whatsapp-media")
        .createSignedUrl(path, SEVEN_YEARS_SECONDS);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL do arquivo");

      const existing = catalogsQ.data ?? [];
      const nextPos = (existing[existing.length - 1]?.position ?? 0) + 1;

      const { data, error } = await supabase
        .from("catalogs" as any)
        .insert({
          account_id: accountId,
          user_id: userId,
          name: vars.name.trim(),
          description: vars.description?.trim() || null,
          keywords: vars.keywords ?? [],
          caption: vars.caption?.trim() || null,
          file_url: signed.signedUrl,
          file_path: path,
          file_type: isImage ? "image" : "document",
          mime_type: vars.file.type,
          file_name: safeName,
          position: nextPos,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Catalog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      toast.success("Catálogo adicionado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar catálogo"),
  });

  const updateCatalog = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Catalog> }) => {
      const { error } = await supabase
        .from("catalogs" as any)
        .update(vars.patch as any)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      toast.success("Catálogo atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar catálogo"),
  });

  const deleteCatalog = useMutation({
    mutationFn: async (item: Catalog) => {
      if (item.file_path) {
        await supabase.storage.from("whatsapp-media").remove([item.file_path]);
      }
      const { error } = await supabase.from("catalogs" as any).delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      toast.success("Catálogo removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover catálogo"),
  });

  return { catalogsQ, createCatalog, updateCatalog, deleteCatalog };
}
