import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics?: DashboardMetrics;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function SellerPerformanceTable({ metrics }: Props) {
  const { members } = useTeamMembers();
  const rows = (metrics?.perSeller || [])
    .filter((r) => r.leads + r.services + r.appointments + r.sales + r.won + r.lost + r.abandoned > 0)
    .map((r) => {
      const member = members.find((m) => m.user_id === r.user_id);
      const finalized = r.won + r.lost + r.abandoned;
      const conversion = finalized > 0 ? Math.round((r.won / finalized) * 100) : 0;
      return {
        ...r,
        name:
          r.user_id === "__unassigned__"
            ? "Não atribuído"
            : member?.full_name || member?.email || "Atendente",
        conversion,
      };
    })
    .sort((a, b) => b.won - a.won);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Desempenho por atendente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de atendimento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Atend.</TableHead>
                  <TableHead className="text-right">Agend.</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Desist.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Conv. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.services}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.appointments}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{r.won}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{r.lost}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.abandoned}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(r.salesValueCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.conversion}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}