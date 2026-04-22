import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, DollarSign, User, Pencil, ListTodo, AlertTriangle } from "lucide-react";
import type { DealTaskCounts } from "@/hooks/useCRMDealTasks";

interface DealCardProps {
  deal: CRMDeal;
  onClick: (deal: CRMDeal) => void;
  taskCounts?: DealTaskCounts;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function DealCard({ deal, onClick, taskCounts }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  let pointerDown: { x: number; y: number } | null = null;
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDown = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDown) return;
    const dx = Math.abs(e.clientX - pointerDown.x);
    const dy = Math.abs(e.clientY - pointerDown.y);
    pointerDown = null;
    if (dx < 5 && dy < 5) {
      onClick(deal);
    }
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDownCapture={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick(deal);
        }}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground"
        aria-label="Editar deal"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-medium text-sm truncate">{deal.title}</p>

          {(deal.contact_name || deal.contact_phone) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{deal.contact_name || deal.contact_phone}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {deal.value_cents != null && deal.value_cents > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(deal.value_cents)}
              </span>
            )}
            {deal.expected_close_date && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityColors[deal.priority] || priorityColors.medium)}>
              {deal.priority === "high" ? "Alta" : deal.priority === "low" ? "Baixa" : "Média"}
            </Badge>
            {taskCounts && taskCounts.total > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-medium",
                  taskCounts.overdue > 0
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : taskCounts.dueToday > 0
                    ? "border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    : "border-border bg-muted text-muted-foreground"
                )}
                title={
                  taskCounts.overdue > 0
                    ? `${taskCounts.overdue} tarefa(s) vencida(s)`
                    : taskCounts.dueToday > 0
                    ? `${taskCounts.dueToday} tarefa(s) para hoje`
                    : `${taskCounts.completed}/${taskCounts.total} tarefas concluídas`
                }
              >
                {taskCounts.overdue > 0 ? (
                  <AlertTriangle className="h-2.5 w-2.5" />
                ) : (
                  <ListTodo className="h-2.5 w-2.5" />
                )}
                {taskCounts.completed}/{taskCounts.total}
              </span>
            )}
            {daysInStage > 0 && (
              <span className={cn("text-[10px]", daysInStage > 7 ? "text-destructive" : "text-muted-foreground")}>
                {daysInStage}d
              </span>
            )}
            {deal.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
