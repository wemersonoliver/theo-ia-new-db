import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  MessageSquare,
  Calendar,
  Bot,
  Smartphone,
  TrendingUp,
  TrendingDown,
  DollarSign,
  UserPlus,
  Ticket,
  Clock,
  Timer,
  Loader2,
  Trophy,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAdminDashboardMetrics } from "@/hooks/useAdminDashboardMetrics";
import { presetRange, formatDuration } from "@/lib/dashboard-metrics";

type Period = "today" | "7d" | "30d" | "month";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function VarBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-slate-500">—</span>;
  const positive = inverse ? value < 0 : value > 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  const color =
    positive ? "text-emerald-400" : value === 0 ? "text-slate-500" : "text-rose-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%
    </span>
  );
}

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("30d");
  const range = useMemo(() => presetRange(period), [period]);
  const { metrics, loading } = useAdminDashboardMetrics(range);

  const kpis = [
    {
      label: "Usuários totais",
      value: metrics?.current.totalUsers ?? 0,
      sub: metrics ? `+${metrics.current.newUsers} no período` : undefined,
      Icon: Users,
      tone: "bg-blue-500/10 text-blue-400",
      variation: metrics?.variation.newUsers ?? null,
    },
    {
      label: "Assinaturas ativas",
      value: metrics?.current.activeSubscriptions ?? 0,
      sub: metrics ? `MRR ${formatBRL(metrics.current.mrrCents)}` : undefined,
      Icon: DollarSign,
      tone: "bg-emerald-500/10 text-emerald-400",
      variation: null,
    },
    {
      label: "Novos cadastros",
      value: metrics?.current.newUsers ?? 0,
      Icon: UserPlus,
      tone: "bg-violet-500/10 text-violet-400",
      variation: metrics?.variation.newUsers ?? null,
    },
    {
      label: "WhatsApp conectados",
      value: metrics?.current.connectedInstances ?? 0,
      sub: metrics ? `${metrics.current.totalInstances} criados` : undefined,
      Icon: Smartphone,
      tone: "bg-green-500/10 text-green-400",
      variation: null,
    },
    {
      label: "IAs ativas",
      value: metrics?.current.aiConfigs ?? 0,
      Icon: Bot,
      tone: "bg-cyan-500/10 text-cyan-400",
      variation: null,
    },
    {
      label: "Leads (período)",
      value: metrics?.current.leads ?? 0,
      Icon: MessageSquare,
      tone: "bg-sky-500/10 text-sky-400",
      variation: metrics?.variation.leads ?? null,
    },
    {
      label: "Agendamentos",
      value: metrics?.current.appointments ?? 0,
      Icon: Calendar,
      tone: "bg-amber-500/10 text-amber-400",
      variation: metrics?.variation.appointments ?? null,
    },
    {
      label: "Vendas concluídas",
      value: metrics?.current.sales ?? 0,
      sub: metrics ? formatBRL(metrics.current.salesValueCents) : undefined,
      Icon: TrendingUp,
      tone: "bg-emerald-500/10 text-emerald-400",
      variation: metrics?.variation.sales ?? null,
    },
  ];

  return (
    <AdminLayout title="Dashboard" description="Visão geral da plataforma">
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px] bg-slate-900/60 border-slate-700 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
          </SelectContent>
        </Select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((it) => (
          <Card key={it.label} className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${it.tone}`}>
                  <it.Icon className="h-4 w-4" />
                </div>
                <VarBadge value={it.variation} />
              </div>
              <p className="mt-3 text-sm text-slate-400">{it.label}</p>
              <p className="text-2xl font-bold text-white">
                {it.value.toLocaleString("pt-BR")}
              </p>
              {it.sub && <p className="mt-1 text-xs text-slate-500">{it.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tempos médios + Tickets */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Clock className="h-4 w-4" />
              </div>
              <VarBadge value={metrics?.variation.avgFirstResponseSec ?? null} inverse />
            </div>
            <p className="mt-3 text-sm text-slate-400">Tempo médio de 1ª resposta</p>
            <p className="text-2xl font-bold text-white">
              {formatDuration(metrics?.current.avgFirstResponseSec ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Timer className="h-4 w-4" />
              </div>
              <VarBadge value={metrics?.variation.avgServiceTimeSec ?? null} inverse />
            </div>
            <p className="mt-3 text-sm text-slate-400">Tempo médio de atendimento</p>
            <p className="text-2xl font-bold text-white">
              {formatDuration(metrics?.current.avgServiceTimeSec ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400">Tickets abertos</p>
            <p className="text-2xl font-bold text-white">
              {(metrics?.current.openTickets ?? 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Novos cadastros por dia
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.signupsByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tickFormatter={(v) => v.slice(5)}
                  fontSize={11}
                />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Distribuição de planos
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {metrics && metrics.planBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.planBreakdown}
                    dataKey="count"
                    nameKey="plan"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {metrics.planBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      color: "#e2e8f0",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Sem assinaturas ativas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top contas */}
      <Card className="mt-4 border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Trophy className="h-4 w-4 text-amber-400" />
            Top 10 contas no período
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 bg-amber-500/5 hover:bg-amber-500/5">
                <TableHead className="text-amber-400">#</TableHead>
                <TableHead className="text-amber-400">Conta</TableHead>
                <TableHead className="text-amber-400 text-right">Leads</TableHead>
                <TableHead className="text-amber-400 text-right">Atendimentos</TableHead>
                <TableHead className="text-amber-400 text-right">Agendamentos</TableHead>
                <TableHead className="text-amber-400 text-right">Vendas</TableHead>
                <TableHead className="text-amber-400 text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(metrics?.topAccounts || []).length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              ) : (
                metrics!.topAccounts.map((row, idx) => (
                  <TableRow key={row.account_id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-slate-400 font-mono">{idx + 1}</TableCell>
                    <TableCell className="text-slate-200 font-medium">{row.account_name}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.leads}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.services}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.appointments}</TableCell>
                    <TableCell className="text-right text-slate-300 tabular-nums">{row.sales}</TableCell>
                    <TableCell className="text-right text-emerald-400 tabular-nums font-medium">
                      {formatBRL(row.salesValueCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
