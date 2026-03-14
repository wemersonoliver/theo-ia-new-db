import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GripVertical, Calendar, DollarSign, User } from "lucide-react";

interface DealCardProps {
  deal: CRMDeal;
  onClick: (deal: CRMDeal) => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function DealCard({ deal, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
      onClick={() => onClick(deal)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
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
