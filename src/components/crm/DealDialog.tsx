import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { CRMStage } from "@/hooks/useCRMStages";

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
  deal?: CRMDeal | null;
  defaultStageId?: string;
  contacts?: { id: string; name: string | null; phone: string }[];
  onSave: (data: {
    title: string;
    stage_id: string;
    value_cents?: number | null;
    priority?: string;
    contact_id?: string | null;
    description?: string | null;
    expected_close_date?: string | null;
  }) => void;
  onDelete?: (id: string) => void;
}

export function DealDialog({ open, onOpenChange, stages, deal, defaultStageId, contacts, onSave, onDelete }: DealDialogProps) {
  const [title, setTitle] = useState(deal?.title || "");
  const [stageId, setStageId] = useState(deal?.stage_id || defaultStageId || stages[0]?.id || "");
  const [valueBRL, setValueBRL] = useState(deal?.value_cents ? (deal.value_cents / 100).toFixed(2) : "");
  const [priority, setPriority] = useState(deal?.priority || "medium");
  const [contactId, setContactId] = useState(deal?.contact_id || "none");
  const [description, setDescription] = useState(deal?.description || "");
  const [closeDate, setCloseDate] = useState(deal?.expected_close_date || "");

  const handleSave = () => {
    if (!title.trim()) return;
    const valueCents = valueBRL ? Math.round(parseFloat(valueBRL.replace(",", ".")) * 100) : null;
    onSave({
      title: title.trim(),
      stage_id: stageId,
      value_cents: valueCents,
      priority,
      contact_id: contactId === "none" ? null : contactId,
      description: description || null,
      expected_close_date: closeDate || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{deal ? "Editar Negociação" : "Nova Negociação"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Projeto Website" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estágio</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Valor (R$)</Label>
              <Input value={valueBRL} onChange={(e) => setValueBRL(e.target.value)} placeholder="0,00" type="text" />
            </div>
            <div>
              <Label>Previsão de Fechamento</Label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>
          {contacts && contacts.length > 0 && (
            <div>
              <Label>Contato</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name || c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da negociação..." rows={3} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {deal && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(deal.id); onOpenChange(false); }}>
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
