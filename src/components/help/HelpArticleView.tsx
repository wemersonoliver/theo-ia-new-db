import { getHelpImageUrl, type HelpArticleImage } from "@/hooks/useHelpCenter";

interface HelpArticleViewProps {
  content: string;
  images: HelpArticleImage[];
}

/**
 * Renderiza o HTML do artigo substituindo marcadores [PRINT N] (ou [PRINT N: descrição])
 * pela imagem correspondente da lista (na ordem de position).
 */
export function HelpArticleView({ content, images }: HelpArticleViewProps) {
  const html = content.replace(/\[PRINT\s+(\d+)(?::[^\]]*)?\]/gi, (_, n) => {
    const idx = parseInt(n, 10) - 1;
    const img = images[idx];
    if (!img) {
      return `<span class="inline-block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">[Print ${n} — pendente]</span>`;
    }
    const url = getHelpImageUrl(img.storage_path);
    const cap = img.caption ? `<figcaption class="text-xs text-muted-foreground mt-1 text-center">${escapeHtml(img.caption)}</figcaption>` : "";
    return `<figure class="my-4"><img src="${url}" alt="${escapeHtml(img.caption ?? `Print ${n}`)}" class="w-full rounded-lg border shadow-sm" loading="lazy" />${cap}</figure>`;
  });

  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-img:rounded-lg"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}