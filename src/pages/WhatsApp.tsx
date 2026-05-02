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
import { DepartmentConnectCard } from "@/components/whatsapp/DepartmentConnectCard";
import { Loader2, Lock, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function WhatsApp() {
  const {
    instances, isLoading,
    createInstance, disconnectInstance, refreshQRCode, updateInstance,
  } = useWhatsAppInstances();
  const { tier, maxInstances } = useAccountPlan();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
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
        {canAdd && instances.length > 0 && (
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" /> Novo departamento
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

          if (isLocked) {
            return (
              <Card key={`locked-${index}`} className="relative opacity-60">
                <div className="absolute right-3 top-3"><Lock className="h-4 w-4 text-muted-foreground" /></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Departamento extra
                  </CardTitle>
                  <CardDescription>Conecte mais um número de WhatsApp</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge variant="outline">Disponível no plano Pro</Badge>
                  <p className="text-sm text-muted-foreground">
                    O plano Pro permite até 3 departamentos, cada um com IA, follow-up e mensagem de transferência próprios.
                  </p>
                  <Button className="w-full" onClick={() => navigate("/subscriptions")}>
                    Fazer upgrade
                  </Button>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={`empty-${index}`} className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" /> {index === 0 ? "Departamento principal" : "Novo departamento"}
                </CardTitle>
                <CardDescription>
                  {index === 0
                    ? "Conecte o primeiro número da sua empresa"
                    : "Adicione um número adicional para outro setor"}
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
                  <Button className="w-full" variant="outline" onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar departamento
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
            <DialogTitle>Adicionar departamento</DialogTitle>
            <DialogDescription>
              Cada departamento usa um número de WhatsApp independente. A IA pode transferir conversas entre eles.
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
    </DashboardLayout>
  );
}
