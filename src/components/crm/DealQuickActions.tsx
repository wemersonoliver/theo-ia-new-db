import { Button } from "@/components/ui/button";
import { MessageCircle, CalendarPlus, Trophy, XCircle } from "lucide-react";

interface DealQuickActionsProps {
  hasPhone: boolean;
  isWon: boolean;
  isLost: boolean;
  onWhatsApp: () => void;
  onSchedule: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}

export function DealQuickActions({
  hasPhone,
  isWon,
  isLost,
  onWhatsApp,
  onSchedule,
  onMarkWon,
  onMarkLost,
}: DealQuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        size="sm"
        variant="default"
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={onWhatsApp}
        disabled={!hasPhone}
        title={!hasPhone ? "Vincule um contato com telefone para conversar" : undefined}
      >
        <MessageCircle className="h-4 w-4 mr-1.5" />
        WhatsApp
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onSchedule}
        disabled={!hasPhone}
      >
        <CalendarPlus className="h-4 w-4 mr-1.5" />
        Agendar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        onClick={onMarkWon}
        disabled={isWon}
      >
        <Trophy className="h-4 w-4 mr-1.5" />
        {isWon ? "Ganho" : "Marcar Ganho"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={onMarkLost}
        disabled={isLost}
      >
        <XCircle className="h-4 w-4 mr-1.5" />
        {isLost ? "Perdido" : "Marcar Perdido"}
      </Button>
    </div>
  );
}