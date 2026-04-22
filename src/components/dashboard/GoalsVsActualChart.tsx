import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useUserGoals } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

export function GoalsVsActualChart({ metrics }: Props) {
  const goals = useUserGoals();

  const data = [
    { name: "Leads", Meta: goals?.leads_goal ?? 0, Realizado: metrics?.current.leads ?? 0 },
    { name: "Atend.", Meta: goals?.services_goal ?? 0, Realizado: metrics?.current.services ?? 0 },
    { name: "Agend.", Meta: goals?.appointments_goal ?? 0, Realizado: metrics?.current.appointments ?? 0 },
    { name: "Vendas", Meta: goals?.sales_goal ?? 0, Realizado: metrics?.current.sales ?? 0 },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Metas vs realizado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}