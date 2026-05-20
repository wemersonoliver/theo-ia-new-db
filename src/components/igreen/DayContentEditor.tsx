import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sun, Moon } from "lucide-react";
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
        <div className="space-y-1">
          <Input
            value={local.media_url ?? ""}
            onChange={(e) => setLocal({ ...local, media_url: e.target.value })}
            onBlur={() => onChange({ media_url: local.media_url })}
            placeholder="URL do arquivo (ou faça upload na Biblioteca de Mídia)"
            className="text-sm"
          />
          {local.type !== "audio" && (
            <Input
              value={local.caption ?? ""}
              onChange={(e) => setLocal({ ...local, caption: e.target.value })}
              onBlur={() => onChange({ caption: local.caption })}
              placeholder="Legenda (opcional)"
              className="text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}