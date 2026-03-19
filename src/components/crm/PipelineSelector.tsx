import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { CRMPipeline } from "@/hooks/useCRMPipelines";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface PipelineSelectorProps {
  pipelines: CRMPipeline[];
  activePipelineId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onOpenSettings?: () => void;
}

export function PipelineSelector({ pipelines, activePipelineId, onSelect, onCreate, onOpenSettings }: PipelineSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim());
      setName("");
      setDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={activePipelineId || ""} onValueChange={onSelect}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecione o funil" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setDialogOpen(true)} title="Novo funil">
          <Plus className="h-4 w-4" />
        </Button>
        {onOpenSettings && (
          <Button variant="outline" size="icon" onClick={onOpenSettings} title="Configurações do funil">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Novo Funil</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do funil" />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!name.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
