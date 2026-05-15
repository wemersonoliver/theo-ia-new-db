import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, Trash2, Pencil, FileText, Mic, Video, Image as ImageIcon, FileType, Clock, Loader2 } from "lucide-react";
import { useFlowSteps, type CustomStep, type StepType } from "@/hooks/useCustomFollowup";
import { StepDialog } from "./StepDialog";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPE_ICON: Record<StepType, JSX.Element> = {
  text: <FileText className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  document: <FileType className="h-4 w-4" />,
  sticker: <ImageIcon className="h-4 w-4" />,
};
const TYPE_LABEL: Record<StepType, string> = {
  text: "Texto", audio: "Áudio (PTT)", video: "Vídeo",
  image: "Imagem", document: "Documento", sticker: "Figurinha",
};

function StepCard({ step, onEdit, onDelete }: { step: CustomStep; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="p-3 flex items-center gap-3">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground p-1 -m-1">
          <GripVertical className="h-4 w-4" />
        </button>
        <Badge variant="secondary" className="font-mono">#{step.position + 1}</Badge>
        <div className="flex items-center gap-2 text-sm font-medium">
          {TYPE_ICON[step.type]} {TYPE_LABEL[step.type]}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {step.position === 0
            ? `+${step.delay_value} ${step.delay_unit} após início`
            : `+${step.delay_value} ${step.delay_unit} após anterior`}
        </div>
        <div className="flex-1 truncate text-sm text-muted-foreground">
          {step.content || step.caption || step.media_filename || "(sem conteúdo)"}
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function StepsEditor({ flowId, accountId }: { flowId: string; accountId: string }) {
  const { stepsQuery, createStep, updateStep, deleteStep, reorderSteps } = useFlowSteps(flowId);
  const [editing, setEditing] = useState<CustomStep | null>(null);
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = stepsQuery.data || [];
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((s) => s.id);
    reorderSteps.mutate(reordered);
  };

  const handleNew = async () => {
    const created = await createStep.mutateAsync({ type: "text", content: "" });
    setEditing(created); setOpen(true);
  };

  if (stepsQuery.isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Arraste para reordenar. Cada mensagem é enviada após o tempo configurado relativo à anterior.
        </p>
        <Button onClick={handleNew} disabled={createStep.isPending}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar mensagem
        </Button>
      </div>

      {(stepsQuery.data?.length ?? 0) === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhuma mensagem ainda. Clique em <strong>Adicionar mensagem</strong>.
        </CardContent></Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={(stepsQuery.data || []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stepsQuery.data!.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  onEdit={() => { setEditing(step); setOpen(true); }}
                  onDelete={() => { if (confirm("Remover esta mensagem?")) deleteStep.mutate(step.id); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <StepDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          step={editing}
          accountId={accountId}
          onSave={(patch) => updateStep.mutateAsync({ id: editing.id, ...patch })}
        />
      )}
    </div>
  );
}