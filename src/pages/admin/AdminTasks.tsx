import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminTasks, aggregateByUser } from "@/hooks/useAdminTasks";
import { TaskKPICards, computeStats } from "@/components/tasks/TaskKPICards";
import { TaskFilters, applyFilters, StatusFilter } from "@/components/tasks/TaskFilters";
import { TaskTable } from "@/components/tasks/TaskTable";
import { TaskCharts } from "@/components/tasks/TaskCharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminTasks() {
  const { data: tasks = [], isLoading } = useAdminTasks();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.account_id && t.account_name) map.set(t.account_id, t.account_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const usersOpts = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      const id = t.assigned_to ?? t.user_id;
      const name = t.assignee_name ?? t.owner_name ?? "Desconhecido";
      if (!map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const scoped = useMemo(
    () =>
      tasks.filter((t) => {
        if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
        return true;
      }),
    [tasks, accountFilter]
  );

  const filtered = useMemo(
    () => applyFilters(scoped, search, status, userFilter),
    [scoped, search, status, userFilter]
  );

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const performance = useMemo(() => aggregateByUser(filtered).sort((a, b) => b.completed - a.completed), [filtered]);

  // Group filtered tasks by user
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; account: string | null; tasks: typeof filtered }>();
    for (const t of filtered) {
      const key = t.assigned_to ?? t.user_id;
      const name = t.assignee_name ?? t.owner_name ?? "Desconhecido";
      if (!map.has(key)) map.set(key, { name, account: t.account_name, tasks: [] });
      map.get(key)!.tasks.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].tasks.length - a[1].tasks.length);
  }, [filtered]);

  return (
    <AdminLayout title="Tarefas (Global)" description="Visão completa das tarefas de todos os usuários">
      <div className="space-y-4">
        <TaskKPICards stats={stats} dark />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
          <TaskFilters
            search={search}
            onSearch={setSearch}
            status={status}
            onStatus={setStatus}
            assignee={userFilter}
            onAssignee={setUserFilter}
            assignees={usersOpts}
            dark
          />
          {accounts.length > 0 && (
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[220px] bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs defaultValue="charts" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
            <TabsTrigger value="performance">Desempenho por Usuário</TabsTrigger>
            <TabsTrigger value="byUser">Tarefas por Usuário</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="mt-4">
            <TaskCharts tasks={filtered} dark />
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-amber-400/80">Ranking de Performance</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-amber-400/70">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Usuário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Conta</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Concluídas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Pendentes</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Atrasadas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Taxa</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((p, i) => (
                      <tr key={p.user_id} className="border-t border-slate-800 hover:bg-slate-900/60">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-200">{p.name}</div>
                          {p.email && <div className="text-xs text-slate-500">{p.email}</div>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-400">{p.account_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{p.total}</td>
                        <td className="px-4 py-3 text-right text-emerald-500 font-medium">{p.completed}</td>
                        <td className="px-4 py-3 text-right text-blue-400">{p.pending}</td>
                        <td className="px-4 py-3 text-right text-red-400">{p.overdue}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            className={
                              p.completionRate >= 70
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : p.completionRate >= 40
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  : "bg-red-500/15 text-red-400 border border-red-500/30"
                            }
                          >
                            {p.completionRate}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-400">
                          {p.avgCompletionHours != null ? `${p.avgCompletionHours}h` : "—"}
                        </td>
                      </tr>
                    ))}
                    {performance.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Sem dados de performance.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="byUser" className="mt-4">
            <Accordion type="multiple" className="space-y-2">
              {grouped.map(([userId, info]) => (
                <AccordionItem
                  key={userId}
                  value={userId}
                  className="border border-slate-800 rounded-lg bg-slate-900/40 px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-medium text-slate-200">{info.name}</span>
                      {info.account && (
                        <span className="text-xs text-slate-500">({info.account})</span>
                      )}
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {info.tasks.length} tarefa{info.tasks.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TaskTable tasks={info.tasks} dark readOnly showAccount />
                  </AccordionContent>
                </AccordionItem>
              ))}
              {grouped.length === 0 && !isLoading && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
                  Nenhuma tarefa encontrada.
                </div>
              )}
            </Accordion>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <TaskTable tasks={filtered} dark readOnly showAccount />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}