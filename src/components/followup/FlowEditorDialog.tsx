import { useEffect, useState } from "react";
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
import { useCustomFollowup, type CustomFlow } from "@/hooks/useCustomFollowup";
import { StepsEditor } from "./StepsEditor";
import { EnrollmentsList } from "./EnrollmentsList";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flow: CustomFlow;
}

export function FlowEditorDialog({ open, onOpenChange, flow }: Props) {
  const { updateFlow } = useCustomFollowup();
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description || "");
  const [triggerType, setTriggerType] = useState(flow.trigger_type);
  const [inactValue, setInactValue] = useState(flow.trigger_config?.value ?? 24);
  const [inactUnit, setInactUnit] = useState(flow.trigger_config?.unit ?? "hours");
  const [throttle, setThrottle] = useState(flow.throttle_seconds);
  const [maxPerHour, setMaxPerHour] = useState(flow.max_per_hour);
  const [stopOnReply, setStopOnReply] = useState(flow.stop_on_reply);
  const [excludeHandoff, setExcludeHandoff] = useState(flow.exclude_handoff);
  const [winStart, setWinStart] = useState(flow.window_config?.morning_start || "08:00");
  const [winEnd, setWinEnd] = useState(flow.window_config?.evening_end || "19:00");
  const [skipSundays, setSkipSundays] = useState(flow.window_config?.skip_sundays !== false);

  useEffect(() => {
    setName(flow.name); setDescription(flow.description || "");
    setTriggerType(flow.trigger_type);
    setInactValue(flow.trigger_config?.value ?? 24);
    setInactUnit(flow.trigger_config?.unit ?? "hours");
    setThrottle(flow.throttle_seconds); setMaxPerHour(flow.max_per_hour);
    setStopOnReply(flow.stop_on_reply); setExcludeHandoff(flow.exclude_handoff);
    setWinStart(flow.window_config?.morning_start || "08:00");
    setWinEnd(flow.window_config?.evening_end || "19:00");
    setSkipSundays(flow.window_config?.skip_sundays !== false);
  }, [flow.id]);

  const handleSave = async () => {
    await updateFlow.mutateAsync({
      id: flow.id,
      name, description,
      trigger_type: triggerType,
      trigger_config: triggerType === "inactivity"
        ? { value: Number(inactValue), unit: inactUnit }
        : flow.trigger_config,
      throttle_seconds: Math.max(3, Number(throttle) || 7),
      max_per_hour: Math.max(1, Number(maxPerHour) || 60),
      stop_on_reply: stopOnReply,
      exclude_handoff: excludeHandoff,
      window_config: {
        morning_start: winStart,
        evening_end: winEnd,
        skip_sundays: skipSundays,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle>Editar fluxo personalizado</DialogTitle>
          <DialogDescription>
            Configure gatilho, mensagens e janela de envio. Mensagens passam por uma fila com espaçamento mínimo entre envios.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 self-start">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="steps">Mensagens</TabsTrigger>
            <TabsTrigger value="enrollments">Inscrições</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="flex-1 overflow-y-auto p-6 space-y-6 mt-2">
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

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={updateFlow.isPending}>
                {updateFlow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar configurações
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="steps" className="flex-1 overflow-y-auto p-6 mt-2">
            <StepsEditor flowId={flow.id} accountId={flow.account_id} />
          </TabsContent>

          <TabsContent value="enrollments" className="flex-1 overflow-y-auto p-6 mt-2">
            <EnrollmentsList flowId={flow.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}