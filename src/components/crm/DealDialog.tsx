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
import { CRMDeal } from "@/hooks/useCRMDeals";
import { CRMStage } from "@/hooks/useCRMStages";
import { Product } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { TagInput } from "@/components/TagInput";

interface DealProduct {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
}

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
  deal?: CRMDeal | null;
  defaultStageId?: string;
  defaultContactId?: string;
  defaultTitle?: string;
  contacts?: { id: string; name: string | null; phone: string }[];
  products?: Product[];
  initialDealProducts?: DealProduct[];
  availableTags?: string[];
  onSave: (data: {
    title: string;
    stage_id: string;
    value_cents?: number | null;
    priority?: string;
    contact_id?: string | null;
    description?: string | null;
    expected_close_date?: string | null;
    assigned_to?: string | null;
    tags?: string[];
  }, dealProducts?: DealProduct[]) => void;
  onDelete?: (id: string) => void;
}

export function DealDialog({ open, onOpenChange, stages, deal, defaultStageId, defaultContactId, defaultTitle, contacts, products, initialDealProducts, availableTags, onSave, onDelete }: DealDialogProps) {
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [valueBRL, setValueBRL] = useState("");
  const [priority, setPriority] = useState("medium");
  const [contactId, setContactId] = useState("none");
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [dealProducts, setDealProducts] = useState<DealProduct[]>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(deal?.title || defaultTitle || "");
      setStageId(deal?.stage_id || defaultStageId || stages[0]?.id || "");
      setValueBRL(deal?.value_cents ? (deal.value_cents / 100).toFixed(2) : "");
      setPriority(deal?.priority || "medium");
      setContactId(deal?.contact_id || defaultContactId || "none");
      setDescription(deal?.description || "");
      setCloseDate(deal?.expected_close_date || "");
      setDealProducts(initialDealProducts || []);
      setAssignedTo((deal as any)?.assigned_to ?? null);
      setTags(deal?.tags || []);
    }
  }, [open, deal, defaultStageId, defaultContactId, defaultTitle, stages, initialDealProducts]);

  const productsTotal = dealProducts.reduce((sum, dp) => sum + dp.quantity * dp.unit_price_cents, 0);

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
      assigned_to: assignedTo,
      tags,
    }, dealProducts.length > 0 ? dealProducts : undefined);
    onOpenChange(false);
  };

  const addProduct = () => {
    if (!products?.length) return;
    const first = products[0];
    setDealProducts(prev => [...prev, { product_id: first.id, quantity: 1, unit_price_cents: first.price_cents }]);
  };

  const removeProduct = (idx: number) => setDealProducts(prev => prev.filter((_, i) => i !== idx));

  const updateDealProduct = (idx: number, field: keyof DealProduct, value: any) => {
    setDealProducts(prev => prev.map((dp, i) => {
      if (i !== idx) return dp;
      if (field === "product_id") {
        const prod = products?.find(p => p.id === value);
        return { ...dp, product_id: value, unit_price_cents: prod?.price_cents || dp.unit_price_cents };
      }
      return { ...dp, [field]: value };
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
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

          <AssigneeSelector value={assignedTo} onChange={setAssignedTo} />

          {/* Products section */}
          {products && products.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produtos vinculados</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addProduct}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {dealProducts.map((dp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={dp.product_id} onValueChange={v => updateDealProduct(idx, "product_id", v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={dp.quantity}
                    onChange={e => updateDealProduct(idx, "quantity", parseInt(e.target.value) || 1)}
                    className="w-16"
                    placeholder="Qtd"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">
                    R$ {((dp.quantity * dp.unit_price_cents) / 100).toFixed(2)}
                  </span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {dealProducts.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Total produtos: <strong>R$ {(productsTotal / 100).toFixed(2)}</strong>
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da negociação..." rows={3} />
          </div>

          <div>
            <Label>Tags / Etiquetas</Label>
            <TagInput tags={tags} onChange={setTags} extraSuggestions={availableTags} />
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
