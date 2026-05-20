import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useIgreenDays } from "@/hooks/useIgreenScenarios";
import { DayContentEditor } from "./DayContentEditor";
import { cn } from "@/lib/utils";

export function ScenarioDaysEditor({ scenarioId }: { scenarioId: string }) {
  const { daysQ, addDay, toggleDay, removeDay } = useIgreenDays(scenarioId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (daysQ.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const days = daysQ.data ?? [];

  return (
    <div className="space-y-2">
      {days.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum dia configurado. Adicione o Dia 1 para começar.
        </p>
      )}

      {days.map((d) => {
        const isOpen = expanded === d.id;
        return (
          <div key={d.id} className="rounded-md border bg-background/50">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className={cn("font-medium", !d.enabled && "text-muted-foreground line-through")}>
                  Dia {d.day_number}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <Switch
                  checked={d.enabled}
                  onCheckedChange={(v) => toggleDay.mutate({ id: d.id, enabled: v })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Remover Dia ${d.day_number}?`)) removeDay.mutate(d.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isOpen && (
              <div className="border-t bg-muted/20 p-3">
                <DayContentEditor dayId={d.id} />
              </div>
            )}
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() => addDay.mutate()}
        disabled={addDay.isPending}
      >
        <Plus className="h-4 w-4 mr-1" />
        Adicionar dia
      </Button>
    </div>
  );
}