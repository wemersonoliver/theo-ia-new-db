import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, ListChecks, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueToday: number;
}

interface Props {
  stats: TaskStats;
  dark?: boolean;
}

export function TaskKPICards({ stats, dark }: Props) {
  const items = [
    { label: "Total", value: stats.total, icon: ListChecks, tone: "text-foreground" },
    { label: "Concluídas", value: stats.completed, icon: CheckCircle2, tone: "text-emerald-500" },
    { label: "Pendentes", value: stats.pending, icon: Clock, tone: "text-blue-500" },
    { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, tone: "text-red-500" },
    { label: "Para hoje", value: stats.dueToday, icon: CalendarDays, tone: "text-amber-500" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
      {items.map((it) => (
        <Card
          key={it.label}
          className={cn(
            dark && "bg-slate-900/60 border-slate-800 text-slate-200"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  dark ? "text-slate-400" : "text-muted-foreground"
                )}
              >
                {it.label}
              </span>
              <it.icon className={cn("h-4 w-4", it.tone)} />
            </div>
            <div className={cn("mt-2 text-2xl font-bold", it.tone)}>{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function computeStats(tasks: { completed: boolean; due_date: string | null }[]): TaskStats {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86_400_000;
  let completed = 0,
    pending = 0,
    overdue = 0,
    dueToday = 0;
  for (const t of tasks) {
    if (t.completed) {
      completed += 1;
      continue;
    }
    pending += 1;
    if (t.due_date) {
      const ts = new Date(t.due_date).getTime();
      if (ts < todayStart) overdue += 1;
      else if (ts >= todayStart && ts < todayEnd) dueToday += 1;
    }
  }
  return { total: tasks.length, completed, pending, overdue, dueToday };
}