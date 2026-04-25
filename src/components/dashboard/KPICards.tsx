import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, MessageSquare, Calendar, DollarSign } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

function VarBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = inverse ? value < 0 : value > 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  const color = positive ? "text-emerald-600" : value === 0 ? "text-muted-foreground" : "text-rose-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%
    </span>
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function KPICards({ metrics }: Props) {
  const items = [
    {
      label: "Leads recebidos",
      value: metrics?.current.leads ?? 0,
      variation: metrics?.variation.leads ?? null,
      Icon: Users,
      tone: "bg-blue-500/10 text-blue-600",
    },
    {
      label: "Atendimentos",
      value: metrics?.current.services ?? 0,
      variation: metrics?.variation.services ?? null,
      Icon: MessageSquare,
      tone: "bg-violet-500/10 text-violet-600",
    },
    {
      label: "Agendamentos",
      value: metrics?.current.appointments ?? 0,
      variation: metrics?.variation.appointments ?? null,
      Icon: Calendar,
      tone: "bg-amber-500/10 text-amber-600",
    },
    {
      label: "Vendas concluídas",
      value: metrics?.current.sales ?? 0,
      sub: metrics ? formatBRL(metrics.current.salesValueCents) : "R$ 0,00",
      variation: metrics?.variation.sales ?? null,
      Icon: DollarSign,
      tone: "bg-emerald-500/10 text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between">
              <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg ${it.tone}`}>
                <it.Icon className="h-4 w-4" />
              </div>
              <VarBadge value={it.variation} />
            </div>
            <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground truncate">{it.label}</p>
            <p className="text-xl sm:text-2xl font-bold truncate">{it.value.toLocaleString("pt-BR")}</p>
            {it.sub && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{it.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}