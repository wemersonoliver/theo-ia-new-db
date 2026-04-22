import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingDown, TrendingUp, Timer } from "lucide-react";
import { formatDuration } from "@/lib/dashboard-metrics";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

function VarBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  // For times, lower is better
  const good = value < 0;
  const Icon = value <= 0 ? TrendingDown : TrendingUp;
  const color = good ? "text-emerald-600" : value === 0 ? "text-muted-foreground" : "text-rose-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%
    </span>
  );
}

export function AvgServiceTimeCard({ metrics }: Props) {
  const { members } = useTeamMembers();
  const perAttendant = metrics?.current.perAttendant || {};

  const rows = Object.entries(perAttendant)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([uid, v]) => {
      const member = members.find((m) => m.user_id === uid);
      return {
        name: uid === "__unassigned__" ? "Não atribuído" : member?.full_name || member?.email || "Atendente",
        tma: v.tma,
        count: v.count,
      };
    });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          Tempo médio de atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <VarBadge value={metrics?.variation.avgFirstResponseSec ?? null} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">1ª resposta</p>
            <p className="text-xl font-bold tabular-nums">
              {formatDuration(metrics?.current.avgFirstResponseSec ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <VarBadge value={metrics?.variation.avgServiceTimeSec ?? null} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Atendimento total</p>
            <p className="text-xl font-bold tabular-nums">
              {formatDuration(metrics?.current.avgServiceTimeSec ?? 0)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Por atendente</p>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.name} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{r.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatDuration(Math.round(r.tma))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}