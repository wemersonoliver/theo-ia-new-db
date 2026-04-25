import { useMemo } from "react";

interface HelpVideoEmbedProps {
  url: string;
}

/**
 * Detecta o provedor do vídeo (YouTube, Vimeo, Loom, MP4 direto) e renderiza
 * o player apropriado em proporção 16:9.
 */
export function HelpVideoEmbed({ url }: HelpVideoEmbedProps) {
  const embed = useMemo(() => resolveEmbed(url), [url]);

  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline break-all"
      >
        {url}
      </a>
    );
  }

  if (embed.type === "video") {
    return (
      <div className="w-full overflow-hidden rounded-lg border bg-black">
        <video src={embed.src} controls className="w-full aspect-video" />
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-black">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={embed.src}
          title="Vídeo do tutorial"
          className="absolute inset-0 h-full w-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

type Embed = { type: "iframe" | "video"; src: string };

function resolveEmbed(raw: string): Embed | null {
  const url = raw.trim();
  if (!url) return null;

  // MP4/WebM/OGG direto
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
    return { type: "video", src: url };
  }

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { type: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return { type: "iframe", src: `https://www.youtube.com/embed/${id}` };
      }
      if (u.pathname.startsWith("/embed/")) {
        return { type: "iframe", src: url };
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id) return { type: "iframe", src: `https://www.youtube.com/embed/${id}` };
      }
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
      }
    }
    if (host === "player.vimeo.com") {
      return { type: "iframe", src: url };
    }

    // Loom
    if (host === "loom.com" || host.endsWith(".loom.com")) {
      if (u.pathname.startsWith("/share/")) {
        const id = u.pathname.split("/")[2];
        if (id) return { type: "iframe", src: `https://www.loom.com/embed/${id}` };
      }
      if (u.pathname.startsWith("/embed/")) {
        return { type: "iframe", src: url };
      }
    }
  } catch {
    return null;
  }

  return null;
}