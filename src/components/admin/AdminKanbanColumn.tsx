import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AdminCRMStage } from "@/hooks/useAdminCRMStages";
import { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import { AdminDealCard } from "./AdminDealCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminKanbanColumnProps {
  stage: AdminCRMStage;
  deals: AdminCRMDeal[];
  onAddDeal: (stageId: string) => void;
  onDealClick: (deal: AdminCRMDeal) => void;
}

export function AdminKanbanColumn({ stage, deals, onAddDeal, onDealClick }: AdminKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage" } });

  return (
    <div className="flex flex-col flex-1 min-w-0 basis-0">
      <div className="rounded-t-lg px-3 py-2 border border-b-0 border-slate-700/50" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-200">{stage.name}</span>
            <span className="inline-flex items-center justify-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              {deals.length}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-700" onClick={() => onAddDeal(stage.id)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-lg border border-t-0 border-slate-700/50 bg-slate-900/50 p-2 transition-colors min-h-[200px]",
          isOver && "bg-amber-500/5 border-amber-500/30"
        )}
      >
        <ScrollArea className="h-[calc(100vh-300px)]">
          <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {deals.map(deal => (
                <AdminDealCard key={deal.id} deal={deal} onClick={onDealClick} />
              ))}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
