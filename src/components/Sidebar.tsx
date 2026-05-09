import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Smartphone,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ShieldCheck,
  Users,
  Kanban,
  Ticket,
  BookOpen,
  ListChecks,
  Bot,
  FlaskConical,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import theoLogo from "@/assets/logo_theo_ia.png";
import { useAccount } from "@/hooks/useAccount";
import { ThemeToggle } from "@/components/fx/ThemeToggle";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", perm: null as string | null },
  { to: "/conversations", icon: MessageSquare, label: "Conversas", perm: "conversations" },
  { to: "/whatsapp", icon: Smartphone, label: "WhatsApp", perm: "whatsapp_instance" },
  { to: "/ai-agent", icon: Bot, label: "Agente IA", perm: "settings" },
  { to: "/simulate-attendance", icon: FlaskConical, label: "Simular Atendimento", perm: "settings" },
  { to: "/followup", icon: Repeat, label: "Follow-Up", perm: "settings" },
  { to: "/crm", icon: Kanban, label: "CRM", perm: "crm" },
  { to: "/contacts", icon: Users, label: "Contatos", perm: "contacts" },
  { to: "/tasks", icon: ListChecks, label: "Tarefas", perm: "crm" },
  { to: "/appointments", icon: Calendar, label: "Agendamentos", perm: "appointments" },
  { to: "/settings", icon: Settings, label: "Configurações", perm: "settings" },
  { to: "/help-center", icon: BookOpen, label: "Central de Ajuda", perm: null },
  { to: "/support", icon: Ticket, label: "Suporte", perm: "support" },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile, onNavigate }: SidebarProps) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { membership, can } = useAccount();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .then(({ data }) => {
        setIsSuperAdmin(!!(data && data.length > 0));
      });
  }, [user]);

  // Filtra itens conforme permissão do papel/overrides do membro
  const visibleNavItems = navItems.filter((item) => {
    if (!item.perm) return true;
    // Sem membership ainda? mostra tudo (ex: cadastro recém-criado)
    if (!membership) return true;
    return can(item.perm);
  });

  const allNavItems = isSuperAdmin
    ? [...visibleNavItems, { to: "/admin/dashboard", icon: ShieldCheck, label: "Administração", perm: null }]
    : visibleNavItems;

  const showFull = mobile || !collapsed;

  return (
    <>
      <aside
        className={cn(
          "relative flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border/60 overflow-hidden",
          mobile ? "w-full" : (collapsed ? "w-16" : "w-64")
        )}
      >
        {/* Subtle inner glow */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
        {/* Header */}
        <div className="relative flex h-16 items-center justify-between border-b border-sidebar-border/60 px-4">
          {showFull ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md animate-pulse-glow" />
                <img src={theoLogo} alt="Theo IA" className="relative h-8 w-8 rounded-lg" />
              </div>
              <span className="text-lg font-display font-bold tracking-tight">
                Theo <span className="gradient-text">IA</span>
              </span>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md animate-pulse-glow" />
              <img src={theoLogo} alt="Theo IA" className="relative h-8 w-8 rounded-lg" />
            </div>
          )}
          <div className="flex items-center gap-1">
            {showFull && <ThemeToggle />}
            {!mobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 space-y-1 overflow-y-auto p-2">
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-primary/30 via-primary/15 to-transparent text-primary-foreground shadow-glow-primary border border-primary/40"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-glow-primary" />
                )}
                <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive && "text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                {showFull && <span className={cn("text-sm font-medium", isActive && "text-foreground")}>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="relative border-t border-sidebar-border/60 p-4 space-y-2">
          {showFull && user && (
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground shadow-glow-primary">
                {user.email?.[0]?.toUpperCase()}
              </div>
              <p className="truncate text-xs text-sidebar-foreground/80">{user.email}</p>
            </div>
          )}
          <Button
            variant="glass"
            size={showFull ? "default" : "icon"}
            onClick={() => {
              signOut();
              onNavigate?.();
            }}
            className="w-full justify-start"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {showFull && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
