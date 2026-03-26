import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  function_name: string;
  status: "success" | "error" | "pending";
  message: string;
  timestamp: string;
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch recent activity from various tables as a proxy for logs
      const [
        { data: recentConvos },
        { data: recentAppointments },
        { data: recentSessions },
      ] = await Promise.all([
        supabase
          .from("whatsapp_conversations")
          .select("id, phone, contact_name, last_message_at, total_messages")
          .order("last_message_at", { ascending: false })
          .limit(10),
        supabase
          .from("appointments")
          .select("id, title, phone, contact_name, created_at, status")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("whatsapp_ai_sessions")
          .select("id, phone, status, updated_at, messages_without_human")
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      const logEntries: LogEntry[] = [];

      recentConvos?.forEach((c) => {
        logEntries.push({
          id: `conv-${c.id}`,
          function_name: "whatsapp-webhook",
          status: "success",
          message: `Conversa com ${c.contact_name || c.phone} — ${c.total_messages} msgs`,
          timestamp: c.last_message_at || "",
        });
      });

      recentAppointments?.forEach((a) => {
        logEntries.push({
          id: `apt-${a.id}`,
          function_name: "manage-appointment",
          status: a.status === "cancelled" ? "error" : "success",
          message: `${a.title} — ${a.contact_name || a.phone} (${a.status})`,
          timestamp: a.created_at || "",
        });
      });

      recentSessions?.forEach((s) => {
        logEntries.push({
          id: `ses-${s.id}`,
          function_name: "whatsapp-ai-agent",
          status: s.status === "handed_off" ? "pending" : "success",
          message: `Sessão IA ${s.phone} — ${s.status} (${s.messages_without_human} msgs sem humano)`,
          timestamp: s.updated_at || "",
        });
      });

      logEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(logEntries.slice(0, 30));
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "error": return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
      case "pending": return <Clock className="h-3.5 w-3.5 text-amber-400" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      error: "bg-red-500/10 text-red-400 border-red-500/20",
      pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
    return (
      <Badge variant="outline" className={styles[status] || ""}>
        {status}
      </Badge>
    );
  };

  return (
    <AdminLayout title="Logs do Sistema" description="Atividade recente da plataforma">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>

        <Card className="border-slate-700/50 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <ScrollText className="h-4 w-4" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nenhuma atividade encontrada.</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-800/50 transition-colors"
                  >
                    {getStatusIcon(log.status)}
                    <span className="shrink-0 font-mono text-xs text-slate-500 w-40 truncate">
                      {log.function_name}
                    </span>
                    <span className="flex-1 truncate text-slate-300">{log.message}</span>
                    <span className="shrink-0 text-xs text-slate-600">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
