import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Workflow, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAttendanceFlows } from "@/hooks/useAttendanceFlows";

export default function AdminFlows() {
  const navigate = useNavigate();
  const { flows, createFlow, updateFlow, deleteFlow } = useAttendanceFlows();
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");

  const handleCreate = async () => {
    const created = await createFlow.mutateAsync({ name: name || "Novo fluxo", trigger_text: trigger });
    setOpenNew(false);
    setName(""); setTrigger("");
    if (created?.id) navigate(`/admin/flows/${created.id}`);
  };

  return (
    <AdminLayout title="Fluxos de Atendimento" description="Campanhas estilo Typebot disparadas por mensagens-gatilho no WhatsApp do sistema">
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Workflow className="h-5 w-5 text-amber-400" />
            <span className="text-sm">Total: {flows.data?.length || 0}</span>
          </div>
          <Button onClick={() => setOpenNew(true)} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
            <Plus className="h-4 w-4" /> Novo Fluxo
          </Button>
        </div>

        {flows.isLoading ? (
          <div className="flex justify-center p-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (flows.data?.length || 0) === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-8 text-center text-slate-400">
              Nenhum fluxo criado ainda. Clique em "Novo Fluxo" para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {flows.data!.map((f) => (
              <Card key={f.id} className="bg-slate-900/50 border-slate-800 hover:border-amber-500/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <button className="flex-1 text-left" onClick={() => navigate(`/admin/flows/${f.id}`)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">{f.name}</h3>
                      {f.is_active ? <Badge className="bg-emerald-900/40 text-emerald-300">ativo</Badge> : <Badge className="bg-slate-700 text-slate-300">inativo</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">Gatilho: <span className="text-amber-400/80">"{f.trigger_text}"</span> · {f.trigger_match_mode === "exact" ? "exato" : "contém"}</p>
                    {f.description && <p className="text-xs text-slate-500 truncate mt-1">{f.description}</p>}
                  </button>
                  <div className="flex items-center gap-2">
                    <Switch checked={f.is_active} onCheckedChange={(v) => updateFlow.mutate({ id: f.id, is_active: v })} />
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/flows/${f.id}`)} className="text-slate-300 hover:bg-slate-800"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir "${f.name}"?`)) deleteFlow.mutate(f.id); }} className="text-red-400 hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader><DialogTitle>Novo Fluxo de Atendimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Campanha Theo IA" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-1">
              <Label>Mensagem-gatilho</Label>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="Olá! Quero saber mais sobre o Theo IA." className="bg-slate-800 border-slate-700" />
              <p className="text-xs text-slate-500">Quando esta mensagem chegar no WhatsApp do sistema, o fluxo é iniciado.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!trigger.trim() || createFlow.isPending} className="bg-amber-500 hover:bg-amber-600 text-black">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}