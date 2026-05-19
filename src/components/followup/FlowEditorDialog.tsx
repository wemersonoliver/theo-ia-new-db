import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomFollowup, type CustomFlow, exportFlowJson, importFlowJson } from "@/hooks/useCustomFollowup";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StepsEditor } from "./StepsEditor";
import { EnrollmentsList } from "./EnrollmentsList";
import { Loader2, Download, Upload } from "lucide-react";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flow: CustomFlow;
}

export function FlowEditorDialog({ open, onOpenChange, flow }: Props) {
  const { updateFlow } = useCustomFollowup();
  const { user } = useAuth();
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description || "");
  const [triggerType, setTriggerType] = useState(flow.trigger_type);
  const [inactValue, setInactValue] = useState(flow.trigger_config?.value ?? 24);
  const [inactUnit, setInactUnit] = useState(flow.trigger_config?.unit ?? "hours");
  const [pipelineId, setPipelineId] = useState<string | null>(flow.trigger_config?.pipeline_id ?? null);
  const [stageId, setStageId] = useState<string | null>(flow.trigger_config?.stage_id ?? null);
  const [outcome, setOutcome] = useState<string>(flow.trigger_config?.outcome ?? "any");
  const [throttle, setThrottle] = useState(flow.throttle_seconds);
  const [maxPerHour, setMaxPerHour] = useState(flow.max_per_hour);
  const [stopOnReply, setStopOnReply] = useState(flow.stop_on_reply);
  const [excludeHandoff, setExcludeHandoff] = useState(flow.exclude_handoff);
  const [winStart, setWinStart] = useState(flow.window_config?.morning_start || "08:00");
  const [winEnd, setWinEnd] = useState(flow.window_config?.evening_end || "19:00");
  const [skipSundays, setSkipSundays] = useState(flow.window_config?.skip_sundays !== false);
  const [skipHolidays, setSkipHolidays] = useState(flow.window_config?.skip_holidays !== false);
  const [tagsInclude, setTagsInclude] = useState<string>(
    Array.isArray(flow.filters?.tags_include) ? flow.filters.tags_include.join(", ") : ""
  );
  const [tagsExclude, setTagsExclude] = useState<string>(
    Array.isArray(flow.filters?.tags_exclude) ? flow.filters.tags_exclude.join(", ") : ""
  );

  const handleExport = async () => {
    try {
      const json = await exportFlowJson(flow.id);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${flow.name.replace(/[^\w]+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Fluxo exportado");
    } catch (e) {
      toast.error("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  };

  const handleImport = async (file: File) => {
    if (!user) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importFlowJson(flow.account_id, user.id, json);
      qc.invalidateQueries({ queryKey: ["custom-followup-flows", flow.account_id] });
      toast.success("Fluxo importado");
    } catch (e) {
      toast.error("Falha: " + (e instanceof Error ? e.message : "JSON inválido"));
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: ps }, { data: ss }] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("account_id", flow.account_id).order("created_at"),
        supabase.from("crm_stages").select("id, name, pipeline_id").order("position"),
      ]);
      setPipelines((ps as any) || []);
      setStages((ss as any) || []);
    })();
  }, [open, flow.account_id]);

  useEffect(() => {
    setName(flow.name); setDescription(flow.description || "");
    setTriggerType(flow.trigger_type);
    setInactValue(flow.trigger_config?.value ?? 24);
    setInactUnit(flow.trigger_config?.unit ?? "hours");
    setPipelineId(flow.trigger_config?.pipeline_id ?? null);
    setStageId(flow.trigger_config?.stage_id ?? null);
    setOutcome(flow.trigger_config?.outcome ?? "any");
    setThrottle(flow.throttle_seconds); setMaxPerHour(flow.max_per_hour);
    setStopOnReply(flow.stop_on_reply); setExcludeHandoff(flow.exclude_handoff);
    setWinStart(flow.window_config?.morning_start || "08:00");
    setWinEnd(flow.window_config?.evening_end || "19:00");
    setSkipSundays(flow.window_config?.skip_sundays !== false);
    setSkipHolidays(flow.window_config?.skip_holidays !== false);
    setTagsInclude(Array.isArray(flow.filters?.tags_include) ? flow.filters.tags_include.join(", ") : "");
    setTagsExclude(Array.isArray(flow.filters?.tags_exclude) ? flow.filters.tags_exclude.join(", ") : "");
  }, [flow.id]);

  const handleSave = async () => {
    let triggerConfig: any = flow.trigger_config || {};
    if (triggerType === "inactivity") {
      triggerConfig = { value: Number(inactValue), unit: inactUnit };
    } else if (triggerType === "crm_stage_enter" || triggerType === "crm_stage_exit") {
      triggerConfig = { pipeline_id: pipelineId, stage_id: stageId };
    } else if (triggerType === "conversation_finalized") {
      triggerConfig = { outcome }; // 'any' | 'won' | 'lost' | 'abandoned'
    } else {
      triggerConfig = {};
    }
    await updateFlow.mutateAsync({
      id: flow.id,
      name, description,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      throttle_seconds: Math.max(3, Number(throttle) || 7),
      max_per_hour: Math.max(1, Number(maxPerHour) || 60),
      stop_on_reply: stopOnReply,
      exclude_handoff: excludeHandoff,
      window_config: {
        morning_start: winStart,
        evening_end: winEnd,
        skip_sundays: skipSundays,
        skip_holidays: skipHolidays,
      },
      filters: {
        tags_include: tagsInclude.split(",").map((t) => t.trim()).filter(Boolean),
        tags_exclude: tagsExclude.split(",").map((t) => t.trim()).filter(Boolean),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-full h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="pr-8 sm:pr-0">
              <DialogTitle>Editar fluxo personalizado</DialogTitle>
              <DialogDescription className="hidden sm:block">
                Configure gatilho, mensagens e janela de envio. Mensagens passam por uma fila com espaçamento mínimo entre envios.
              </DialogDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Exportar JSON</span><span className="sm:hidden ml-1">Exportar</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="flex-1 sm:flex-none">
                <Upload className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Importar JSON</span><span className="sm:hidden ml-1">Importar</span>
              </Button>
              <input
                ref={importRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
              />
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex-1 flex flex-col overflow-hidden">
          <div className="mx-4 sm:mx-6 mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="config">Configuração</TabsTrigger>
              <TabsTrigger value="steps">Mensagens</TabsTrigger>
              <TabsTrigger value="enrollments">Inscrições</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="config" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome do fluxo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <Label>Gatilho</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inactivity">Por inatividade do contato</SelectItem>
                    <SelectItem value="manual">Manual (disparo via botão)</SelectItem>
                    <SelectItem value="crm_stage_enter">Quando entra em etapa do CRM</SelectItem>
                    <SelectItem value="crm_stage_exit">Quando sai de etapa do CRM</SelectItem>
                    <SelectItem value="conversation_finalized">Após finalização de atendimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {triggerType === "inactivity" && (
                <div>
                  <Label>Tempo de inatividade</Label>
                  <div className="flex gap-2">
                    <Input type="number" min={1} value={inactValue} onChange={(e) => setInactValue(Number(e.target.value))} />
                    <Select value={inactUnit} onValueChange={(v) => setInactUnit(v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">minutos</SelectItem>
                        <SelectItem value="hours">horas</SelectItem>
                        <SelectItem value="days">dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {(triggerType === "crm_stage_enter" || triggerType === "crm_stage_exit") && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Funil</Label>
                    <Select value={pipelineId || ""} onValueChange={(v) => { setPipelineId(v); setStageId(null); }}>
                      <SelectTrigger><SelectValue placeholder="Escolha o funil" /></SelectTrigger>
                      <SelectContent>
                        {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Etapa</Label>
                    <Select value={stageId || ""} onValueChange={setStageId} disabled={!pipelineId}>
                      <SelectTrigger><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                      <SelectContent>
                        {stages.filter((s) => s.pipeline_id === pipelineId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {triggerType === "conversation_finalized" && (
                <div>
                  <Label>Resultado do atendimento</Label>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer resultado</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                      <SelectItem value="abandoned">Desistência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Espaçamento entre envios (segundos)</Label>
                <Input type="number" min={3} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">Recomendado: 7s. Mínimo: 3s.</p>
              </div>
              <div>
                <Label>Máx. mensagens por hora (instância)</Label>
                <Input type="number" min={1} value={maxPerHour} onChange={(e) => setMaxPerHour(Number(e.target.value))} />
              </div>

              <div>
                <Label>Janela — início</Label>
                <Input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
              </div>
              <div>
                <Label>Janela — fim</Label>
                <Input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Não enviar aos domingos</Label>
                  <p className="text-xs text-muted-foreground">Pula domingo automaticamente.</p>
                </div>
                <Switch checked={skipSundays} onCheckedChange={setSkipSundays} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Pausar em feriados</Label>
                  <p className="text-xs text-muted-foreground">Reagenda para o próximo dia útil.</p>
                </div>
                <Switch checked={skipHolidays} onCheckedChange={setSkipHolidays} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Parar ao receber resposta</Label>
                  <p className="text-xs text-muted-foreground">Encerra o fluxo se o cliente responder.</p>
                </div>
                <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
                <div>
                  <Label>Excluir contatos em atendimento humano</Label>
                  <p className="text-xs text-muted-foreground">Não envia se a IA estiver pausada (handoff).</p>
                </div>
                <Switch checked={excludeHandoff} onCheckedChange={setExcludeHandoff} />
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-3">
              <div>
                <Label className="text-base">Segmentação por tags do contato</Label>
                <p className="text-xs text-muted-foreground">
                  Aplica-se na inscrição. Separe por vírgula. Vazio = sem filtro.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Incluir contatos com QUALQUER destas tags</Label>
                  <Input
                    value={tagsInclude}
                    onChange={(e) => setTagsInclude(e.target.value)}
                    placeholder="ex: vip, lead-quente"
                  />
                </div>
                <div>
                  <Label className="text-xs">Excluir contatos com QUALQUER destas tags</Label>
                  <Input
                    value={tagsExclude}
                    onChange={(e) => setTagsExclude(e.target.value)}
                    placeholder="ex: cliente-ativo, opt-out"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={updateFlow.isPending}>
                {updateFlow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar configurações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="steps" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-2">
            <StepsEditor flowId={flow.id} accountId={flow.account_id} />
          </TabsContent>

          <TabsContent value="enrollments" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-2">
            <EnrollmentsList flowId={flow.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}