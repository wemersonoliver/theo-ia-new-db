import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomFollowup, enrollPhones } from "@/hooks/useCustomFollowup";
import { Loader2, Workflow } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phones: string[]; // já normalizados
  source?: string;
  contactLabel?: string;
}

export function EnrollInFlowDialog({ open, onOpenChange, phones, source, contactLabel }: Props) {
  const { flowsQuery } = useCustomFollowup();
  const [flowId, setFlowId] = useState<string>("");
  const [pending, setPending] = useState(false);

  const flows = (flowsQuery.data || []).filter((f) => f.enabled || f.trigger_type === "manual");

  const submit = async () => {
    if (!flowId || phones.length === 0) return;
    setPending(true);
    try {
      const res = await enrollPhones({ flow_id: flowId, phones, source: source || "manual_button" });
      toast.success(`${res.enrolled} contato(s) inscrito(s). ${res.skipped} já estavam ativos.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha ao inscrever: " + (e?.message || ""));
    } finally { setPending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" /> Inscrever em fluxo
          </DialogTitle>
          <DialogDescription>
            {contactLabel ? `Inscrever ${contactLabel}` : `Inscrever ${phones.length} contato(s)`} em um fluxo personalizado de follow-up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Fluxo</Label>
          <Select value={flowId} onValueChange={setFlowId}>
            <SelectTrigger><SelectValue placeholder="Escolha um fluxo..." /></SelectTrigger>
            <SelectContent>
              {flows.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum fluxo disponível. Crie um em Follow-Up → Fluxos Personalizados.</div>}
              {flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} {!f.enabled && "(pausado)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O contato é colocado na fila e enviado dentro da janela configurada.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending || !flowId}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Inscrever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}