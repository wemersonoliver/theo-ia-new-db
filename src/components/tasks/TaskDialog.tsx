import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/hooks/useAccount";

export interface TaskFormData {
  id?: string;
  deal_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
}

interface DealOption {
  id: string;
  title: string;
}
interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TaskFormData> | null;
  assignees: AssigneeOption[];
  onSubmit: (data: TaskFormData) => Promise<void> | void;
}

export function TaskDialog({ open, onOpenChange, initial, assignees, onSubmit }: Props) {
  const { user } = useAuth();
  const { membership } = useAccount();
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dealId, setDealId] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setDueDate(initial?.due_date ? initial.due_date.slice(0, 16) : "");
    setDealId(initial?.deal_id ?? "");
    setAssignedTo(initial?.assigned_to ?? "none");

    (async () => {
      let q = supabase.from("crm_deals").select("id, title").order("updated_at", { ascending: false }).limit(200);
      if (membership?.account_id) q = q.eq("account_id", membership.account_id);
      else q = q.eq("user_id", user.id);
      const { data } = await q;
      setDeals((data ?? []) as DealOption[]);
    })();
  }, [open, user, membership?.account_id, initial]);

  const handleSubmit = async () => {
    if (!title.trim() || !dealId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id,
        deal_id: dealId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to: assignedTo === "none" ? null : assignedTo,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para cliente" />
          </div>
          <div className="space-y-2">
            <Label>Negócio (CRM) *</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um negócio" />
              </SelectTrigger>
              <SelectContent>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
                {deals.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    Crie um negócio no CRM antes
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !dealId}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}