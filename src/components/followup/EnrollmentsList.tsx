import { useFlowEnrollments } from "@/hooks/useCustomFollowup";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  completed: "secondary",
  stopped: "outline",
  paused: "outline",
  failed: "destructive",
};

export function EnrollmentsList({ flowId }: { flowId: string }) {
  const { data, isLoading } = useFlowEnrollments(flowId);

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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}