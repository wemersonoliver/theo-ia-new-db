import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Unlock, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Navigate } from "react-router-dom";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_blocked: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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

  if (isSuperAdmin === false) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout title="Administração" description="Gerencie todos os usuários da plataforma">
      <div className="space-y-6">

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Último Login</TableHead>
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
                      <TableCell>
                        <Badge variant={u.is_blocked ? "destructive" : "outline"}>
                          {u.is_blocked ? "Bloqueado" : "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPasswordDialog(u.id)}
                          disabled={actionLoading}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {!u.roles.includes("super_admin") && (
                          <Button
                            variant={u.is_blocked ? "default" : "destructive"}
                            size="sm"
                            onClick={() => handleToggleBlock(u.id)}
                            disabled={actionLoading}
                          >
                            {u.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

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
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
