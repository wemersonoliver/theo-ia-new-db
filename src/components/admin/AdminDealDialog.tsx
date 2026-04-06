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
import { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import { AdminCRMStage } from "@/hooks/useAdminCRMStages";
import { CheckCircle2, XCircle, Mail, Phone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(deal?.title || "");
      setStageId(deal?.stage_id || defaultStageId || stages[0]?.id || "");
      setPriority(deal?.priority || "medium");
      setDescription(deal?.description || "");
      setCloseDate(deal?.expected_close_date || "");
    }
  }, [open, deal, defaultStageId, stages]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      stage_id: stageId,
      priority,
      description: description || null,
      expected_close_date: closeDate || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">{deal ? "Editar Deal" : "Novo Deal"}</DialogTitle>
        </DialogHeader>

        {/* User info (read-only for linked users) */}
        {deal && deal.user_ref_id && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Dados do Usuário</p>
            {deal.user_email && (
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {deal.user_email}
              </div>
            )}
            {deal.user_phone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {deal.user_phone}
              </div>
            )}
            <div className="flex gap-2 mt-1">
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
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => {
                const phone = deal.user_phone;
                onOpenChange(false);
                navigate("/admin/conversations" + (phone ? `?phone=${encodeURIComponent(phone)}` : ""));
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Iniciar Conversa via Suporte
            </Button>
          </div>
        )}

        <div className="grid gap-4 py-2">
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
          <div>
            <Label className="text-slate-300">Previsão de Fechamento</Label>
            <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
          </div>
          <div>
            <Label className="text-slate-300">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Observações..." rows={3} className="bg-slate-800 border-slate-700 text-slate-200" />
          </div>
        </div>
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
