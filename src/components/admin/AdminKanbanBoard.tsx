import { useState, useMemo } from "react";
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AdminCRMStage } from "@/hooks/useAdminCRMStages";
import { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import { AdminKanbanColumn } from "./AdminKanbanColumn";
import { AdminDealCard } from "./AdminDealCard";
import { AdminDealDialog } from "./AdminDealDialog";

interface AdminKanbanBoardProps {
  stages: AdminCRMStage[];
  deals: AdminCRMDeal[];
  onCreateDeal: (deal: any) => Promise<any>;
  onUpdateDeal: (id: string, updates: any) => void;
  onMoveDeal: (dealId: string, newStageId: string, newPosition: number) => void;
  onDeleteDeal: (id: string) => void;
}

export function AdminKanbanBoard({ stages, deals, onCreateDeal, onUpdateDeal, onMoveDeal, onDeleteDeal }: AdminKanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<AdminCRMDeal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<AdminCRMDeal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dealsByStage = useMemo(() => {
    const map: Record<string, AdminCRMDeal[]> = {};
    stages.forEach(s => (map[s.id] = []));
    deals.forEach(d => { if (map[d.stage_id]) map[d.stage_id].push(d); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [stages, deals]);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find(d => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const draggedDeal = deals.find(d => d.id === active.id);
    if (!draggedDeal) return;
    let targetStageId: string;
    const overDeal = deals.find(d => d.id === over.id);
    if (overDeal) {
      targetStageId = overDeal.stage_id;
    } else {
      targetStageId = over.id as string;
    }
    const stageDeals = dealsByStage[targetStageId] || [];
    const newPosition = overDeal ? stageDeals.findIndex(d => d.id === overDeal.id) : stageDeals.length;
    onMoveDeal(draggedDeal.id, targetStageId, newPosition >= 0 ? newPosition : 0);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 px-1">
          {stages.map(stage => (
            <AdminKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddDeal={(stageId) => { setSelectedDeal(null); setDefaultStageId(stageId); setDialogOpen(true); }}
              onDealClick={(deal) => { setSelectedDeal(deal); setDefaultStageId(deal.stage_id); setDialogOpen(true); }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal && <AdminDealCard deal={activeDeal} onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      <AdminDealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages}
        deal={selectedDeal}
        defaultStageId={defaultStageId}
        onSave={(data) => {
          if (selectedDeal) onUpdateDeal(selectedDeal.id, data);
          else onCreateDeal(data);
        }}
        onDelete={onDeleteDeal}
      />
    </>
  );
}
