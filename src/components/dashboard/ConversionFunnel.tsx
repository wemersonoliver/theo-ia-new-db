import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

export function ConversionFunnel({ metrics }: Props) {
  const leads = metrics?.current.leads ?? 0;
  const services = metrics?.current.services ?? 0;
  const appointments = metrics?.current.appointments ?? 0;
  const sales = metrics?.current.sales ?? 0;

  const stages = [
    { label: "Leads", value: leads, color: "bg-blue-500" },
    { label: "Atendimentos", value: services, color: "bg-violet-500" },
    { label: "Agendamentos", value: appointments, color: "bg-amber-500" },
    { label: "Vendas", value: sales, color: "bg-emerald-500" },
  ];
  const max = Math.max(leads, 1);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-primary" />
          Funil de conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((s, i) => {
            const pct = (s.value / max) * 100;
            const prev = i > 0 ? stages[i - 1].value : null;
            const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-sm tabular-nums">
                    {s.value.toLocaleString("pt-BR")}
                    {conv !== null && <span className="ml-2 text-xs text-muted-foreground">({conv}%)</span>}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${s.color} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}