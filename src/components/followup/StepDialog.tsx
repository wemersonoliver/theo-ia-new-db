import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type CustomStep, type StepType, type DelayUnit, uploadFollowupMedia } from "@/hooks/useCustomFollowup";
import { Loader2, Upload, FileText, Mic, Video, Image as ImageIcon, FileType } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  step: CustomStep;
  accountId: string;
  onSave: (patch: Partial<CustomStep>) => Promise<unknown>;
}

const TYPES: { value: StepType; label: string; icon: JSX.Element }[] = [
  { value: "text", label: "Texto", icon: <FileText className="h-4 w-4" /> },
  { value: "audio", label: "Áudio (PTT)", icon: <Mic className="h-4 w-4" /> },
  { value: "image", label: "Imagem", icon: <ImageIcon className="h-4 w-4" /> },
  { value: "video", label: "Vídeo", icon: <Video className="h-4 w-4" /> },
  { value: "document", label: "Documento", icon: <FileType className="h-4 w-4" /> },
];

export function StepDialog({ open, onOpenChange, step, accountId, onSave }: Props) {
  const [type, setType] = useState<StepType>(step.type);
  const [content, setContent] = useState(step.content || "");
  const [caption, setCaption] = useState(step.caption || "");
  const [mediaUrl, setMediaUrl] = useState(step.media_url || "");
  const [mediaMime, setMediaMime] = useState(step.media_mime || "");
  const [mediaName, setMediaName] = useState(step.media_filename || "");
  const [delayValue, setDelayValue] = useState(step.delay_value);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>(step.delay_unit);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(step.type); setContent(step.content || ""); setCaption(step.caption || "");
    setMediaUrl(step.media_url || ""); setMediaMime(step.media_mime || "");
    setMediaName(step.media_filename || "");
    setDelayValue(step.delay_value); setDelayUnit(step.delay_unit);
  }, [step.id]);

  const requiresMedia = type !== "text";

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const r = await uploadFollowupMedia(accountId, step.flow_id, file);
      setMediaUrl(r.url); setMediaMime(r.mime); setMediaName(r.name);
      toast.success("Mídia enviada");
    } catch (e) {
      toast.error("Falha no upload: " + (e instanceof Error ? e.message : "erro"));
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (requiresMedia && !mediaUrl) { toast.error("Anexe a mídia"); return; }
    if (type === "text" && !content.trim()) { toast.error("Digite o texto"); return; }
    setSaving(true);
    try {
      await onSave({
        type, content: content || null, caption: caption || null,
        media_url: mediaUrl || null, media_mime: mediaMime || null, media_filename: mediaName || null,
        delay_value: Math.max(0, Number(delayValue) || 0),
        delay_unit: delayUnit,
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar mensagem #{step.position + 1}</DialogTitle>
          <DialogDescription>
            Use <code className="text-xs">{`{{nome}}`}</code>, <code className="text-xs">{`{{primeiro_nome}}`}</code>, <code className="text-xs">{`{{empresa}}`}</code> ou Spintax: <code className="text-xs">{`{Oi|Olá}`}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as StepType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "text" && (
            <div>
              <Label>Texto</Label>
              <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Olá {{primeiro_nome}}, tudo bem?" />
            </div>
          )}

          {requiresMedia && (
            <>
              <div>
                <Label>Mídia</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    ref={fileRef}
                    accept={
                      type === "audio" ? "audio/*" :
                      type === "video" ? "video/*" :
                      type === "image" ? "image/*" : undefined
                    }
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {mediaUrl && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {mediaName || "arquivo enviado"} ({mediaMime})
                  </p>
                )}
              </div>
              {type !== "audio" && (
                <div>
                  <Label>Legenda (opcional)</Label>
                  <Textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Atraso</Label>
              <Input type="number" min={0} value={delayValue} onChange={(e) => setDelayValue(Number(e.target.value))} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={delayUnit} onValueChange={(v) => setDelayUnit(v as DelayUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">minutos</SelectItem>
                  <SelectItem value="hours">horas</SelectItem>
                  <SelectItem value="days">dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {step.position === 0
              ? "Atraso aplicado a partir do momento em que o contato é inscrito no fluxo."
              : "Atraso aplicado a partir do envio da mensagem anterior."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}