import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { usePlans, useUpsertPlan, useDeletePlan, Plan } from "@/hooks/usePlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Crown, ExternalLink } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FormState = Partial<Plan> & { featuresText?: string };

const empty: FormState = {
  slug: "", name: "", tier: "basic", billing_period: "monthly",
  price_cents: 0, currency: "BRL", checkout_url: "",
  description: "", featuresText: "", is_active: true, is_recommended: false, position: 0,
};

export default function AdminPlans() {
  const { data: plans = [], isLoading } = usePlans({ onlyActive: false });
  const upsert = useUpsertPlan();
  const del = useDeletePlan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  const openCreate = () => { setForm(empty); setOpen(true); };
  const openEdit = (p: Plan) => {
    setForm({ ...p, featuresText: (p.features || []).join("\n") });
    setOpen(true);
  };

  const submit = async () => {
    const features = (form.featuresText || "")
      .split("\n").map((s) => s.trim()).filter(Boolean);
    const { featuresText, ...rest } = form;
    await upsert.mutateAsync({
      ...rest,
      features: features as any,
      price_cents: Number(rest.price_cents) || 0,
      position: Number(rest.position) || 0,
    });
    setOpen(false);
  };

  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

  return (
    <AdminLayout title="Planos" description="Gerencie os planos disponíveis">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Planos</h1>
            <p className="text-slate-400 text-sm">Configure os planos exibidos no checkout</p>
          </div>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
            <Plus className="h-4 w-4 mr-2" /> Novo plano
          </Button>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Plano</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Tier</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Período</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Preço</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Status</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs">Checkout</TableHead>
                <TableHead className="text-amber-400/70 font-semibold uppercase text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">Carregando...</TableCell></TableRow>
              ) : plans.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">Nenhum plano</TableCell></TableRow>
              ) : plans.map((p) => (
                <TableRow key={p.id} className="border-slate-800">
                  <TableCell className="text-slate-200 font-medium">
                    <div className="flex items-center gap-2">
                      {p.is_recommended && <Crown className="h-4 w-4 text-amber-400" />}
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-500">{p.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.tier === "pro" ? "default" : "secondary"} className={p.tier === "pro" ? "bg-amber-500 text-slate-950" : ""}>
                      {p.tier.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">{p.billing_period === "monthly" ? "Mensal" : "Anual"}</TableCell>
                  <TableCell className="text-slate-200 font-semibold">{fmtBRL(p.price_cents)}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-emerald-600" : "bg-slate-700"}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.checkout_url ? (
                      <a href={p.checkout_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 text-xs">
                        Abrir <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-slate-500 text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="text-slate-300 hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(p)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="basic-monthly" />
            </div>
            <div>
              <Label>Posição</Label>
              <Input type="number" value={form.position ?? 0} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período</Label>
              <Select value={form.billing_period} onValueChange={(v) => setForm({ ...form, billing_period: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço (centavos)</Label>
              <Input type="number" value={form.price_cents ?? 0} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} />
              <div className="text-xs text-muted-foreground mt-1">Ex: 9700 = R$ 97,00</div>
            </div>
            <div>
              <Label>Moeda</Label>
              <Input value={form.currency || "BRL"} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Link Kiwify</Label>
              <Input value={form.checkout_url || ""} onChange={(e) => setForm({ ...form, checkout_url: e.target.value })} placeholder="https://pay.kiwify.com.br/..." />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Features (uma por linha)</Label>
              <Textarea value={form.featuresText || ""} onChange={(e) => setForm({ ...form, featuresText: e.target.value })} rows={5} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_recommended} onCheckedChange={(v) => setForm({ ...form, is_recommended: v })} />
              <Label>Recomendado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (confirmDelete) await del.mutateAsync(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}