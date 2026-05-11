import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Plus, MessageSquare, Mic, Video as VideoIcon, Image as ImageIcon,
  Link2, Clock, Trash2, ArrowUp, ArrowDown, Send, Loader2, Upload,
} from "lucide-react";
import {
  AttendanceFlowStep, FlowStepType, useAttendanceFlow, uploadFlowMedia,
} from "@/hooks/useAttendanceFlows";
import { useAttendanceFlows } from "@/hooks/useAttendanceFlows";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stepMeta: Record<FlowStepType, { label: string; icon: any; color: string }> = {
  text: { label: "Texto", icon: MessageSquare, color: "text-emerald-400" },
  audio: { label: "Áudio", icon: Mic, color: "text-purple-400" },
  video: { label: "Vídeo", icon: VideoIcon, color: "text-rose-400" },
  image: { label: "Imagem", icon: ImageIcon, color: "text-cyan-400" },
  link: { label: "Link", icon: Link2, color: "text-blue-400" },
  delay: { label: "Espera", icon: Clock, color: "text-amber-400" },
};

export default function AdminFlowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { flow, steps, runs, createStep, updateStep, deleteStep, reorderSteps, testRun } = useAttendanceFlow(id);
  const { updateFlow } = useAttendanceFlows();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [triggerMode, setTriggerMode] = useState<"exact" | "contains">("exact");
  const [isActive, setIsActive] = useState(true);
  const [pauseAi, setPauseAi] = useState(true);
  const [onlyFirst, setOnlyFirst] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (flow.data) {
      setName(flow.data.name || "");
      setDescription(flow.data.description || "");
      setTrigger(flow.data.trigger_text || "");
      setTriggerMode(flow.data.trigger_match_mode || "exact");
      setIsActive(flow.data.is_active);
      setPauseAi(flow.data.pause_support_ai);
      setOnlyFirst(flow.data.only_first_contact);
    }
  }, [flow.data?.id]);

  const handleSaveHeader = () => {
    if (!id) return;
    updateFlow.mutate({
      id, name, description, trigger_text: trigger, trigger_match_mode: triggerMode,
      is_active: isActive, pause_support_ai: pauseAi, only_first_contact: onlyFirst,
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const list = (steps.data || []).map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    reorderSteps.mutate(list);
  };

  return (
    <AdminLayout title={flow.data?.name || "Fluxo"} description="Editor visual de passos">
      <div className="max-w-4xl space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/flows")} className="text-slate-400 hover:bg-slate-800 gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        {/* Header / config */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-slate-300">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div className="space-y-1"><Label className="text-slate-300">Modo de match</Label>
                <Select value={triggerMode} onValueChange={(v: any) => setTriggerMode(v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="exact">Exato (mensagem completa)</SelectItem>
                    <SelectItem value="contains">Contém o texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Mensagem-gatilho</Label>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
              <p className="text-xs text-slate-500">Comparação ignora maiúsculas/minúsculas e acentos.</p>
            </div>
            <div className="space-y-1"><Label className="text-slate-300">Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                <div><div className="text-sm text-slate-200">Ativo</div><div className="text-xs text-slate-500">Habilita o disparo</div></div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                <div><div className="text-sm text-slate-200">Pausar IA Suporte</div><div className="text-xs text-slate-500">Enquanto o fluxo roda</div></div>
                <Switch checked={pauseAi} onCheckedChange={setPauseAi} />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                <div><div className="text-sm text-slate-200">Só 1º contato</div><div className="text-xs text-slate-500">Conversas novas</div></div>
                <Switch checked={onlyFirst} onCheckedChange={setOnlyFirst} />
              </div>
            </div>
            <Button onClick={handleSaveHeader} disabled={updateFlow.isPending} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
              {updateFlow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configuração
            </Button>
          </CardContent>
        </Card>

        {/* Passos */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Passos do fluxo</span>
              <AddStepMenu onAdd={(type) => createStep.mutate({ type })} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : (steps.data?.length || 0) === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Nenhum passo. Adicione o primeiro acima.</p>
            ) : (
              steps.data!.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  total={steps.data!.length}
                  onMoveUp={() => move(idx, -1)}
                  onMoveDown={() => move(idx, 1)}
                  onDelete={() => { if (confirm("Excluir este passo?")) deleteStep.mutate(step.id); }}
                  onChange={(patch) => updateStep.mutate({ id: step.id, ...patch })}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Teste */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base">Testar fluxo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Telefone (ex: 47999999999)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
              <Button onClick={() => testRun.mutate(testPhone)} disabled={!testPhone || testRun.isPending} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
                {testRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Disparar agora
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs uppercase">Últimas execuções</Label>
              {(runs.data?.length || 0) === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma execução ainda.</p>
              ) : (
                <div className="space-y-1">
                  {runs.data!.map((r) => {
                    const color = r.status === "done" ? "bg-emerald-900/40 text-emerald-300"
                      : r.status === "running" ? "bg-amber-900/40 text-amber-300"
                      : r.status === "error" ? "bg-red-900/40 text-red-300"
                      : "bg-slate-700 text-slate-300";
                    return (
                      <div key={r.id} className="flex items-center justify-between p-2 bg-slate-800/40 rounded border border-slate-700 text-xs">
                        <div>
                          <span className="text-slate-200">{r.phone}</span>
                          <span className="text-slate-500 ml-2">passo {r.current_step + 1} · {new Date(r.started_at).toLocaleString("pt-BR")}</span>
                          {r.last_error && <div className="text-red-400 truncate max-w-md">{r.last_error}</div>}
                        </div>
                        <Badge className={color}>{r.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function AddStepMenu({ onAdd }: { onAdd: (type: FlowStepType) => void }) {
  const types: FlowStepType[] = ["text", "audio", "video", "image", "link", "delay"];
  return (
    <Select onValueChange={(v: any) => onAdd(v as FlowStepType)}>
      <SelectTrigger className="bg-amber-500 hover:bg-amber-600 text-black w-auto h-9 gap-1 border-0">
        <Plus className="h-4 w-4" /> <SelectValue placeholder="Adicionar passo" />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
        {types.map((t) => {
          const M = stepMeta[t];
          const Icon = M.icon;
          return (
            <SelectItem key={t} value={t}>
              <span className="flex items-center gap-2"><Icon className={`h-4 w-4 ${M.color}`} /> {M.label}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function StepCard({
  step, index, total, onMoveUp, onMoveDown, onDelete, onChange,
}: {
  step: AttendanceFlowStep; index: number; total: number;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  onChange: (patch: Partial<AttendanceFlowStep>) => void;
}) {
  const M = stepMeta[step.type];
  const Icon = M.icon;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadFlowMedia(file);
      onChange({ media_path: path, media_url: null });
    } catch (e: any) {
      alert(e?.message || "Erro no upload");
    } finally { setUploading(false); }
  };

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
          <Icon className={`h-4 w-4 ${M.color}`} />
          <span className="text-sm font-medium text-slate-200">{M.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onMoveUp} disabled={index === 0} className="h-7 w-7 text-slate-400"><ArrowUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={onMoveDown} disabled={index === total - 1} className="h-7 w-7 text-slate-400"><ArrowDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 text-red-400 hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Esperar antes (segundos)</Label>
            <Input type="number" min={0} value={step.delay_before_seconds}
              onChange={(e) => onChange({ delay_before_seconds: Math.max(0, Number(e.target.value)) })}
              className="bg-slate-800 border-slate-700 text-slate-200 h-8" />
          </div>
          {(step.type === "text" || step.type === "link") && (
            <div className="flex items-end gap-2">
              <div className="flex-1 flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700">
                <span className="text-xs text-slate-300">Mostrar "digitando…"</span>
                <Switch checked={step.typing_indicator} onCheckedChange={(v) => onChange({ typing_indicator: v })} />
              </div>
            </div>
          )}
          {step.type === "audio" && (
            <div className="flex items-end gap-2">
              <div className="flex-1 flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700">
                <span className="text-xs text-slate-300">Mostrar "gravando áudio…"</span>
                <Switch checked={step.recording_indicator} onCheckedChange={(v) => onChange({ recording_indicator: v })} />
              </div>
            </div>
          )}
        </div>

        {(step.type === "text" || step.type === "link") && (
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">{step.type === "link" ? "Mensagem com link" : "Mensagem"}</Label>
            <Textarea value={step.content || ""} onChange={(e) => onChange({ content: e.target.value })}
              rows={3} placeholder={step.type === "link" ? "Ex: Veja aqui: https://theoia.com.br" : "Mensagem de texto…"}
              className="bg-slate-800 border-slate-700 text-slate-200" />
          </div>
        )}

        {(step.type === "audio" || step.type === "video" || step.type === "image") && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" hidden
                accept={step.type === "audio" ? "audio/*" : step.type === "video" ? "video/*" : "image/*"}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" size="sm" className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Enviar arquivo
              </Button>
              {step.media_path && <Badge className="bg-emerald-900/40 text-emerald-300 truncate max-w-[260px]">📎 {step.media_path}</Badge>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">…ou URL externa (opcional)</Label>
              <Input value={step.media_url || ""} onChange={(e) => onChange({ media_url: e.target.value || null })}
                placeholder="https://…" className="bg-slate-800 border-slate-700 text-slate-200 h-8" />
            </div>
            {(step.type === "video" || step.type === "image") && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Legenda (opcional)</Label>
                <Input value={step.caption || ""} onChange={(e) => onChange({ caption: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200 h-8" />
              </div>
            )}
          </div>
        )}

        {step.type === "delay" && (
          <p className="text-xs text-slate-500">Este passo apenas aguarda o tempo configurado acima antes do próximo passo.</p>
        )}
      </div>
    </div>
  );
}