import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { BlockInput } from "@/hooks/useAppointmentBlocks";

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  isSubmitting?: boolean;
  onSubmit: (data: BlockInput) => Promise<void> | void;
}

export function BlockDialog({ open, onOpenChange, defaultDate, isSubmitting, onSubmit }: Props) {
  const [recurrence, setRecurrence] = useState<"none" | "weekly">("none");
  const [reason, setReason] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (open) {
      const d = format(defaultDate ?? new Date(), "yyyy-MM-dd");
      setRecurrence("none");
      setReason("");
      setAllDay(true);
      setStartDate(d);
      setEndDate(d);
      setStartTime("12:00");
      setEndTime("13:00");
      setDays([1, 2, 3, 4, 5]);
    }
  }, [open, defaultDate]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const handleSubmit = async () => {
    if (recurrence === "none") {
      if (!startDate) return toast.error("Informe a data inicial");
      if (endDate && endDate < startDate) return toast.error("Data final anterior à inicial");
    } else if (days.length === 0) {
      return toast.error("Selecione pelo menos um dia da semana");
    }
    if (!allDay && endTime <= startTime) return toast.error("Horário final deve ser maior que o inicial");

    await onSubmit({
      reason: reason.trim() || "Bloqueado",
      all_day: allDay,
      recurrence,
      start_date: recurrence === "none" ? startDate : startDate || null,
      end_date: recurrence === "none" ? endDate || startDate : endDate || null,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      days_of_week: recurrence === "weekly" ? days : [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Bloquear horário
          </DialogTitle>
          <DialogDescription>
            Horários bloqueados ficam indisponíveis para novos agendamentos, inclusive para a IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={recurrence} onValueChange={(v) => setRecurrence(v as "none" | "weekly")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="none">Datas específicas</TabsTrigger>
              <TabsTrigger value="weekly">Toda semana</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input
              placeholder="Ex: Almoço, Férias, Reunião interna..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {recurrence === "none" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>De</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
                  >
                    <Checkbox checked={days.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Dia inteiro</Label>
              <p className="text-xs text-muted-foreground">Bloqueia todos os horários do dia</p>
            </div>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}