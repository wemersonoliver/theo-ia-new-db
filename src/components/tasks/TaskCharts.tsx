import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

interface BaseTask {
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
  assigned_to: string | null;
  user_id: string;
  assignee_name?: string | null;
  owner_name?: string | null;
}

interface Props<T extends BaseTask> {
  tasks: T[];
  dark?: boolean;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#94a3b8"];

function lastNDays(n: number) {
  const out: { date: Date; key: string }[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({
      date: d,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    });
  }
  return out;
}

export function TaskCharts<T extends BaseTask>({ tasks, dark }: Props<T>) {
  // Per-user completed counts (last 30 days)
  const userMap = new Map<string, { name: string; completed: number; total: number }>();
  for (const t of tasks) {
    const key = t.assigned_to ?? t.user_id;
    const name = t.assignee_name ?? t.owner_name ?? "Desconhecido";
    if (!userMap.has(key)) userMap.set(key, { name, completed: 0, total: 0 });
    const u = userMap.get(key)!;
    u.total += 1;
    if (t.completed) u.completed += 1;
  }
  const perUser = Array.from(userMap.values())
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10);

  // Daily concluded over last 30 days
  const days = lastNDays(30);
  const dailyMap: Record<string, { day: string; concluidas: number; criadas: number }> = {};
  for (const d of days) {
    dailyMap[d.key] = {
      day: `${String(d.date.getDate()).padStart(2, "0")}/${String(d.date.getMonth() + 1).padStart(2, "0")}`,
      concluidas: 0,
      criadas: 0,
    };
  }
  for (const t of tasks) {
    if (t.completed_at) {
      const k = t.completed_at.slice(0, 10);
      if (dailyMap[k]) dailyMap[k].concluidas += 1;
    }
    if (t.created_at) {
      const k = t.created_at.slice(0, 10);
      if (dailyMap[k]) dailyMap[k].criadas += 1;
    }
  }
  const daily = Object.values(dailyMap);

  // Status pie
  const now = Date.now();
  let completed = 0,
    overdue = 0,
    pending = 0;
  for (const t of tasks) {
    if (t.completed) completed += 1;
    else if (t.due_date && new Date(t.due_date).getTime() < now) overdue += 1;
    else pending += 1;
  }
  const pieData = [
    { name: "Concluídas", value: completed },
    { name: "Pendentes", value: pending },
    { name: "Atrasadas", value: overdue },
  ].filter((d) => d.value > 0);

  const cardCls = dark ? "bg-slate-900/60 border-slate-800 text-slate-200" : "";
  const titleCls = dark ? "text-amber-400/80" : "";
  const tooltipStyle = dark
    ? { background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }
    : undefined;
  const axisColor = dark ? "#64748b" : "#94a3b8";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className={cn("lg:col-span-2", cardCls)}>
        <CardHeader>
          <CardTitle className={cn("text-base", titleCls)}>
            Tarefas concluídas vs criadas (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid stroke={dark ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke={axisColor} fontSize={11} />
              <YAxis stroke={axisColor} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="criadas" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="concluidas" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle className={cn("text-base", titleCls)}>Distribuição</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {pieData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cn("lg:col-span-3", cardCls)}>
        <CardHeader>
          <CardTitle className={cn("text-base", titleCls)}>Top usuários por conclusão</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {perUser.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perUser} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke={dark ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
                <XAxis type="number" stroke={axisColor} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={axisColor} fontSize={11} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" name="Concluídas" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}