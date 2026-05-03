import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, MessageSquare, Calendar, DollarSign, Trophy, XCircle, MinusCircle, Percent, Repeat } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
  variant?: "basic" | "full";
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

export function KPICards({ metrics, variant = "full" }: Props) {
  const allItems = [
    {
      key: "leads",
      label: "Leads recebidos",
      value: metrics?.current.leads ?? 0,
      variation: metrics?.variation.leads ?? null,
      Icon: Users,
      tone: "bg-blue-500/10 text-blue-600",
    },
    {
      key: "services",
      label: "Atendimentos",
      value: metrics?.current.services ?? 0,
      variation: metrics?.variation.services ?? null,
      Icon: MessageSquare,
      tone: "bg-violet-500/10 text-violet-600",
    },
    {
      key: "appointments",
      label: "Agendamentos",
      value: metrics?.current.appointments ?? 0,
      variation: metrics?.variation.appointments ?? null,
      Icon: Calendar,
      tone: "bg-amber-500/10 text-amber-600",
    },
    {
      key: "sales",
      label: "Vendas concluídas",
      value: metrics?.current.sales ?? 0,
      sub: metrics ? formatBRL(metrics.current.salesValueCents) : "R$ 0,00",
      variation: metrics?.variation.sales ?? null,
      Icon: DollarSign,
      tone: "bg-emerald-500/10 text-emerald-600",
    },
    {
      key: "won",
      label: "Ganhos",
      value: metrics?.current.won ?? 0,
      variation: metrics?.variation.won ?? null,
      Icon: Trophy,
      tone: "bg-emerald-500/10 text-emerald-600",
    },
    {
      key: "lost",
      label: "Perdidos",
      value: metrics?.current.lost ?? 0,
      variation: metrics?.variation.lost ?? null,
      Icon: XCircle,
      tone: "bg-rose-500/10 text-rose-600",
    },
    {
      key: "abandoned",
      label: "Desistências",
      value: metrics?.current.abandoned ?? 0,
      variation: metrics?.variation.abandoned ?? null,
      Icon: MinusCircle,
      tone: "bg-slate-500/10 text-slate-600",
    },
    {
      key: "conversion",
      label: "Taxa de conversão",
      value: metrics?.current.conversionRate ?? 0,
      sub: `${metrics?.current.won ?? 0} / ${metrics?.current.finalizedTotal ?? 0} finalizados`,
      variation: metrics?.variation.conversionRate ?? null,
      Icon: Percent,
      tone: "bg-indigo-500/10 text-indigo-600",
      isPercent: true,
    },
    {
      key: "followup",
      label: "Clientes em follow-up",
      value: metrics?.current.followupActive ?? 0,
      sub: `Conversão: ${metrics?.current.followupConversionRate ?? 0}%`,
      variation: metrics?.variation.followupConversionRate ?? null,
      Icon: Repeat,
      tone: "bg-fuchsia-500/10 text-fuchsia-600",
    },
  ];

  const basicKeys = new Set(["leads", "services", "appointments", "followup"]);
  const items = variant === "basic" ? allItems.filter((i) => basicKeys.has(i.key)) : allItems;

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
            <p className="text-xl sm:text-2xl font-bold truncate">
              {it.value.toLocaleString("pt-BR")}{(it as any).isPercent ? "%" : ""}
            </p>
            {it.sub && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{it.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}