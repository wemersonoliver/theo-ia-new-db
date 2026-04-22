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
import { Loader2, Lock, Unlock, KeyRound, Users, CreditCard, XCircle, Search, Pencil, Trash2, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { startImpersonation } from "@/lib/impersonation";


interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  user_code: number | null;
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
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [subDialog, setSubDialog] = useState<AdminUser | null>(null);
  const [subPlanType, setSubPlanType] = useState("tester");
  const [subExpiry, setSubExpiry] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialog, setEditDialog] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<AdminUser | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [user]);

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

  const openEditDialog = (u: AdminUser) => {
    setEditDialog(u);
    setEditName(u.full_name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
  };

  const handleUpdateProfile = async () => {
    if (!editDialog) return;
    setActionLoading(true);
    const { error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "update_profile",
        userId: editDialog.id,
        profileData: { full_name: editName, email: editEmail, phone: editPhone },
      },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar perfil", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Perfil atualizado com sucesso" });
      setEditDialog(null);
      fetchUsers();
    }
    setActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    setActionLoading(true);
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete_user", userId: deleteDialog.id },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir usuário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Usuário ${deleteDialog.email} excluído permanentemente` });
      setDeleteDialog(null);
      fetchUsers();
    }
    setActionLoading(false);
  };

  const handleImpersonate = async (target: AdminUser) => {
    if (!confirm(`Entrar como ${target.full_name || target.email}?\n\nVocê terá acesso TOTAL à conta dele em modo suporte. Um banner amarelo no topo permite voltar ao admin a qualquer momento.`)) return;
    setActionLoading(true);
    try {
      await startImpersonation(target.id);
      window.dispatchEvent(new Event("impersonation-changed"));
      toast({ title: "Modo suporte ativo", description: `Você agora está como ${target.email}` });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast({
        title: "Erro ao entrar",
        description: (err as Error).message,
        variant: "destructive",
      });
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.phone || "").toLowerCase().includes(term) ||
      (u.user_code?.toString() || "").includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  });

  const getSubBadge = (u: AdminUser) => {
    if (u.subscription) {
      const colors: Record<string, string> = {
        tester: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        mensal: "bg-green-500/10 text-green-400 border-green-500/20",
        anual: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        lifetime: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
    <AdminLayout title="Usuários" description="Gerencie todos os usuários da plataforma">
      <div className="space-y-6">
        <Card className="border-slate-700/50 bg-slate-900/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários Cadastrados ({filteredUsers.length}{searchTerm ? ` de ${users.length}` : ""})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, telefone ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[300px]"
                />
              </div>
              <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Atualizar
              </Button>
            </div>
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
                    <TableRow className="border-slate-700/50 hover:bg-transparent">
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">ID</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Nome</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Telefone</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Assinatura</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider">Cadastro</TableHead>
                      <TableHead className="text-amber-400/70 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredUsers.map((u) => (
                      <TableRow key={u.id} className="border-slate-700/50 hover:bg-slate-800/50">
                        <TableCell className="font-mono text-xs text-amber-400/80 py-3">#{u.user_code || "—"}</TableCell>
                        <TableCell className="font-medium text-slate-100 py-3">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-slate-300 py-3">{u.email}</TableCell>
                        <TableCell className="text-slate-300 py-3 font-mono text-xs">{u.phone || "—"}</TableCell>
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
                        <TableCell className="py-3">{getSubBadge(u)}</TableCell>
                        <TableCell className="py-3">
                          <Badge variant={u.is_blocked ? "destructive" : "outline"} className={!u.is_blocked ? "border-emerald-500/30 text-emerald-400" : ""}>
                            {u.is_blocked ? "Bloqueado" : "Ativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 py-3">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right space-x-1 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonate(u)}
                            disabled={actionLoading || u.id === user?.id}
                            title="Entrar como este usuário (modo suporte)"
                            className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                          >
                            <LogIn className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(u)}
                            disabled={actionLoading}
                            title="Editar perfil"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                            <>
                              <Button
                                variant={u.is_blocked ? "default" : "destructive"}
                                size="sm"
                                onClick={() => handleToggleBlock(u.id)}
                                disabled={actionLoading}
                                title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                              >
                                {u.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteDialog(u)}
                                disabled={actionLoading}
                                title="Excluir usuário"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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

      {/* Dialog Editar Perfil */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              {editDialog?.email} (#{editDialog?.user_code || "—"})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateProfile} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir Usuário */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário Permanentemente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deleteDialog?.full_name || deleteDialog?.email}</strong>?
              <br /><br />
              <span className="text-destructive font-semibold">
                Esta ação é irreversível. Todos os dados do usuário serão permanentemente removidos, incluindo conversas, agendamentos, contatos, configurações e CRM.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
