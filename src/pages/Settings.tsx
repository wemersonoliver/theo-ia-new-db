import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { Key, User, Loader2, Sun, Moon, Hash, CalendarCog, CreditCard, FileText, ChevronRight } from "lucide-react";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { TutorialTab } from "@/components/settings/TutorialTab";
import { TeamTab } from "@/components/team/TeamTab";
import { DangerZoneTab } from "@/components/settings/DangerZoneTab";
import { RouletteTab } from "@/components/settings/RouletteTab";
import { useAccount } from "@/hooks/useAccount";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isOwner, membership } = useAccount();
  const qc = useQueryClient();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [updatingBusiness, setUpdatingBusiness] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (membership?.account_name) setBusinessName(membership.account_name);
  }, [membership?.account_name]);

  const handleUpdateBusinessName = async () => {
    if (!membership) return;
    if (businessName.trim().length < 2) {
      toast.error("Informe um nome válido para o negócio");
      return;
    }
    setUpdatingBusiness(true);
    const { error } = await supabase
      .from("accounts")
      .update({ name: businessName.trim() })
      .eq("id", membership.account_id);
    if (error) {
      toast.error("Erro ao atualizar nome do negócio");
    } else {
      toast.success("Nome do negócio atualizado!");
      qc.invalidateQueries({ queryKey: ["account-membership", user?.id] });
    }
    setUpdatingBusiness(false);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdatingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("user_id", user.id);
    
    if (error) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Perfil atualizado!");
    }
    setUpdatingProfile(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
      toast.error("Erro ao atualizar senha: " + error.message);
    } else {
      toast.success("Senha atualizada!");
      setNewPassword("");
    }
    setUpdatingPassword(false);
  };

  if (loading) {
    return (
      <DashboardLayout title="Configurações" description="Gerencie suas configurações">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Configurações" 
      description="Gerencie as configurações do sistema"
    >
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="profile" className="min-w-fit">Perfil</TabsTrigger>
          <TabsTrigger value="modules" className="min-w-fit">Módulos</TabsTrigger>
          {isOwner && <TabsTrigger value="team" className="min-w-fit">Equipe</TabsTrigger>}
          <TabsTrigger value="roulette" className="min-w-fit">Roleta</TabsTrigger>
          <TabsTrigger value="notifications" className="min-w-fit">Notificações</TabsTrigger>
          <TabsTrigger value="appearance" className="min-w-fit">Aparência</TabsTrigger>
          <TabsTrigger value="security" className="min-w-fit">Segurança</TabsTrigger>
          <TabsTrigger value="tutorial" className="min-w-fit">Tutorial</TabsTrigger>
          {isOwner && <TabsTrigger value="danger" className="min-w-fit text-destructive">Avançado</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Perfil
              </CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {membership?.business_code && (
                <div className="space-y-2">
                  <Label>ID do Negócio</Label>
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-mono font-bold text-primary">#{membership.business_code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use este ID ao entrar em contato com o suporte
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="businessName">Nome do negócio</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Padaria do João"
                  disabled={!isOwner}
                />
                {isOwner ? (
                  <Button onClick={handleUpdateBusinessName} disabled={updatingBusiness} size="sm" variant="secondary">
                    {updatingBusiness && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar nome do negócio
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Apenas o proprietário pode alterar o nome do negócio.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>

              <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
                {updatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Perfil
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Módulos</CardTitle>
              <CardDescription>
                Acesse as configurações específicas de cada módulo do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                { to: "/appointment-settings", icon: CalendarCog, title: "Configuração de Horários", desc: "Tipos de agendamento e disponibilidade" },
                { to: "/subscriptions", icon: CreditCard, title: "Assinaturas", desc: "Gerenciar plano e pagamentos" },
                { to: "/knowledge-base", icon: FileText, title: "Base de Conhecimento", desc: "Documentos usados pela IA" },
              ].map((m) => (
                <button
                  key={m.to}
                  onClick={() => navigate(m.to)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 sm:p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground overflow-hidden"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{m.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{m.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="team">
          <TeamTab />
        </TabsContent>

        <TabsContent value="roulette">
          <RouletteTab />
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                Aparência
              </CardTitle>
              <CardDescription>
                Personalize a aparência do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Tema</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    className="flex flex-col gap-2 h-auto py-4"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-xs">Claro</span>
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    className="flex flex-col gap-2 h-auto py-4"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-xs">Escuro</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Escolha entre tema claro ou escuro.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>
                Atualize sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <Button onClick={handleUpdatePassword} disabled={updatingPassword}>
                {updatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Senha
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutorial">
          <TutorialTab />
        </TabsContent>

        {isOwner && (
          <TabsContent value="danger">
            <DangerZoneTab />
          </TabsContent>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
