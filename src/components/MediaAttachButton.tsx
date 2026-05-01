import { useRef, useState } from "react";
import { Paperclip, Image as ImageIcon, FileText, Mic, Loader2, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB

const ACCEPT_BY_KIND: Record<Kind, string> = {
  media: "image/*,video/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip",
  audio: "audio/*",
};

type Kind = "media" | "document" | "audio";

function detectMediaType(file: File): "image" | "video" | "audio" | "document" {
  const m = (file.type || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}

export interface SendMediaArgs {
  phone: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "document";
  filename: string;
  caption?: string;
  mimetype?: string;
}

interface Props {
  phone: string;
  /** Whether to upload+send via the system instance (admin/support). */
  system?: boolean;
  disabled?: boolean;
  /**
   * Mutation that uploads the file to storage and invokes the edge function.
   * Provided by parent so we can reuse with both user and system hooks.
   */
  onSend: (args: { file: File; caption: string; phone: string }) => Promise<void>;
  isSending?: boolean;
}

export function MediaAttachButton({ phone, disabled, onSend, isSending }: Props) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  function pick(kind: Kind) {
    // Trigger the native file picker SYNCHRONOUSLY so iOS/Safari preserves
    // the user gesture context. Using a separate input per kind avoids the
    // need to mutate `accept` in a deferred frame.
    const ref =
      kind === "media" ? mediaInputRef
      : kind === "document" ? documentInputRef
      : audioInputRef;
    ref.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-pick same file
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. Máximo permitido: 16 MB.");
      return;
    }
    setFile(f);
    setCaption("");
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  function closeDialog() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
  }

  async function handleSend() {
    if (!file) return;
    try {
      await onSend({ file, caption: caption.trim(), phone });
      closeDialog();
    } catch (err) {
      // toast handled by mutation
    }
  }

  const mediaType = file ? detectMediaType(file) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isSending}
            className="shrink-0"
            aria-label="Anexar arquivo"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem onSelect={() => pick("media")} className="gap-2">
            <ImageIcon className="h-4 w-4" /> Foto ou vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pick("document")} className="gap-2">
            <FileText className="h-4 w-4" /> Documento
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pick("audio")} className="gap-2">
            <Mic className="h-4 w-4" /> Áudio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={mediaInputRef}
        type="file"
        accept={ACCEPT_BY_KIND.media}
        className="hidden"
        onChange={handleFileChosen}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept={ACCEPT_BY_KIND.document}
        className="hidden"
        onChange={handleFileChosen}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept={ACCEPT_BY_KIND.audio}
        className="hidden"
        onChange={handleFileChosen}
      />

      <Dialog open={!!file} onOpenChange={(o) => !o && !isSending && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar {mediaType === "image" ? "imagem" : mediaType === "video" ? "vídeo" : mediaType === "audio" ? "áudio" : "documento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className={cn("flex items-center justify-center rounded-md border bg-muted/30 p-2 max-h-[320px] overflow-hidden")}> 
              {mediaType === "image" && previewUrl && (
                <img src={previewUrl} alt="Pré-visualização" className="max-h-[300px] max-w-full rounded object-contain" />
              )}
              {mediaType === "video" && previewUrl && (
                <video src={previewUrl} controls className="max-h-[300px] max-w-full rounded" />
              )}
              {mediaType === "audio" && previewUrl && (
                <audio src={previewUrl} controls className="w-full" />
              )}
              {mediaType === "document" && (
                <div className="flex items-center gap-3 py-6 px-3 w-full">
                  <FileText className="h-10 w-10 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file ? (file.size / 1024).toFixed(0) : 0} KB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {mediaType !== "audio" && (
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Adicionar legenda (opcional)..."
                rows={2}
                disabled={isSending}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isSending}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}