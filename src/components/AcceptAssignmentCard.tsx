import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hand, Loader2, Clock } from "lucide-react";
import { PendingAssignment } from "@/hooks/usePendingAssignments";

interface Props {
  pending: PendingAssignment;
  onAccept: () => void;
  isPending: boolean;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "expirado";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function AcceptAssignmentCard({ pending, onAccept, isPending }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = new Date(pending.expires_at).getTime() - now;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/40">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Hand className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="mt-2">Atendimento aguardando aceite</CardTitle>
          <CardDescription>
            {pending.contact_name || pending.phone} foi atribuído a você pela roleta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Ao aceitar, este lead vira sua responsabilidade e passa a contar nas suas métricas no dashboard.
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatRemaining(remaining)}</span>
            <span className="text-muted-foreground">para aceitar</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={onAccept}
            disabled={isPending || remaining <= 0}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hand className="mr-2 h-4 w-4" />}
            Aceitar atendimento
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}