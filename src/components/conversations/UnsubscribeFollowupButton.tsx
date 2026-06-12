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
import { BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnsubscribeFollowup } from "@/hooks/useUnsubscribeFollowup";

interface Props {
  phone: string;
  className?: string;
  fullLabel?: boolean;
}

export function UnsubscribeFollowupButton({ phone, className, fullLabel }: Props) {
  const unsubscribe = useUnsubscribeFollowup();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 shrink-0", className)}
          disabled={unsubscribe.isPending}
          title="Desinscrever este contato de todos os follow-ups automáticos"
        >
          {unsubscribe.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          <span className={fullLabel ? "" : "hidden 2xl:inline"}>
            Desinscrever follow-up
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desinscrever {phone} do follow-up?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as mensagens automáticas pendentes deste contato serão canceladas —
            incluindo fluxos personalizados e o follow-up automático da IA.
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => unsubscribe.mutate({ phone })}
            disabled={unsubscribe.isPending}
          >
            {unsubscribe.isPending ? "Desinscrevendo..." : "Desinscrever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}