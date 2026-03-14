import { useMemo } from "react";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { CRMStage } from "@/hooks/useCRMStages";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Target, Clock } from "lucide-react";

interface CRMStatsProps {
  deals: CRMDeal[];
  stages: CRMStage[];
}

export function CRMStats({ deals, stages }: CRMStatsProps) {
  const stats = useMemo(() => {
    const totalValue = deals.reduce((sum, d) => sum + (d.value_cents || 0), 0);
    const wonDeals = deals.filter((d) => d.won_at);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.value_cents || 0), 0);
    const activeDeals = deals.filter((d) => !d.won_at && !d.lost_at);

    return {
      totalDeals: deals.length,
      totalValue,
      wonValue,
      activeDeals: activeDeals.length,
    };
  }, [deals]);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const items = [
    { icon: Target, label: "Deals Ativos", value: String(stats.activeDeals), color: "text-primary" },
    { icon: DollarSign, label: "Pipeline Total", value: formatCurrency(stats.totalValue), color: "text-emerald-500" },
    { icon: TrendingUp, label: "Valor Ganho", value: formatCurrency(stats.wonValue), color: "text-green-600" },
    { icon: Clock, label: "Total de Deals", value: String(stats.totalDeals), color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3 flex items-center gap-3">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
