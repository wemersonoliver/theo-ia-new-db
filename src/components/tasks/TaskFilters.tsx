import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export type StatusFilter = "all" | "pending" | "completed" | "overdue" | "today" | "next7";

interface AssigneeOption {
  id: string;
  name: string;
}

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  assignee: string;
  onAssignee: (v: string) => void;
  assignees: AssigneeOption[];
  dark?: boolean;
}

export function TaskFilters({
  search,
  onSearch,
  status,
  onStatus,
  assignee,
  onAssignee,
  assignees,
  dark,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por título..."
          className={dark ? "pl-9 bg-slate-900 border-slate-700 text-slate-200" : "pl-9"}
        />
      </div>
      <Select value={status} onValueChange={(v) => onStatus(v as StatusFilter)}>
        <SelectTrigger className={dark ? "w-[180px] bg-slate-900 border-slate-700 text-slate-200" : "w-[180px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="overdue">Atrasadas</SelectItem>
          <SelectItem value="today">Para hoje</SelectItem>
          <SelectItem value="next7">Próximos 7 dias</SelectItem>
          <SelectItem value="completed">Concluídas</SelectItem>
        </SelectContent>
      </Select>
      {assignees.length > 0 && (
        <Select value={assignee} onValueChange={onAssignee}>
          <SelectTrigger className={dark ? "w-[200px] bg-slate-900 border-slate-700 text-slate-200" : "w-[200px]"}>
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="unassigned">Sem responsável</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function applyFilters<T extends { title: string; completed: boolean; due_date: string | null; assigned_to: string | null; user_id: string }>(
  tasks: T[],
  search: string,
  status: StatusFilter,
  assignee: string
): T[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86_400_000;
  const next7End = todayStart + 7 * 86_400_000;
  const q = search.trim().toLowerCase();

  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;

    if (status === "pending" && t.completed) return false;
    if (status === "completed" && !t.completed) return false;
    if (status === "overdue") {
      if (t.completed) return false;
      if (!t.due_date) return false;
      if (new Date(t.due_date).getTime() >= todayStart) return false;
    }
    if (status === "today") {
      if (!t.due_date) return false;
      const ts = new Date(t.due_date).getTime();
      if (ts < todayStart || ts >= todayEnd) return false;
    }
    if (status === "next7") {
      if (!t.due_date) return false;
      const ts = new Date(t.due_date).getTime();
      if (ts < todayStart || ts >= next7End) return false;
    }

    if (assignee !== "all") {
      if (assignee === "unassigned") {
        if (t.assigned_to) return false;
      } else {
        const owner = t.assigned_to ?? t.user_id;
        if (owner !== assignee) return false;
      }
    }
    return true;
  });
}