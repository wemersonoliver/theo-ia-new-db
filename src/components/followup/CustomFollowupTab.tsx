import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Workflow, Pencil, Trash2, Play, Loader2, Users } from "lucide-react";
import { useCustomFollowup, type CustomFlow } from "@/hooks/useCustomFollowup";
import { FlowEditorDialog } from "./FlowEditorDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CustomFollowupTab() {
  const { flowsQuery, createFlow, updateFlow, deleteFlow } = useCustomFollowup();
  const [editing, setEditing] = useState<CustomFlow | null>(null);
  const [open, setOpen] = useState(false);

  const handleCreate = async () => {
    const flow = await createFlow.mutateAsync({});
    setEditing(flow);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Fluxos Personalizados
            </CardTitle>
            <CardDescription>
              Crie sequências próprias com texto, áudio, vídeo, imagem e documento.
              Inicie por inatividade ou disparo manual. A janela padrão é 08:00–19:00 (sem domingos)
              com fila e espaçamento mínimo entre envios.
            </CardDescription>
          </div>
          <Button onClick={handleCreate} disabled={createFlow.isPending}>
            {createFlow.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Novo fluxo
          </Button>
        </CardHeader>
      </Card>

      {flowsQuery.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (flowsQuery.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum fluxo criado ainda. Clique em <strong>Novo fluxo</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flowsQuery.data!.map((flow) => (
            <Card key={flow.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{flow.name}</CardTitle>
                    {flow.description && (
                      <CardDescription className="line-clamp-2">{flow.description}</CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={flow.enabled}
                    onCheckedChange={(v) => updateFlow.mutate({ id: flow.id, enabled: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">
                    {flow.trigger_type === "inactivity" && "Por inatividade"}
                    {flow.trigger_type === "manual" && "Manual"}
                    {flow.trigger_type === "crm_stage" && "Por etapa do CRM"}
                    {flow.trigger_type === "tag" && "Por tag"}
                    {flow.trigger_type === "conversation_outcome" && "Pós-atendimento"}
                  </Badge>
                  <Badge variant="outline">⏱ {flow.throttle_seconds}s entre envios</Badge>
                  <Badge variant="outline">{flow.window_config?.morning_start || "08:00"} – {flow.window_config?.evening_end || "19:00"}</Badge>
                  {flow.window_config?.skip_sundays !== false && <Badge variant="outline">sem domingos</Badge>}
                  {flow.stop_on_reply && <Badge variant="outline">para se responder</Badge>}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(flow); setOpen(true); }}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover fluxo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação remove permanentemente o fluxo, seus passos e inscrições ativas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFlow.mutate(flow.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <FlowEditorDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          flow={editing}
        />
      )}
    </div>
  );
}