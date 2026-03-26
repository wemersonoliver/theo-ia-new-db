import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .then(({ data }) => setIsSuperAdmin(!!(data && data.length > 0)));
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (isSuperAdmin === null) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen bg-[hsl(222,47%,8%)] text-slate-200">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64">
            <AdminSidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-slate-800 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-8 w-8 text-slate-400 hover:bg-slate-800"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            {title && <h1 className="text-base font-semibold text-white">{title}</h1>}
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
