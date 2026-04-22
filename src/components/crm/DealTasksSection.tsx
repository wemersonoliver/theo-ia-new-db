import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { useCRMDealTasks, type CRMDealTask } from "@/hooks/useCRMDealTasks";
import { format, isToday, isPast, isTomorrow, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Trash2,
  Loader2,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DealTasksSectionProps {
  dealId: string;
}

function classifyTask(task: CRMDealTask) {
  if (task.completed) return { kind: "done" as const, weight: 4 };
  if (!task.due_date) return { kind: "noDate" as const, weight: 3 };
  const date = new Date(task.due_date);
  if (isPast(date) && !isToday(date)) return { kind: "overdue" as const, weight: 0 };
  if (isToday(date)) return { kind: "today" as const, weight: 1 };
  return { kind: "future" as const, weight: 2 };
}

export function DealTasksSection({ dealId }: DealTasksSectionProps) {
  const { tasks, isLoading, createTask, toggleTask, updateTask, deleteTask } = useCRMDealTasks(dealId);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ka = classifyTask(a);
      const kb = classifyTask(b);
      if (ka.weight !== kb.weight) return ka.weight - kb.weight;
      const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }, [tasks]);

  const pending = sorted.filter((t) => !t.completed);
  const completed = sorted.filter((t) => t.completed);

  const handleCreate = () => {
    const t = title.trim();
    if (!t) return;
    createTask.mutate(
      {
        title: t,
        due_date: dueDate ? dueDate.toISOString() : null,
        assigned_to: assignee,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDueDate(null);
          setAssignee(null);
        },
      }
    );
  };

  const presetButtons = [
    { label: "Hoje", value: () => startOfDay(new Date()) },
    { label: "Amanhã", value: () => startOfDay(addDays(new Date(), 1)) },
    { label: "Próx. semana", value: () => startOfDay(addDays(new Date(), 7)) },
  ];

  const overdueCount = pending.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <ListTodo className="h-3 w-3" /> Tarefas
        {pending.length > 0 && (
          <span className="text-[10px] font-normal text-muted-foreground">
            ({pending.length} pendente{pending.length > 1 ? "s" : ""}
            {overdueCount > 0 && ` · ${overdueCount} vencida${overdueCount > 1 ? "s" : ""}`})
          </span>
        )}
      </h3>

      {/* Form */}
      <div className="rounded-md border bg-muted/30 p-2 space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Nova tarefa... (Enter para salvar)"
          className="h-9 bg-background text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("h-7 text-xs", dueDate && "border-primary text-primary")}
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {dueDate ? format(dueDate, "dd/MM", { locale: ptBR }) : "Prazo"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 space-y-2" align="start">
              <div className="flex flex-wrap gap-1">
                {presetButtons.map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setDueDate(p.value())}
                  >
                    {p.label}
                  </Button>
                ))}
                {dueDate && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDueDate(null)}>
                    Limpar
                  </Button>
                )}
              </div>
              <CalendarUI
                mode="single"
                selected={dueDate ?? undefined}
                onSelect={(d) => setDueDate(d ?? null)}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="min-w-[140px]">
            <AssigneeSelector value={assignee} onChange={setAssignee} compact />
          </div>

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!title.trim() || createTask.isPending}
            className="ml-auto h-7"
          >
            {createTask.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhuma tarefa. Adicione a primeira para não esquecer um follow-up!
        </p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleTask.mutate(task)}
              onDelete={() => deleteTask.mutate(task.id)}
              onAssigneeChange={(uid) => updateTask.mutate({ id: task.id, updates: { assigned_to: uid } })}
            />
          ))}

          {completed.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompleted((s) => !s)}
              className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground pt-1.5"
            >
              {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <CheckCircle2 className="h-3 w-3" />
              {completed.length} concluída{completed.length > 1 ? "s" : ""}
            </button>
          )}

          {showCompleted &&
            completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask.mutate(task)}
                onDelete={() => deleteTask.mutate(task.id)}
                onAssigneeChange={(uid) => updateTask.mutate({ id: task.id, updates: { assigned_to: uid } })}
              />
            ))}
        </div>
      )}
    </section>
  );
}

interface TaskRowProps {
  task: CRMDealTask;
  onToggle: () => void;
  onDelete: () => void;
  onAssigneeChange: (uid: string | null) => void;
}

function TaskRow({ task, onToggle, onDelete, onAssigneeChange }: TaskRowProps) {
  const klass = classifyTask(task);

  const dateLabel = (() => {
    if (!task.due_date) return null;
    const d = new Date(task.due_date);
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  })();

  const dateColor =
    klass.kind === "overdue"
      ? "text-destructive"
      : klass.kind === "today"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md border bg-background px-2 py-1.5 transition-colors",
        klass.kind === "overdue" && "border-destructive/40 bg-destructive/5",
        klass.kind === "today" && "border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10",
        task.completed && "opacity-60"
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-tight break-words", task.completed && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {dateLabel && (
            <span className={cn("flex items-center gap-1 text-[11px]", dateColor)}>
              {klass.kind === "overdue" ? (
                <AlertTriangle className="h-2.5 w-2.5" />
              ) : (
                <CalendarIcon className="h-2.5 w-2.5" />
              )}
              {dateLabel}
            </span>
          )}
          <div className="min-w-[120px]">
            <AssigneeSelector value={task.assigned_to} onChange={onAssigneeChange} compact />
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
        aria-label="Excluir tarefa"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
