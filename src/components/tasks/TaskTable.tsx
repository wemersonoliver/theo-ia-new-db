import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, ExternalLink } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export interface TableTask {
  id: string;
  deal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  user_id: string;
  assigned_to: string | null;
  deal_title?: string | null;
  assignee_name?: string | null;
  owner_name?: string | null;
  account_name?: string | null;
}

interface Props {
  tasks: TableTask[];
  onToggle?: (task: TableTask) => void;
  onEdit?: (task: TableTask) => void;
  onDelete?: (task: TableTask) => void;
  showAccount?: boolean;
  dark?: boolean;
  readOnly?: boolean;
}

function dueBadge(task: TableTask, dark?: boolean) {
  if (task.completed) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
        Concluída
      </Badge>
    );
  }
  if (!task.due_date) {
    return (
      <Badge variant="outline" className={dark ? "border-slate-700 text-slate-400" : ""}>
        Sem prazo
      </Badge>
    );
  }
  const d = new Date(task.due_date);
  if (isPast(d) && !isToday(d)) {
    return <Badge className="bg-red-500/15 text-red-500 border border-red-500/30">Atrasada</Badge>;
  }
  if (isToday(d)) {
    return <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30">Hoje</Badge>;
  }
  return (
    <Badge variant="outline" className={dark ? "border-slate-700 text-slate-300" : ""}>
      {format(d, "dd/MM", { locale: ptBR })}
    </Badge>
  );
}

export function TaskTable({ tasks, onToggle, onEdit, onDelete, showAccount, dark, readOnly }: Props) {
  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border p-10 text-center text-sm",
          dark
            ? "border-slate-800 bg-slate-900/40 text-slate-400"
            : "bg-muted/40 text-muted-foreground"
        )}
      >
        Nenhuma tarefa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        dark ? "border-slate-800 bg-slate-900/40" : "bg-card"
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            className={cn(
              "text-left",
              dark
                ? "bg-slate-900 text-amber-400/70 [&_th]:font-semibold [&_th]:uppercase [&_th]:text-xs [&_th]:tracking-wider"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <tr>
              <th className="px-3 py-3 w-10"></th>
              <th className="px-3 py-3">Título</th>
              <th className="px-3 py-3 hidden md:table-cell">Negócio</th>
              {showAccount && <th className="px-3 py-3 hidden lg:table-cell">Conta</th>}
              <th className="px-3 py-3 hidden md:table-cell">Responsável</th>
              <th className="px-3 py-3">Prazo</th>
              <th className="px-3 py-3 hidden lg:table-cell">Concluída em</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr
                key={t.id}
                className={cn(
                  "border-t transition-colors",
                  dark ? "border-slate-800 hover:bg-slate-900/60" : "hover:bg-muted/30",
                  t.completed && "opacity-60"
                )}
              >
                <td className="px-3 py-3">
                  <Checkbox
                    checked={t.completed}
                    disabled={readOnly}
                    onCheckedChange={() => onToggle?.(t)}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className={cn("font-medium", t.completed && "line-through")}>{t.title}</div>
                  {t.description && (
                    <div
                      className={cn(
                        "text-xs line-clamp-1 mt-0.5",
                        dark ? "text-slate-500" : "text-muted-foreground"
                      )}
                    >
                      {t.description}
                    </div>
                  )}
                </td>
                <td className={cn("px-3 py-3 hidden md:table-cell", dark ? "text-slate-300" : "")}>
                  {t.deal_title ? (
                    <Link
                      to="/crm"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {t.deal_title}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className={dark ? "text-slate-500" : "text-muted-foreground"}>—</span>
                  )}
                </td>
                {showAccount && (
                  <td className={cn("px-3 py-3 hidden lg:table-cell", dark ? "text-slate-400" : "text-muted-foreground")}>
                    {t.account_name ?? "—"}
                  </td>
                )}
                <td className={cn("px-3 py-3 hidden md:table-cell", dark ? "text-slate-300" : "")}>
                  {t.assignee_name ?? t.owner_name ?? (
                    <span className={dark ? "text-slate-500" : "text-muted-foreground"}>Não atribuída</span>
                  )}
                </td>
                <td className="px-3 py-3">{dueBadge(t, dark)}</td>
                <td className={cn("px-3 py-3 hidden lg:table-cell text-xs", dark ? "text-slate-400" : "text-muted-foreground")}>
                  {t.completed_at ? format(new Date(t.completed_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                </td>
                <td className="px-3 py-3">
                  {!readOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(t)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => onDelete(t)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}