import { useFlowEnrollments, useStopEnrollment } from "@/hooks/useCustomFollowup";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ban } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  completed: "secondary",
  stopped: "outline",
  paused: "outline",
  failed: "destructive",
};

export function EnrollmentsList({ flowId }: { flowId: string }) {
  const { data, isLoading } = useFlowEnrollments(flowId);
  const stop = useStopEnrollment();

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground p-8 text-center">Nenhum contato inscrito ainda.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Passo</TableHead>
            <TableHead>Próximo envio</TableHead>
            <TableHead>Iniciado em</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.phone}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[e.status] || "outline"}>{e.status}</Badge>
                {e.stop_reason && <span className="text-xs text-muted-foreground ml-2">({e.stop_reason})</span>}
              </TableCell>
              <TableCell>#{e.current_step + 1}</TableCell>
              <TableCell className="text-xs">
                {e.next_scheduled_at ? format(new Date(e.next_scheduled_at), "dd/MM HH:mm") : "—"}
              </TableCell>
              <TableCell className="text-xs">{format(new Date(e.started_at), "dd/MM HH:mm")}</TableCell>
              <TableCell className="text-xs">{e.triggered_by || "—"}</TableCell>
              <TableCell className="text-right">
                {e.status === "active" ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8">
                        <Ban className="h-3.5 w-3.5 mr-1" /> Parar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desinscrever {e.phone}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          As mensagens pendentes deste contato neste fluxo serão canceladas. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => stop.mutate(e.id)}
                          disabled={stop.isPending}
                        >
                          {stop.isPending ? "Parando..." : "Desinscrever"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}