import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Search, CreditCard, Users, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  refunded: { label: "Reembolsada", variant: "destructive" },
  inactive: { label: "Inativa", variant: "outline" },
};

export default function Subscriptions() {
  const { data: subscriptions, isLoading, refetch } = useSubscriptions();
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("kiwify-sync");
      if (error) throw error;
      toast.success(`Sincronização concluída! ${data?.total_synced || 0} vendas processadas.`);
      refetch();
    } catch (error) {
      toast.error("Erro ao sincronizar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setSyncing(false);
    }
  };

  const filtered = (subscriptions || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.customer_name?.toLowerCase().includes(q) ||
      s.customer_email?.toLowerCase().includes(q) ||
      s.customer_phone?.includes(q) ||
      s.product_name?.toLowerCase().includes(q) ||
      s.kiwify_order_id?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: subscriptions?.length || 0,
    active: subscriptions?.filter((s) => s.status === "active").length || 0,
    cancelled: subscriptions?.filter((s) => s.status === "cancelled" || s.status === "refunded").length || 0,
    pending: subscriptions?.filter((s) => s.status === "pending").length || 0,
  };

  return (
    <DashboardLayout title="Assinaturas" description="Gerencie as assinaturas dos clientes via Kiwify">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats.cancelled}</p>
              <p className="text-sm text-muted-foreground">Canceladas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CreditCard className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Lista de Assinaturas
              </CardTitle>
              <CardDescription>Dados sincronizados com a Kiwify</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing} variant="outline">
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar Kiwify
              </Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma assinatura encontrada</p>
              <p className="text-sm mt-1">Clique em "Sincronizar Kiwify" para importar as vendas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => {
                    const config = statusConfig[sub.status] || statusConfig.inactive;
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.customer_name || "—"}
                          {sub.customer_phone && (
                            <p className="text-xs text-muted-foreground">{sub.customer_phone}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{sub.customer_email || "—"}</TableCell>
                        <TableCell className="text-sm">{sub.product_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sub.amount_cents
                            ? `R$ ${(sub.amount_cents / 100).toFixed(2)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sub.created_at
                            ? new Date(sub.created_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
