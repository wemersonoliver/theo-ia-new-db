import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Unlock, KeyRound, Users, CreditCard, XCircle } from "lucide-react";
import { Navigate } from "react-router-dom";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_blocked: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  subscription: {
    id: string;
    status: string;
    plan_type: string;
    product_name: string;
    expires_at: string | null;
  } | null;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [subDialog, setSubDialog] = useState<AdminUser | null>(null);
  const [subPlanType, setSubPlanType] = useState("tester");
  const [subExpiry, setSubExpiry] = useState("");

  useEffect(() => {
    checkRole();
  }, [user]);

  const checkRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin");

    const isAdmin = (data && data.length > 0) || false;
    setIsSuperAdmin(isAdmin);
    if (isAdmin) fetchUsers();
    else setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list_users" },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar usuários", variant: "destructive" });
    } else {
      setUsers(data.users || []);
    }
    setLoading(false);
  };

  const handleToggleBlock = async (userId: string) => {
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "toggle_block", userId },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao alterar status", variant: "destructive" });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_blocked: data.is_blocked } : u))
      );
      toast({ title: "Sucesso", description: data.is_blocked ? "Usuário bloqueado" : "Usuário desbloqueado" });
    }
    setActionLoading(false);
  };

  const handleChangePassword = async () => {
    if (!passwordDialog || !newPassword || newPassword.length < 6) {
      toast({ title: "Erro", description: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "update_password", userId: passwordDialog, password: newPassword },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao alterar senha", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Senha alterada com sucesso" });
      setPasswordDialog(null);
      setNewPassword("");
    }
    setActionLoading(false);
  };

  const handleGrantSubscription = async () => {
    if (!subDialog) return;
    setActionLoading(true);

    const planLabels: Record<string, string> = {
      tester: "Acesso Tester",
      mensal: "Plano Mensal",
      anual: "Plano Anual",
      lifetime: "Acesso Vitalício",
    };

    const { error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "grant_subscription",
        userId: subDialog.id,
        subscriptionData: {
          plan_type: subPlanType,
          product_name: planLabels[subPlanType] || subPlanType,
          customer_name: subDialog.full_name,
          expires_at: subExpiry || null,
        },
      },
    });

    if (error) {
      toast({ title: "Erro", description: "Falha ao conceder assinatura", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Assinatura "${planLabels[subPlanType]}" concedida para ${subDialog.email}` });
      setSubDialog(null);
      setSubPlanType("tester");
      setSubExpiry("");
      fetchUsers();
    }
    setActionLoading(false);
  };

  const handleRevokeSubscription = async (userId: string) => {
    setActionLoading(true);
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "revoke_subscription", userId },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao revogar assinatura", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Assinatura revogada" });
      fetchUsers();
    }
    setActionLoading(false);
  };

  if (isSuperAdmin === false) {
    return <Navigate to="/dashboard" replace />;
  }

  const getSubBadge = (u: AdminUser) => {
    if (u.subscription) {
      const colors: Record<string, string> = {
        tester: "bg-blue-500/10 text-blue-600 border-blue-200",
        mensal: "bg-green-500/10 text-green-600 border-green-200",
        anual: "bg-purple-500/10 text-purple-600 border-purple-200",
        lifetime: "bg-amber-500/10 text-amber-600 border-amber-200",
      };
      return (
        <Badge variant="outline" className={colors[u.subscription.plan_type] || ""}>
          {u.subscription.product_name || u.subscription.plan_type}
        </Badge>
      );
    }
    return <Badge variant="secondary" className="opacity-50">Sem assinatura</Badge>;
  };

  return (
    <DashboardLayout title="Administração" description="Gerencie todos os usuários da plataforma">
      <div className="space-y-6">
        <div className="flex gap-3">
          <Button onClick={() => navigate("/admin/system-whatsapp")} variant="outline" className="gap-2">
            <Smartphone className="h-4 w-4" />
            WhatsApp do Sistema
          </Button>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários Cadastrados ({users.length})
            </CardTitle>
            <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assinatura</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {u.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={r === "super_admin" ? "default" : "secondary"}
                              className="mr-1"
                            >
                              {r}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>{getSubBadge(u)}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_blocked ? "destructive" : "outline"}>
                            {u.is_blocked ? "Bloqueado" : "Ativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSubDialog(u)}
                            disabled={actionLoading}
                            title="Conceder assinatura"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          {u.subscription && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevokeSubscription(u.id)}
                              disabled={actionLoading}
                              title="Revogar assinatura"
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPasswordDialog(u.id)}
                            disabled={actionLoading}
                            title="Alterar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!u.roles.includes("super_admin") && (
                            <Button
                              variant={u.is_blocked ? "default" : "destructive"}
                              size="sm"
                              onClick={() => handleToggleBlock(u.id)}
                              disabled={actionLoading}
                              title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                            >
                              {u.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Alterar Senha */}
      <Dialog open={!!passwordDialog} onOpenChange={() => { setPasswordDialog(null); setNewPassword(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha do Usuário</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Nova senha (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialog(null); setNewPassword(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Conceder Assinatura */}
      <Dialog open={!!subDialog} onOpenChange={() => { setSubDialog(null); setSubPlanType("tester"); setSubExpiry(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Assinatura</DialogTitle>
            <DialogDescription>
              {subDialog?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Plano</Label>
              <Select value={subPlanType} onValueChange={setSubPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tester">🧪 Tester (gratuito)</SelectItem>
                  <SelectItem value="mensal">📅 Mensal</SelectItem>
                  <SelectItem value="anual">📆 Anual</SelectItem>
                  <SelectItem value="lifetime">♾️ Vitalício</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Expiração (opcional)</Label>
              <Input
                type="date"
                value={subExpiry}
                onChange={(e) => setSubExpiry(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para acesso sem expiração
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSubDialog(null); setSubPlanType("tester"); setSubExpiry(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleGrantSubscription} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Conceder Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
