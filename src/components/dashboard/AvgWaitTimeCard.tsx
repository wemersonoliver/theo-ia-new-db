import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hourglass, TrendingDown, TrendingUp } from "lucide-react";
import { formatDuration } from "@/lib/dashboard-metrics";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

function VarBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const good = value < 0; // menor espera é melhor
  const Icon = value <= 0 ? TrendingDown : TrendingUp;
  const color = good ? "text-emerald-600" : value === 0 ? "text-muted-foreground" : "text-rose-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%
    </span>
  );
}

export function AvgWaitTimeCard({ metrics }: Props) {
  const { members } = useTeamMembers();
  const perWait = metrics?.current.perAttendantWait || {};

  const rows = Object.entries(perWait)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([uid, v]) => {
      const member = members.find((m) => m.user_id === uid);
      return {
        name: uid === "__unassigned__" ? "Não atribuído" : member?.full_name || member?.email || "Atendente",
        wait: v.wait,
        count: v.count,
      };
    });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hourglass className="h-4 w-4 text-primary" />
          Tempo médio de espera
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Geral (1ª resposta)</span>
            <VarBadge value={metrics?.variation.avgFirstResponseSec ?? null} />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatDuration(metrics?.current.avgFirstResponseSec ?? 0)}
          </p>
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
                  <span className="tabular-nums text-muted-foreground">
                    {formatDuration(Math.round(r.wait))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
