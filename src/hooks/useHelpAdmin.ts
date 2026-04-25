import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { HelpArticle, HelpArticleImage, HelpCategory } from "./useHelpCenter";

export function useAdminHelpCategories() {
  return useQuery({
    queryKey: ["admin-help-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_categories")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as HelpCategory[];
    },
  });
}

export function useAdminHelpArticles(categoryId: string | null) {
  return useQuery({
    queryKey: ["admin-help-articles", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("category_id", categoryId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as HelpArticle[];
    },
  });
}

export function useAdminHelpArticle(articleId: string | null) {
  return useQuery({
    queryKey: ["admin-help-article", articleId],
    enabled: !!articleId,
    queryFn: async () => {
      const { data: article, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("id", articleId!)
        .maybeSingle();
      if (error) throw error;
      const { data: images } = await supabase
        .from("help_article_images")
        .select("*")
        .eq("article_id", articleId!)
        .order("position", { ascending: true });
      return { article: article as HelpArticle | null, images: (images ?? []) as HelpArticleImage[] };
    },
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function useUpsertHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HelpCategory> & { name: string }) => {
      const payload = {
        ...input,
        slug: input.slug || slugify(input.name),
      };
      const { error } = input.id
        ? await supabase.from("help_categories").update(payload).eq("id", input.id)
        : await supabase.from("help_categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-categories"] });
      qc.invalidateQueries({ queryKey: ["help-categories"] });
      toast({ title: "Categoria salva" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("help_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-categories"] });
      qc.invalidateQueries({ queryKey: ["help-categories"] });
      toast({ title: "Categoria removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useUpsertHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<HelpArticle> & { title: string; category_id: string }
    ) => {
      const payload = {
        ...input,
        slug: input.slug || slugify(input.title),
      };
      const { data, error } = input.id
        ? await supabase
            .from("help_articles")
            .update(payload)
            .eq("id", input.id)
            .select()
            .maybeSingle()
        : await supabase.from("help_articles").insert(payload).select().maybeSingle();
      if (error) throw error;
      return data as HelpArticle | null;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-help-articles", vars.category_id] });
      qc.invalidateQueries({ queryKey: ["admin-help-article"] });
      qc.invalidateQueries({ queryKey: ["help-articles"] });
      qc.invalidateQueries({ queryKey: ["help-article-counts"] });
      toast({ title: "Artigo salvo" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("help_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-articles"] });
      qc.invalidateQueries({ queryKey: ["help-articles"] });
      qc.invalidateQueries({ queryKey: ["help-article-counts"] });
      toast({ title: "Artigo removido" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useUploadArticleImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      file,
      caption,
      position,
    }: {
      articleId: string;
      file: File;
      caption?: string;
      position?: number;
    }) => {
      const ext = file.name.split(".").pop() || "png";
      const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${articleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("help-center-images")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("help_article_images").insert({
        article_id: articleId,
        storage_path: path,
        caption: caption ?? null,
        position: position ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-article"] });
      qc.invalidateQueries({ queryKey: ["help-article"] });
      toast({ title: "Imagem adicionada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao subir imagem", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateArticleImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; caption?: string; position?: number }) => {
      const { error } = await supabase
        .from("help_article_images")
        .update({ caption: input.caption, position: input.position })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-article"] });
      qc.invalidateQueries({ queryKey: ["help-article"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteArticleImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("help-center-images").remove([path]);
      const { error } = await supabase.from("help_article_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-article"] });
      qc.invalidateQueries({ queryKey: ["help-article"] });
      toast({ title: "Imagem removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}