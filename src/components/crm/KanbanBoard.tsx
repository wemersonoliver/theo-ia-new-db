import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CRMStage } from "@/hooks/useCRMStages";
import { CRMDeal } from "@/hooks/useCRMDeals";
import { Product } from "@/hooks/useProducts";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import { DealDialog } from "./DealDialog";

interface KanbanBoardProps {
  stages: CRMStage[];
  deals: CRMDeal[];
  contacts: { id: string; name: string | null; phone: string }[];
  onCreateDeal: (deal: any) => Promise<any>;
  onUpdateDeal: (id: string, updates: any) => void;
  onMoveDeal: (dealId: string, newStageId: string, newPosition: number) => void;
  onDeleteDeal: (id: string) => void;
}

export function KanbanBoard({ stages, deals, contacts, onCreateDeal, onUpdateDeal, onMoveDeal, onDeleteDeal }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<CRMDeal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dealsByStage = useMemo(() => {
    const map: Record<string, CRMDeal[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    deals.forEach((d) => {
      if (map[d.stage_id]) map[d.stage_id].push(d);
    });
    // Sort by position within each stage
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [stages, deals]);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedDeal = deals.find((d) => d.id === active.id);
    if (!draggedDeal) return;

    // Determine target stage
    let targetStageId: string;
    const overDeal = deals.find((d) => d.id === over.id);
    if (overDeal) {
      targetStageId = overDeal.stage_id;
    } else {
      // Dropped on a column
      targetStageId = over.id as string;
    }

    const stageDeals = dealsByStage[targetStageId] || [];
    const newPosition = overDeal
      ? stageDeals.findIndex((d) => d.id === overDeal.id)
      : stageDeals.length;

    onMoveDeal(draggedDeal.id, targetStageId, newPosition >= 0 ? newPosition : 0);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // handled in dragEnd
  };

  const handleAddDeal = (stageId: string) => {
    setSelectedDeal(null);
    setDefaultStageId(stageId);
    setDialogOpen(true);
  };

  const handleDealClick = (deal: CRMDeal) => {
    setSelectedDeal(deal);
    setDefaultStageId(deal.stage_id);
    setDialogOpen(true);
  };

  const handleSave = async (data: any) => {
    if (selectedDeal) {
      onUpdateDeal(selectedDeal.id, data);
    } else {
      await onCreateDeal(data);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 px-1">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddDeal={handleAddDeal}
              onDealClick={handleDealClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal && <DealCard deal={activeDeal} onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages}
        deal={selectedDeal}
        defaultStageId={defaultStageId}
        contacts={contacts}
        onSave={handleSave}
        onDelete={onDeleteDeal}
      />
    </>
  );
}
