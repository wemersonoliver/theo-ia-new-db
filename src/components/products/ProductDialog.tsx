import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Product } from "@/hooks/useProducts";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: { name: string; description?: string; quantity?: number; price_cents?: number; sku?: string; active?: boolean }) => void;
  onDelete?: (id: string) => void;
}

export function ProductDialog({ open, onOpenChange, product, onSave, onDelete }: ProductDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [priceBRL, setPriceBRL] = useState("");
  const [sku, setSku] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(product?.name || "");
      setDescription(product?.description || "");
      setQuantity(String(product?.quantity ?? 0));
      setPriceBRL(product?.price_cents ? (product.price_cents / 100).toFixed(2) : "");
      setSku(product?.sku || "");
      setActive(product?.active ?? true);
    }
  }, [open, product]);

  const handleSave = () => {
    if (!name.trim()) return;
    const priceCents = priceBRL ? Math.round(parseFloat(priceBRL.replace(",", ".")) * 100) : 0;
    onSave({
      name: name.trim(),
      description: description || undefined,
      quantity: parseInt(quantity) || 0,
      price_cents: priceCents,
      sku: sku || undefined,
      ...(product ? { active } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Plano Premium" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes do produto..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input value={priceBRL} onChange={e => setPriceBRL(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Quantidade em estoque</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="0" />
            </div>
          </div>
          <div>
            <Label>SKU (opcional)</Label>
            <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: PROD-001" />
          </div>
          {product && (
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Produto ativo</Label>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {product && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(product.id); onOpenChange(false); }}>Excluir</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
