import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinalizeConversation, type ConversationOutcome } from "@/hooks/useFinalizeConversation";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string | null;
  contactName?: string | null;
  defaultValueCents?: number | null;
  onFinalized?: () => void;
}

const OPTIONS: { id: ConversationOutcome; label: string; desc: string; icon: typeof Trophy; color: string }[] = [
  { id: "won", label: "Ganho", desc: "Cliente fechou negócio", icon: Trophy, color: "emerald" },
  { id: "lost", label: "Perdido", desc: "Cliente não fechou", icon: XCircle, color: "rose" },
  { id: "abandoned", label: "Desistência", desc: "Cliente parou de responder", icon: MinusCircle, color: "slate" },
];

export function FinalizeDialog({ open, onOpenChange, conversationId, contactName, defaultValueCents, onFinalized }: Props) {
  const [outcome, setOutcome] = useState<ConversationOutcome | null>(null);
  const [reason, setReason] = useState("");
  const [valueStr, setValueStr] = useState(
    defaultValueCents ? (defaultValueCents / 100).toFixed(2).replace(".", ",") : ""
  );
  const { finalize } = useFinalizeConversation();

  function reset() {
    setOutcome(null);
    setReason("");
    setValueStr("");
  }

  async function submit() {
    if (!conversationId || !outcome) return;
    if (outcome === "lost" && !reason.trim()) return;

    const valueCents =
      outcome === "won" && valueStr
        ? Math.round(parseFloat(valueStr.replace(/\./g, "").replace(",", ".")) * 100)
        : null;

    await finalize.mutateAsync({
      conversationId,
      outcome,
      reason: reason.trim() || null,
      valueCents: Number.isFinite(valueCents) ? valueCents : null,
    });
    reset();
    onOpenChange(false);
    onFinalized?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Finalizar atendimento</DialogTitle>
          <DialogDescription>
            {contactName ? `Como foi o atendimento de ${contactName}?` : "Como foi este atendimento?"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = outcome === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOutcome(o.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all",
                  active
                    ? o.id === "won"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : o.id === "lost"
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-slate-500 bg-slate-500/10"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    o.id === "won" && "text-emerald-600",
                    o.id === "lost" && "text-rose-600",
                    o.id === "abandoned" && "text-slate-500"
                  )}
                />
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{o.desc}</span>
              </button>
            );
          })}
        </div>

        {outcome === "won" && (
          <div className="space-y-2">
            <Label htmlFor="value">Valor da venda (R$)</Label>
            <Input
              id="value"
              inputMode="decimal"
              placeholder="0,00"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
            />
            <Label htmlFor="reason">Observação (opcional)</Label>
            <Textarea
              id="reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: pacote anual"
            />
          </div>
        )}
        {outcome === "lost" && (
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo da perda <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: preço acima do orçamento"
              required
            />
          </div>
        )}
        {outcome === "abandoned" && (
          <div className="space-y-2">
            <Label htmlFor="reason">Observação (opcional)</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente parou de responder após 3 dias"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={finalize.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              !outcome ||
              finalize.isPending ||
              (outcome === "lost" && !reason.trim())
            }
          >
            {finalize.isPending ? "Finalizando..." : "Confirmar finalização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
