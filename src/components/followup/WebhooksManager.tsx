import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Webhook, Plus, Trash2, Loader2 } from "lucide-react";
import { useFollowupWebhooks, WEBHOOK_EVENTS, type FollowupWebhook } from "@/hooks/useFollowupWebhooks";
import { useCustomFollowup } from "@/hooks/useCustomFollowup";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function WebhooksManager() {
  const { listQuery, create, update, remove } = useFollowupWebhooks();
  const { flowsQuery } = useCustomFollowup();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<FollowupWebhook>>({
    name: "Webhook", url: "", events: ["sent", "completed", "stopped", "failed"], flow_id: null, secret: "", enabled: true,
  });

  const submit = async () => {
    if (!draft.url) return;
    await create.mutateAsync(draft);
    setOpen(false);
    setDraft({ name: "Webhook", url: "", events: ["sent", "completed", "stopped", "failed"], flow_id: null, secret: "", enabled: true });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" /> Webhooks
            </CardTitle>
            <CardDescription>
              Receba notificações HTTP quando passos forem enviados, fluxos finalizarem, ou contatos pararem.
              Use para integrar com Zapier, Make, n8n ou seu backend.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo webhook</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div>
                  <Label>URL de destino</Label>
                  <Input placeholder="https://exemplo.com/hook" value={draft.url || ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
                </div>
                <div>
                  <Label>Fluxo (opcional)</Label>
                  <Select value={draft.flow_id || "all"} onValueChange={(v) => setDraft({ ...draft, flow_id: v === "all" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os fluxos</SelectItem>
                      {(flowsQuery.data || []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Eventos</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {WEBHOOK_EVENTS.map((ev) => (
                      <label key={ev} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(draft.events || []).includes(ev)}
                          onCheckedChange={(checked) => {
                            const set = new Set(draft.events || []);
                            if (checked) set.add(ev); else set.delete(ev);
                            setDraft({ ...draft, events: Array.from(set) });
                          }}
                        />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Secret (opcional)</Label>
                  <Input
                    placeholder="Enviado no header x-followup-secret"
                    value={draft.secret || ""} onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={!draft.url || create.isPending}>
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {listQuery.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (listQuery.data?.length ?? 0) === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Nenhum webhook cadastrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {listQuery.data!.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{w.name}</span>
                    {w.flow_id && <Badge variant="outline" className="text-xs">por fluxo</Badge>}
                    {w.last_status != null && (
                      <Badge variant={w.last_status >= 200 && w.last_status < 300 ? "default" : "destructive"} className="text-xs">
                        último: {w.last_status || "erro"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{w.url}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {w.events.map((e) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                  </div>
                  {w.last_error && <div className="text-xs text-destructive">{w.last_error}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={w.enabled} onCheckedChange={(v) => update.mutate({ id: w.id, enabled: v })} />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(w.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}