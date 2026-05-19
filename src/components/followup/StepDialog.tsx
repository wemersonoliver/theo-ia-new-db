import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type CustomStep, type StepType, type DelayUnit, uploadFollowupMedia, useFollowupMediaLibrary } from "@/hooks/useCustomFollowup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileText, Mic, Video, Image as ImageIcon, FileType, Library, Trash2, Plus } from "lucide-react";
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
  const [variants, setVariants] = useState<any[]>(Array.isArray(step.variants) ? step.variants : []);
  const [condInclude, setCondInclude] = useState<string>(
    Array.isArray(step.conditions?.tags_include) ? step.conditions.tags_include.join(", ") : ""
  );
  const [condExclude, setCondExclude] = useState<string>(
    Array.isArray(step.conditions?.tags_exclude) ? step.conditions.tags_exclude.join(", ") : ""
  );
  const [condOnFail, setCondOnFail] = useState<string>(step.conditions?.on_fail === "stop" ? "stop" : "skip");
  const [showLibrary, setShowLibrary] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { listQuery: libraryQuery } = useFollowupMediaLibrary();

  useEffect(() => {
    setType(step.type); setContent(step.content || ""); setCaption(step.caption || "");
    setMediaUrl(step.media_url || ""); setMediaMime(step.media_mime || "");
    setMediaName(step.media_filename || "");
    setDelayValue(step.delay_value); setDelayUnit(step.delay_unit);
    setVariants(Array.isArray(step.variants) ? step.variants : []);
    setCondInclude(Array.isArray(step.conditions?.tags_include) ? step.conditions.tags_include.join(", ") : "");
    setCondExclude(Array.isArray(step.conditions?.tags_exclude) ? step.conditions.tags_exclude.join(", ") : "");
    setCondOnFail(step.conditions?.on_fail === "stop" ? "stop" : "skip");
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

  const pickFromLibrary = (item: { url: string; mime: string | null; filename: string | null; name: string }) => {
    setMediaUrl(item.url);
    setMediaMime(item.mime || "");
    setMediaName(item.filename || item.name);
    setShowLibrary(false);
    toast.success("Mídia selecionada da biblioteca");
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
        variants: variants.length ? variants : [],
        conditions: {
          tags_include: condInclude.split(",").map((t) => t.trim()).filter(Boolean),
          tags_exclude: condExclude.split(",").map((t) => t.trim()).filter(Boolean),
          on_fail: condOnFail,
        },
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const addVariant = () => {
    setVariants([...variants, {
      id: crypto.randomUUID(),
      weight: 1,
      type, content, caption,
      media_url: mediaUrl, media_mime: mediaMime, media_filename: mediaName,
    }]);
  };
  const updateVariant = (idx: number, patch: any) => {
    setVariants(variants.map((v, i) => i === idx ? { ...v, ...patch } : v));
  };
  const removeVariant = (idx: number) => setVariants(variants.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar mensagem #{step.position + 1}</DialogTitle>
          <DialogDescription>
            Use <code className="text-xs">{`{{nome}}`}</code>, <code className="text-xs">{`{{primeiro_nome}}`}</code>, <code className="text-xs">{`{{empresa}}`}</code> ou Spintax: <code className="text-xs">{`{Oi|Olá}`}</code>.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="variants">Variantes A/B {variants.length > 0 && <span className="ml-1 text-xs">({variants.length})</span>}</TabsTrigger>
            <TabsTrigger value="conditions">Condições</TabsTrigger>
          </TabsList>
          <TabsContent value="content" className="space-y-4 pt-3">
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
                <div className="flex items-center justify-between">
                  <Label>Mídia</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowLibrary((s) => !s)}>
                    <Library className="h-4 w-4 mr-1" /> {showLibrary ? "Ocultar biblioteca" : "Escolher da biblioteca"}
                  </Button>
                </div>
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
                {showLibrary && (
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/30">
                    {(libraryQuery.data || []).filter((i) => i.type === type).length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Nenhuma mídia desse tipo na biblioteca.</p>
                    ) : (libraryQuery.data || []).filter((i) => i.type === type).map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => pickFromLibrary(i)}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{i.name}</span>
                        <span className="text-xs text-muted-foreground">{i.mime || ""}</span>
                      </button>
                    ))}
                  </div>
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
                  <SelectItem value="seconds">segundos</SelectItem>
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
          </TabsContent>

          <TabsContent value="variants" className="space-y-3 pt-3">
            <div className="text-xs text-muted-foreground">
              Quando há variantes cadastradas, o sistema sorteia uma delas a cada envio (peso ponderado). Se vazio, usa o conteúdo principal.
            </div>
            {variants.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem variantes. Adicione duas ou mais para começar um teste A/B.
              </p>
            )}
            {variants.map((v, idx) => (
              <div key={v.id || idx} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Peso</Label>
                    <Input
                      type="number" min={1} className="h-8 w-20"
                      value={v.weight ?? 1}
                      onChange={(e) => updateVariant(idx, { weight: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeVariant(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {(v.type || type) === "text" ? (
                  <Textarea rows={3} value={v.content || ""} onChange={(e) => updateVariant(idx, { content: e.target.value })} />
                ) : (
                  <>
                    <Input
                      placeholder="URL da mídia"
                      value={v.media_url || ""}
                      onChange={(e) => updateVariant(idx, { media_url: e.target.value })}
                    />
                    <Input
                      placeholder="Legenda (opcional)"
                      value={v.caption || ""}
                      onChange={(e) => updateVariant(idx, { caption: e.target.value })}
                    />
                  </>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar variante (a partir do conteúdo atual)
            </Button>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-3 pt-3">
            <div className="text-xs text-muted-foreground">
              Avaliado antes de enviar esta mensagem. Se as tags do contato não baterem, a etapa é pulada (ou o fluxo é encerrado).
            </div>
            <div>
              <Label className="text-xs">Enviar SOMENTE se contato tiver alguma destas tags</Label>
              <Input
                value={condInclude}
                onChange={(e) => setCondInclude(e.target.value)}
                placeholder="ex: interessado, qualificado"
              />
            </div>
            <div>
              <Label className="text-xs">NÃO enviar se contato tiver alguma destas tags</Label>
              <Input
                value={condExclude}
                onChange={(e) => setCondExclude(e.target.value)}
                placeholder="ex: opt-out, comprou"
              />
            </div>
            <div>
              <Label className="text-xs">Quando a condição falhar</Label>
              <Select value={condOnFail} onValueChange={setCondOnFail}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Pular esta etapa e seguir para a próxima</SelectItem>
                  <SelectItem value="stop">Encerrar o fluxo para esse contato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

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