import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, FileText, Info, Mic, ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useConversations";

interface Props {
  msg: Message;
  /** When true, applies darker styling for admin theme */
  variant?: "default" | "admin";
}

/**
 * Renders the media portion of a message bubble (image/audio/video/document).
 * Falls back to a small notice when only OCR/transcription text is available.
 */
export function MediaBubble({ msg, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const labelColor = variant === "admin" ? "text-slate-500" : "text-muted-foreground";

  if (!msg.media_url) {
    // Show only the type chip; old messages without media will rely on textual content.
    if (msg.type === "audio") {
      return (
        <div className={cn("text-xs flex items-center gap-1 mb-1", labelColor)}>
          <Mic className="h-3 w-3" /> Áudio (mídia não armazenada)
        </div>
      );
    }
    if (msg.type === "image") {
      return (
        <div className={cn("text-xs flex items-center gap-1 mb-1", labelColor)}>
          <ImageIcon className="h-3 w-3" /> Imagem (mídia não armazenada)
        </div>
      );
    }
    if (msg.type === "video") {
      return (
        <div className={cn("text-xs flex items-center gap-1 mb-1", labelColor)}>
          <Video className="h-3 w-3" /> Vídeo (mídia não armazenada)
        </div>
      );
    }
    if (msg.type === "document") {
      return (
        <div className={cn("text-xs flex items-center gap-1 mb-1", labelColor)}>
          <FileText className="h-3 w-3" /> Documento (mídia não armazenada)
        </div>
      );
    }
    return null;
  }

  const url = msg.media_url;
  const mime = msg.media_mime || "";

  if (msg.type === "image" || mime.startsWith("image/")) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block max-w-[280px] mb-2 rounded-lg overflow-hidden border border-border/30 hover:opacity-90 transition-opacity"
        >
          <img
            src={url}
            alt={msg.media_filename || "Imagem"}
            loading="lazy"
            className="w-full h-auto object-cover max-h-[320px]"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl p-2 bg-background">
            <img src={url} alt={msg.media_filename || "Imagem"} className="w-full h-auto rounded" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (msg.type === "audio" || mime.startsWith("audio/")) {
    return (
      <div className="mb-2">
        <audio controls preload="metadata" src={url} className="w-full max-w-[280px] h-10" />
      </div>
    );
  }

  if (msg.type === "video" || mime.startsWith("video/")) {
    return (
      <div className="mb-2">
        <video
          controls
          preload="metadata"
          src={url}
          className="w-full max-w-[320px] max-h-[360px] rounded-lg bg-black"
        />
      </div>
    );
  }

  // document or anything else
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={msg.media_filename || undefined}
      className={cn(
        "mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-black/5 transition-colors",
        variant === "admin" ? "border-slate-700 hover:bg-slate-800/50" : "border-border/40"
      )}
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="flex-1 truncate">{msg.media_filename || "Documento"}</span>
      <Download className="h-4 w-4 shrink-0 opacity-60" />
    </a>
  );
}
