import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CRMPipeline } from "@/hooks/useCRMPipelines";
import { CRMStage } from "@/hooks/useCRMStages";
import { Pencil, Trash2, Plus, GripVertical, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PipelineSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: CRMPipeline | null;
  stages: CRMStage[];
  onRenamePipeline: (id: string, name: string) => void;
  onDeletePipeline: (id: string) => void;
  onAddStage: (name: string, color: string) => void;
  onUpdateStage: (id: string, updates: Partial<Pick<CRMStage, "name" | "color" | "position">>) => void;
  onDeleteStage: (id: string) => void;
}

export function PipelineSettingsDialog({
  open,
  onOpenChange,
  pipeline,
  stages,
  onRenamePipeline,
  onDeletePipeline,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
}: PipelineSettingsDialogProps) {
  const [pipelineName, setPipelineName] = useState("");
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [showAddStage, setShowAddStage] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

  if (!pipeline) return null;

  const handleRenamePipeline = () => {
    if (pipelineName.trim()) {
      onRenamePipeline(pipeline.id, pipelineName.trim());
      setEditingPipeline(false);
    }
  };

  const startEditStage = (stage: CRMStage) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageColor(stage.color);
  };

  const saveStageEdit = () => {
    if (editingStageId && editStageName.trim()) {
      onUpdateStage(editingStageId, { name: editStageName.trim(), color: editStageColor });
      setEditingStageId(null);
    }
  };

  const handleAddStage = () => {
    if (newStageName.trim()) {
      onAddStage(newStageName.trim(), newStageColor);
      setNewStageName("");
      setNewStageColor("#6366f1");
      setShowAddStage(false);
    }
  };

  const confirmDeleteStage = (id: string) => {
    setDeleteStageId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteStage = () => {
    if (deleteStageId) {
      onDeleteStage(deleteStageId);
      setDeleteStageId(null);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações do Funil</DialogTitle>
          </DialogHeader>

          {/* Pipeline Name */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome do Funil</Label>
            {editingPipeline ? (
              <div className="flex items-center gap-2">
                <Input
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenamePipeline()}
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={handleRenamePipeline}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingPipeline(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{pipeline.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPipelineName(pipeline.name);
                    setEditingPipeline(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Renomear
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Stages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Etapas do Funil</Label>
              <Button size="sm" variant="outline" onClick={() => setShowAddStage(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova Etapa
              </Button>
            </div>

            <div className="space-y-2">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div
                    className="h-4 w-4 rounded-full shrink-0 border"
                    style={{ backgroundColor: editingStageId === stage.id ? editStageColor : stage.color }}
                  />
                  {editingStageId === stage.id ? (
                    <>
                      <Input
                        value={editStageName}
                        onChange={(e) => setEditStageName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && saveStageEdit()}
                      />
                      <input
                        type="color"
                        value={editStageColor}
                        onChange={(e) => setEditStageColor(e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer shrink-0"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveStageEdit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingStageId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{stage.name}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => startEditStage(stage)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => confirmDeleteStage(stage.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {showAddStage && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed p-2">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: newStageColor }} />
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Nome da etapa"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
                />
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer shrink-0"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleAddStage} disabled={!newStageName.trim()}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowAddStage(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Delete Pipeline */}
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                onDeletePipeline(pipeline.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Funil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as negociações nesta etapa serão perdidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
