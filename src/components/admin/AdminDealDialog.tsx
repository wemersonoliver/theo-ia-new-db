import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import { AdminCRMStage } from "@/hooks/useAdminCRMStages";
import { useAdminCRMActivities } from "@/hooks/useAdminCRMActivities";
import { useAdminCRMDealTasks, AdminCRMDealTask } from "@/hooks/useAdminCRMDealTasks";
import { CheckCircle2, XCircle, Mail, Phone, MessageSquare, Building2, Sparkles, Plus, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: AdminCRMStage[];
  deal?: AdminCRMDeal | null;
  defaultStageId?: string;
  onSave: (data: any) => void;
  onDelete?: (id: string) => void;
}

export function AdminDealDialog({ open, onOpenChange, stages, deal, defaultStageId, onSave, onDelete }: AdminDealDialogProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("details");
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [valueCents, setValueCents] = useState<string>("");
  const [businessName, setBusinessName] = useState("");
  const [businessSegment, setBusinessSegment] = useState("");
  const [businessSummary, setBusinessSummary] = useState("");

  useEffect(() => {
    if (open) {
      setTab("details");
      setTitle(deal?.title || "");
      setStageId(deal?.stage_id || defaultStageId || stages[0]?.id || "");
      setPriority(deal?.priority || "medium");
      setDescription(deal?.description || "");
      setCloseDate(deal?.expected_close_date || "");
      setValueCents(deal?.value_cents != null ? String((deal.value_cents / 100).toFixed(2)) : "");
      setBusinessName((deal as any)?.business_name || "");
      setBusinessSegment((deal as any)?.business_segment || "");
      setBusinessSummary((deal as any)?.business_summary || "");
    }
  }, [open, deal, defaultStageId, stages]);

  const handleSave = () => {
    if (!title.trim()) return;
    const valueNum = valueCents ? Math.round(parseFloat(valueCents.replace(",", ".")) * 100) : null;
    onSave({
      title: title.trim(),
      stage_id: stageId,
      priority,
      description: description || null,
      expected_close_date: closeDate || null,
      value_cents: Number.isFinite(valueNum as number) ? valueNum : null,
      business_name: businessName.trim() || null,
      business_segment: businessSegment.trim() || null,
      business_summary: businessSummary.trim() || null,
    });
    onOpenChange(false);
  };

  const isEditing = !!deal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">{isEditing ? "Editar Deal" : "Novo Deal"}</DialogTitle>
        </DialogHeader>

        {/* User info */}
        {deal && deal.user_ref_id && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Dados do Usuário</p>
            {deal.user_email && (
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Mail className="h-3.5 w-3.5 text-slate-500" /> {deal.user_email}
              </div>
            )}
            {deal.user_phone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Phone className="h-3.5 w-3.5 text-slate-500" /> {deal.user_phone}
              </div>
            )}
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px]",
                deal.onboarding_completed
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/30"
              )}>
                {deal.onboarding_completed ? <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Onboarding Concluído</> : <><XCircle className="h-2.5 w-2.5 mr-0.5" />Onboarding Pendente</>}
              </Badge>
              {deal.subscription_status && (
                <Badge variant="outline" className="text-[10px] bg-slate-700/50 text-slate-300 border-slate-600">
                  {deal.subscription_status}{deal.subscription_plan ? ` · ${deal.subscription_plan}` : ""}
                </Badge>
              )}
            </div>
            {deal.user_phone && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/admin/conversations?phone=${encodeURIComponent(deal.user_phone!)}`);
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Iniciar Conversa via Suporte
              </Button>
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="details" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Detalhes</TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Negócio</TabsTrigger>
            <TabsTrigger value="activities" disabled={!isEditing} className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Atividades</TabsTrigger>
            <TabsTrigger value="tasks" disabled={!isEditing} className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Tarefas</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3 pt-3">
            <div>
              <Label className="text-slate-300">Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do negócio" className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Estágio</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valueCents}
                  onChange={e => setValueCents(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <Label className="text-slate-300">Previsão de Fechamento</Label>
                <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Observações..." rows={3} className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
          </TabsContent>

          <TabsContent value="business" className="space-y-3 pt-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-300">
                Estes campos são preenchidos automaticamente quando o cliente finaliza a entrevista IA. O follow-up de suporte usa estas informações para personalizar mensagens.
              </p>
            </div>
            <div>
              <Label className="text-slate-300 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Nome da Empresa</Label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ex: Clínica Bela Vida" className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <div>
              <Label className="text-slate-300">Segmento / Nicho</Label>
              <Input value={businessSegment} onChange={e => setBusinessSegment(e.target.value)} placeholder="Ex: Estética, Odontologia..." className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <div>
              <Label className="text-slate-300">Resumo do Negócio</Label>
              <Textarea
                value={businessSummary}
                onChange={e => setBusinessSummary(e.target.value)}
                rows={5}
                placeholder="Descrição curta sobre o que o cliente faz, dores, público-alvo..."
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            {(deal as any)?.business_data_updated_at && (
              <p className="text-[11px] text-slate-500">
                Atualizado {formatDistanceToNow(new Date((deal as any).business_data_updated_at), { addSuffix: true, locale: ptBR })}
              </p>
            )}
          </TabsContent>

          <TabsContent value="activities" className="pt-3">
            {deal && <ActivitiesPanel dealId={deal.id} />}
          </TabsContent>

          <TabsContent value="tasks" className="pt-3">
            {deal && <TasksPanel dealId={deal.id} />}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          {deal && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(deal.id); onOpenChange(false); }}>Excluir</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="bg-amber-500 text-slate-900 hover:bg-amber-400">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivitiesPanel({ dealId }: { dealId: string }) {
  const { activities, isLoading, addNote } = useAdminCRMActivities(dealId);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Adicionar nota..."
          className="bg-slate-800 border-slate-700 text-slate-200"
        />
        <Button
          onClick={() => { if (note.trim()) { addNote.mutate(note.trim()); setNote(""); } }}
          disabled={!note.trim() || addNote.isPending}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-slate-500">Carregando...</p>}
        {!isLoading && activities.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Nenhuma atividade registrada.</p>}
        {activities.map(a => (
          <div key={a.id} className="rounded border border-slate-700/50 bg-slate-800/40 p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-200">{a.content}</p>
              <Badge variant="outline" className="text-[9px] uppercase shrink-0 bg-slate-800 border-slate-600 text-slate-400">{a.type}</Badge>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel({ dealId }: { dealId: string }) {
  const { tasks, isLoading, createTask, toggleTask, deleteTask } = useAdminCRMDealTasks(dealId);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nova tarefa..." className="bg-slate-800 border-slate-700 text-slate-200" />
        <Input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200 w-[180px]" />
        <Button
          onClick={() => {
            if (!title.trim()) return;
            createTask.mutate({ title: title.trim(), due_date: due || null });
            setTitle(""); setDue("");
          }}
          disabled={!title.trim() || createTask.isPending}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-slate-500">Carregando...</p>}
        {!isLoading && tasks.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Nenhuma tarefa.</p>}
        {tasks.map((t: AdminCRMDealTask) => (
          <div key={t.id} className="flex items-start gap-2 rounded border border-slate-700/50 bg-slate-800/40 p-2">
            <Checkbox
              checked={t.completed}
              onCheckedChange={() => toggleTask.mutate(t)}
              className="mt-0.5 border-slate-600"
            />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm", t.completed ? "line-through text-slate-500" : "text-slate-200")}>{t.title}</p>
              {t.due_date && (
                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(t.due_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteTask.mutate(t.id)}
              className="text-slate-500 hover:text-red-400"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}