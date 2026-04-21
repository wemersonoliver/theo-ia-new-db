import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CRMStage } from "@/hooks/useCRMStages";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { DealCard } from "./DealCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanColumnProps {
  stage: CRMStage;
  deals: CRMDeal[];
  onAddDeal: (stageId: string) => void;
  onDealClick: (deal: CRMDeal) => void;
}

export function KanbanColumn({ stage, deals, onAddDeal, onDealClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage" } });

  const totalValue = deals.reduce((sum, d) => sum + (d.value_cents || 0), 0);
  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return (
    <div className="flex flex-col flex-1 min-w-0 basis-0">
      {/* Header */}
      <div className="rounded-t-lg px-3 py-2 border border-b-0" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{stage.name}</span>
            <Badge count={deals.length} />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddDeal(stage.id)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(totalValue)}</p>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-lg border border-t-0 bg-muted/30 p-2 transition-colors min-h-[200px]",
          isOver && "bg-primary/5 border-primary/30"
        )}
      >
        <ScrollArea className="h-[calc(100vh-280px)]">
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} onClick={onDealClick} />
              ))}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {count}
    </span>
  );
}
