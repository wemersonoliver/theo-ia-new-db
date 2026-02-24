import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Smartphone,
  Bot,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import theoLogo from "@/assets/logo_theo_ia.png";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/whatsapp", icon: Smartphone, label: "WhatsApp" },
  { to: "/ai-agent", icon: Bot, label: "Agente IA" },
  { to: "/knowledge-base", icon: FileText, label: "Base de Conhecimento" },
  { to: "/conversations", icon: MessageSquare, label: "Conversas" },
  { to: "/contacts", icon: Users, label: "Contatos" },
  { to: "/appointments", icon: Calendar, label: "Agendamentos" },
  { to: "/appointment-settings", icon: CalendarCog, label: "Config. Horários" },
  { to: "/settings", icon: Settings, label: "Configurações" },
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

  const allNavItems = isSuperAdmin
    ? [...navItems, { to: "/admin", icon: ShieldCheck, label: "Administração" }]
    : navItems;

  // Em mobile, sempre mostrar expandido
  const showFull = mobile || !collapsed;

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
        mobile ? "w-full" : (collapsed ? "w-16" : "w-64")
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {showFull ? (
          <div className="flex items-center gap-2">
            <img src={theoLogo} alt="Theo IA" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-sidebar-primary">Theo IA</span>
          </div>
        ) : (
          <img src={theoLogo} alt="Theo IA" className="h-8 w-8 rounded-lg" />
        )}
        {/* Esconder botão collapse em mobile */}
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {allNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {showFull && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-4">
        {showFull && user && (
          <p className="mb-2 truncate text-sm text-sidebar-foreground/70">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={showFull ? "default" : "icon"}
          onClick={() => {
            signOut();
            onNavigate?.();
          }}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {showFull && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
