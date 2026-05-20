import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sun, Moon, Upload, Library } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useRef } from "react";
import { toast } from "sonner";
import { useAccountId } from "@/hooks/useAccount";
import { uploadFollowupMedia, useFollowupMediaLibrary } from "@/hooks/useCustomFollowup";
import {
  useIgreenDayContent,
  type ItemType,
  type DelayUnit,
  type IgreenItem,
  type Period,
} from "@/hooks/useIgreenScenarios";

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "audio", label: "Áudio" },
  { value: "video", label: "Vídeo" },
  { value: "image", label: "Imagem" },
  { value: "document", label: "Documento" },
];

export function DayContentEditor({ dayId }: { dayId: string }) {
  const { contentQ, addItem, updateItem, removeItem } = useIgreenDayContent(dayId);

  if (contentQ.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  const { messages = [], items = [] } = contentQ.data ?? {};

  return (
    <div className="space-y-4">
      {(["morning", "evening"] as Period[]).map((period) => {
        const msg = messages.find((m) => m.period === period);
        if (!msg) return null;
        const msgItems = items
          .filter((i) => i.message_id === msg.id)
          .sort((a, b) => a.position - b.position);

        return (
          <div key={msg.id} className="rounded border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {period === "morning" ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-400" />
                )}
                <span className="text-sm font-medium">
                  {period === "morning" ? "Manhã (08:00 – 12:00)" : "Tarde (12:00 – 19:55)"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {msgItems.length} {msgItems.length === 1 ? "item" : "itens"}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  addItem.mutate({
                    message_id: msg.id,
                    type: "text",
                    content: "",
                    delay_value: 0,
                    delay_unit: "seconds",
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Item
              </Button>
            </div>

            <div className="space-y-2">
              {msgItems.map((it, idx) => (
                <ItemEditor
                  key={it.id}
                  item={it}
                  index={idx}
                  onChange={(patch) => updateItem.mutate({ id: it.id, patch })}
                  onRemove={() => removeItem.mutate(it.id)}
                />
              ))}
              {msgItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum item.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: IgreenItem;
  index: number;
  onChange: (patch: Partial<IgreenItem>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState(item);

  const commit = (patch: Partial<IgreenItem>) => {
    setLocal({ ...local, ...patch });
    onChange(patch);
  };

  return (
    <div className="rounded border bg-card p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
        <Select value={local.type} onValueChange={(v) => commit({ type: v as ItemType })}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {index > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Após</span>
            <Input
              type="number"
              min={0}
              value={local.delay_value}
              onChange={(e) => setLocal({ ...local, delay_value: Number(e.target.value) })}
              onBlur={() => onChange({ delay_value: local.delay_value })}
              className="h-8 w-16 text-xs"
            />
            <Select
              value={local.delay_unit}
              onValueChange={(v) => commit({ delay_unit: v as DelayUnit })}
            >
              <SelectTrigger className="w-[90px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">segundos</SelectItem>
                <SelectItem value="minutes">minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button size="icon" variant="ghost" className="ml-auto text-destructive h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {local.type === "text" ? (
        <Textarea
          rows={2}
          value={local.content ?? ""}
          onChange={(e) => setLocal({ ...local, content: e.target.value })}
          onBlur={() => onChange({ content: local.content })}
          placeholder="Mensagem de texto..."
          className="text-sm"
        />
      ) : (
        <MediaPicker
          item={local}
          onLocalChange={(patch) => setLocal({ ...local, ...patch })}
          onCommit={(patch) => onChange(patch)}
        />
      )}
    </div>
  );
}

function MediaPicker({
  item,
  onLocalChange,
  onCommit,
}: {
  item: IgreenItem;
  onLocalChange: (patch: Partial<IgreenItem>) => void;
  onCommit: (patch: Partial<IgreenItem>) => void;
}) {
  const { accountId } = useAccountId();
  const { listQuery } = useFollowupMediaLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const accept =
    item.type === "audio" ? "audio/*" :
    item.type === "video" ? "video/*" :
    item.type === "image" ? "image/*" : undefined;

  const handleUpload = async (file: File) => {
    if (!accountId) {
      toast.error("Conta não identificada");
      return;
    }
    setUploading(true);
    try {
      const r = await uploadFollowupMedia(accountId, "igreen", file);
      const patch = { media_url: r.url, media_mime: r.mime, media_filename: r.name };
      onLocalChange(patch);
      onCommit(patch);
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error("Falha no upload: " + (e?.message ?? "erro"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const pickFromLibrary = (m: { url: string; mime: string | null; filename: string | null; name: string }) => {
    const patch = {
      media_url: m.url,
      media_mime: m.mime ?? null,
      media_filename: m.filename ?? m.name ?? null,
    };
    onLocalChange(patch);
    onCommit(patch);
    setOpen(false);
    toast.success("Mídia selecionada");
  };

  const libItems = (listQuery.data || []).filter((i) => i.type === item.type);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          className="text-xs h-8"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 whitespace-nowrap"
          onClick={() => setOpen(true)}
        >
          <Library className="h-3.5 w-3.5 mr-1" />
          Biblioteca
        </Button>
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {item.media_url && (
        <p className="text-xs text-muted-foreground truncate">
          ✓ {item.media_filename || item.media_url}
        </p>
      )}

      {item.type !== "audio" && (
        <Input
          value={item.caption ?? ""}
          onChange={(e) => onLocalChange({ caption: e.target.value })}
          onBlur={() => onCommit({ caption: item.caption })}
          placeholder="Legenda (opcional)"
          className="text-sm"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Biblioteca de Mídia</DialogTitle>
            <DialogDescription>
              Selecione um {item.type === "video" ? "vídeo" : item.type === "image" ? "imagem" : item.type === "audio" ? "áudio" : "documento"} da sua biblioteca.
            </DialogDescription>
          </DialogHeader>
          {listQuery.isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : libItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mídia desse tipo na biblioteca. Faça upload em Followup → Biblioteca de Mídia.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
              {libItems.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickFromLibrary(m)}
                  className="border rounded-md p-2 text-left hover:bg-muted transition"
                >
                  <div className="aspect-video bg-muted rounded mb-2 flex items-center justify-center overflow-hidden">
                    {m.type === "image" ? (
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    ) : m.type === "video" ? (
                      <video src={m.url} className="w-full h-full" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs font-medium truncate">{m.name}</p>
                  {m.tags && m.tags.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">{m.tags.join(", ")}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}