import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, Calendar, Bot, Smartphone, TrendingUp } from "lucide-react";
import { Loader2 } from "lucide-react";

interface PlatformStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalConversations: number;
  totalAppointments: number;
  connectedInstances: number;
  aiConfigs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [
        { count: totalUsers },
        { count: activeSubscriptions },
        { count: totalConversations },
        { count: totalAppointments },
        { count: connectedInstances },
        { count: aiConfigs },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }),
        supabase.from("whatsapp_instances").select("*", { count: "exact", head: true }).eq("status", "connected"),
        supabase.from("whatsapp_ai_config").select("*", { count: "exact", head: true }).eq("active", true),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalConversations: totalConversations || 0,
        totalAppointments: totalAppointments || 0,
        connectedInstances: connectedInstances || 0,
        aiConfigs: aiConfigs || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
    setLoading(false);
  };

  const statCards = stats
    ? [
        { label: "Usuários", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
        { label: "Assinaturas Ativas", value: stats.activeSubscriptions, icon: TrendingUp, color: "text-emerald-400" },
        { label: "Conversas", value: stats.totalConversations, icon: MessageSquare, color: "text-violet-400" },
        { label: "Agendamentos", value: stats.totalAppointments, icon: Calendar, color: "text-amber-400" },
        { label: "WhatsApp Conectados", value: stats.connectedInstances, icon: Smartphone, color: "text-green-400" },
        { label: "IA Ativa", value: stats.aiConfigs, icon: Bot, color: "text-cyan-400" },
      ]
    : [];

  return (
    <AdminLayout title="Dashboard" description="Visão geral da plataforma">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((s) => (
            <Card key={s.label} className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{s.label}</CardTitle>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
