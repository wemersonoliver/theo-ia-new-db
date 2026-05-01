import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type HealthRow = {
  api_name: string;
  status: "ok" | "down" | "unknown";
  last_ok_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  consecutive_failures: number;
};

const LABELS: Record<string, string> = {
  evolution_api: "Evolution API",
  gemini: "Google Gemini",
  groq: "Groq (Áudio)",
  elevenlabs: "ElevenLabs (Voz)",
};

export function ApiHealthStatus() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("system_api_health")
      .select("api_name, status, last_ok_at, last_error_at, last_error_message, consecutive_failures")
      .order("api_name");
    if (data) setRows(data as HealthRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("api-health-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_api_health" },
        () => load(),
      )
      .subscribe();
    const interval = setInterval(load, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) return null;

  return (
    <Card className="mb-4 border-slate-700/50 bg-slate-900/50 backdrop-blur">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400/80">
            Status das APIs externas
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => {
            const isDown = r.status === "down";
            const isOk = r.status === "ok";
            const Icon = isOk ? CheckCircle2 : isDown ? AlertTriangle : HelpCircle;
            const tone = isOk
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              : isDown
                ? "border-rose-500/40 bg-rose-500/10 text-rose-400 animate-pulse"
                : "border-slate-600/40 bg-slate-800/40 text-slate-400";
            const last = isDown ? r.last_error_at : r.last_ok_at;
            return (
              <div
                key={r.api_name}
                className={`flex items-start gap-2 rounded-lg border p-3 ${tone}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {LABELS[r.api_name] || r.api_name}
                  </p>
                  <p className="text-xs">
                    {isOk
                      ? "Operacional"
                      : isDown
                        ? `Falha (${r.consecutive_failures})`
                        : "Sem dados"}
                  </p>
                  {last && (
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {isDown ? "erro" : "ok"} há{" "}
                      {formatDistanceToNow(new Date(last), { locale: ptBR })}
                    </p>
                  )}
                  {isDown && r.last_error_message && (
                    <p className="mt-1 line-clamp-2 text-[10px] text-rose-300/80">
                      {r.last_error_message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}