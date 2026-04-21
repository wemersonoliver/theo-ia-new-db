import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCRMActivities } from "@/hooks/useCRMActivities";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  StickyNote,
  ArrowRightLeft,
  PlusCircle,
  Trophy,
  XCircle,
  CalendarPlus,
  UserPlus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DealActivityTimelineProps {
  dealId: string;
}

const typeMeta: Record<string, { icon: any; label: string; color: string }> = {
  note: { icon: StickyNote, label: "Anotação", color: "text-foreground" },
  stage_change: { icon: ArrowRightLeft, label: "Movido", color: "text-blue-600 dark:text-blue-400" },
  created: { icon: PlusCircle, label: "Criado", color: "text-emerald-600 dark:text-emerald-400" },
  won: { icon: Trophy, label: "Ganho", color: "text-emerald-600 dark:text-emerald-400" },
  lost: { icon: XCircle, label: "Perdido", color: "text-destructive" },
  appointment_created: { icon: CalendarPlus, label: "Agendamento", color: "text-violet-600 dark:text-violet-400" },
  assigned: { icon: UserPlus, label: "Atribuído", color: "text-amber-600 dark:text-amber-400" },
};

export function DealActivityTimeline({ dealId }: DealActivityTimelineProps) {
  const { activities, isLoading, addNote } = useCRMActivities(dealId);
  const [note, setNote] = useState("");

  const handleSave = () => {
    if (!note.trim()) return;
    addNote.mutate(note.trim(), {
      onSuccess: () => setNote(""),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-2 space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma anotação... (Ctrl+Enter para salvar)"
          rows={2}
          className="resize-none bg-background text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!note.trim() || addNote.isPending}
          >
            {addNote.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Salvar anotação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhuma atividade ainda. Adicione a primeira anotação!
        </p>
      ) : (
        <ol className="space-y-2.5 relative pl-5 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border">
          {activities.map((a) => {
            const meta = typeMeta[a.type] || typeMeta.note;
            const Icon = meta.icon;
            return (
              <li key={a.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background border",
                    meta.color
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    {a.type === "note" ? a.author_name || "Você" : "Sistema"}
                  </span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-0.5 break-words">{a.content}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}