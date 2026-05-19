import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useAccountPlan } from "@/hooks/useAccountPlan";
import { usePlans } from "@/hooks/usePlans";
import { DepartmentConnectCard } from "@/components/whatsapp/DepartmentConnectCard";
import { Loader2, Lock, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { buildCheckoutUrl } from "@/lib/kiwify";

export default function WhatsApp() {
  const { user } = useAuth();
  const {
    instances, isLoading,
    createInstance, disconnectInstance, refreshQRCode, updateInstance,
  } = useWhatsAppInstances();
  const { tier, maxInstances } = useAccountPlan();
  const { data: plans = [] } = usePlans();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const openAddDialog = () => { setNewName(""); setDialogOpen(true); };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createInstance.mutate(
      { departmentName: newName.trim() },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewName("");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout title="WhatsApp" description="Conecte seu WhatsApp">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // 3 slots fixos
  const slots: Array<{ instance: typeof instances[number] | null; index: number }> = [];
  for (let i = 0; i < 3; i++) slots.push({ instance: instances[i] ?? null, index: i });

  const isPro = tier === "pro" || tier === "tester";
  const canAdd = instances.length < maxInstances;

  const proMonthly = plans.find((p) => p.tier === "pro" && p.billing_period === "monthly");
  const proAnnual = plans.find((p) => p.tier === "pro" && p.billing_period === "annual");

  const handleAddClick = () => {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    openAddDialog();
  };

  return (
    <DashboardLayout
      title="WhatsApp"
      description="Cada departamento opera como um número independente"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {instances.length}/{maxInstances} departamentos · plano{" "}
          <span className="font-medium uppercase">{tier}</span>
        </p>
        {instances.length > 0 && (
          <Button size="sm" onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" /> Novo número de WhatsApp
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {slots.map(({ instance, index }) => {
          const isExtra = index > 0;
          const isLocked = isExtra && !isPro;

          if (instance) {
            return (
              <DepartmentConnectCard
                key={instance.id}
                instance={instance}
                onDisconnect={(id) => disconnectInstance.mutate(id)}
                onRefresh={(id, phone) =>
                  refreshQRCode.mutate({ instanceId: id, phoneNumber: phone || undefined })
                }
                onUpdate={(id, patch) => updateInstance.mutate({ instanceId: id, patch })}
                isBusy={disconnectInstance.isPending || refreshQRCode.isPending}
              />
            );
          }

          return (
            <Card key={`empty-${index}`} className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" /> {index === 0 ? "Número principal" : "Novo número de WhatsApp"}
                </CardTitle>
                <CardDescription>
                  {index === 0
                    ? "Conecte o primeiro número da sua empresa"
                    : "Adicione um número adicional de WhatsApp"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {index === 0 ? (
                  <Button
                    className="w-full"
                    onClick={() => createInstance.mutate({ departmentName: "Principal" })}
                    disabled={createInstance.isPending}
                  >
                    {createInstance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Conectar WhatsApp
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" onClick={handleAddClick}>
                    {!isPro && <Lock className="mr-2 h-4 w-4" />}
                    {isPro ? <Plus className="mr-2 h-4 w-4" /> : null}
                    Novo número de WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo número de WhatsApp</DialogTitle>
            <DialogDescription>
              Cada número opera como um departamento independente. A IA pode transferir conversas entre eles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome do departamento</Label>
            <Input
              placeholder="Ex.: Vendas, Suporte, Financeiro"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O nome técnico ficará como <code>biz&lt;código&gt;_{newName ? newName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").slice(0,20) || "departamento" : "..."}</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createInstance.isPending}>
              {createInstance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Disponível no plano Pro
            </DialogTitle>
            <DialogDescription>
              Conectar mais de um número de WhatsApp é uma funcionalidade exclusiva do plano Pro.
              Faça o upgrade agora e libere até 3 números, cada um com IA, follow-up e mensagem de transferência próprios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {proMonthly && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pro Mensal</CardTitle>
                  <CardDescription>
                    {(proMonthly.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: proMonthly.currency || "BRL" })}/mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!proMonthly.checkout_url}
                    onClick={() => proMonthly.checkout_url && window.open(buildCheckoutUrl(proMonthly.checkout_url, user), "_blank")}>
                    Atualizar agora
                  </Button>
                </CardContent>
              </Card>
            )}
            {proAnnual && (
              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    Pro Anual <Badge>Melhor oferta</Badge>
                  </CardTitle>
                  <CardDescription>
                    {(proAnnual.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: proAnnual.currency || "BRL" })}/ano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!proAnnual.checkout_url}
                    onClick={() => proAnnual.checkout_url && window.open(buildCheckoutUrl(proAnnual.checkout_url, user), "_blank")}>
                    Atualizar agora
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
