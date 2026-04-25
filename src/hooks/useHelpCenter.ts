import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HelpCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  position: number;
}

export interface HelpArticle {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  position: number;
  published: boolean;
  updated_at: string;
}

export interface HelpArticleImage {
  id: string;
  article_id: string;
  storage_path: string;
  caption: string | null;
  position: number;
}

export function getHelpImageUrl(path: string) {
  const { data } = supabase.storage.from("help-center-images").getPublicUrl(path);
  return data.publicUrl;
}

export function useHelpCategories() {
  return useQuery({
    queryKey: ["help-categories"],
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

export function useHelpCategoryArticleCounts() {
  return useQuery({
    queryKey: ["help-article-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select("category_id")
        .eq("published", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as { category_id: string }[]).forEach((r) => {
        counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useHelpArticlesByCategory(categorySlug: string | undefined) {
  return useQuery({
    queryKey: ["help-articles", categorySlug],
    enabled: !!categorySlug,
    queryFn: async () => {
      const { data: cat, error: catErr } = await supabase
        .from("help_categories")
        .select("*")
        .eq("slug", categorySlug!)
        .maybeSingle();
      if (catErr) throw catErr;
      if (!cat) return { category: null, articles: [] as HelpArticle[] };

      const { data: articles, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("category_id", (cat as HelpCategory).id)
        .eq("published", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return { category: cat as HelpCategory, articles: (articles ?? []) as HelpArticle[] };
    },
  });
}

export function useHelpArticle(categorySlug: string | undefined, articleSlug: string | undefined) {
  return useQuery({
    queryKey: ["help-article", categorySlug, articleSlug],
    enabled: !!categorySlug && !!articleSlug,
    queryFn: async () => {
      const { data: cat, error: catErr } = await supabase
        .from("help_categories")
        .select("*")
        .eq("slug", categorySlug!)
        .maybeSingle();
      if (catErr) throw catErr;
      if (!cat) return null;

      const { data: article, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("category_id", (cat as HelpCategory).id)
        .eq("slug", articleSlug!)
        .maybeSingle();
      if (error) throw error;
      if (!article) return null;

      const { data: images, error: imgErr } = await supabase
        .from("help_article_images")
        .select("*")
        .eq("article_id", (article as HelpArticle).id)
        .order("position", { ascending: true });
      if (imgErr) throw imgErr;

      const { data: siblings } = await supabase
        .from("help_articles")
        .select("slug,title,position")
        .eq("category_id", (cat as HelpCategory).id)
        .eq("published", true)
        .order("position", { ascending: true });

      const list = (siblings ?? []) as { slug: string; title: string; position: number }[];
      const idx = list.findIndex((s) => s.slug === (article as HelpArticle).slug);
      const prev = idx > 0 ? list[idx - 1] : null;
      const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

      return {
        category: cat as HelpCategory,
        article: article as HelpArticle,
        images: (images ?? []) as HelpArticleImage[],
        prev,
        next,
      };
    },
  });
}

export function useHelpSearch(query: string) {
  return useQuery({
    queryKey: ["help-search", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const term = `%${query.trim()}%`;
      const { data, error } = await supabase
        .from("help_articles")
        .select("id,slug,title,summary,category_id")
        .eq("published", true)
        .or(`title.ilike.${term},summary.ilike.${term},content.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Pick<HelpArticle, "id" | "slug" | "title" | "summary" | "category_id">[];
    },
  });
}