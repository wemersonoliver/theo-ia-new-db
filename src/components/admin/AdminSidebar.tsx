import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Smartphone,
  ScrollText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Bot,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import theoLogo from "@/assets/logo_theo_ia.png";

const adminNavItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/system-whatsapp", icon: Smartphone, label: "WhatsApp Sistema" },
  { to: "/admin/conversations", icon: MessageSquare, label: "Conversas" },
  { to: "/admin/ai-config", icon: Bot, label: "IA Suporte" },
  { to: "/admin/support", icon: Ticket, label: "Suporte" },
  { to: "/admin/logs", icon: ScrollText, label: "Logs" },
];

interface AdminSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function AdminSidebar({ mobile, onNavigate }: AdminSidebarProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const showFull = mobile || !collapsed;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r transition-all duration-300",
        "bg-[hsl(222,47%,5%)] text-slate-300 border-slate-800",
        mobile ? "w-full" : collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-3">
        {showFull ? (
          <div className="flex items-center gap-2">
            <img src={theoLogo} alt="Theo IA" className="h-7 w-7 rounded-md" />
            <div className="leading-none">
              <span className="text-sm font-bold text-white">Theo IA</span>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400">Admin</span>
              </div>
            </div>
          </div>
        ) : (
          <img src={theoLogo} alt="Theo IA" className="h-7 w-7 rounded-md mx-auto" />
        )}
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {adminNavItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-amber-500/10 text-amber-400 font-medium"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showFull && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Back to app */}
      <div className="border-t border-slate-800 p-2 space-y-1">
        <button
          onClick={() => { navigate("/dashboard"); onNavigate?.(); }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {showFull && <span>Voltar ao App</span>}
        </button>
        <Button
          variant="ghost"
          size={showFull ? "default" : "icon"}
          onClick={() => { signOut(); onNavigate?.(); }}
          className="w-full justify-start text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showFull && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
