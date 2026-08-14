import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { useAppointmentTypes } from "@/hooks/useAppointmentTypes";
import { format } from "date-fns";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

export type RecurrenceType = "none" | "weekly" | "biweekly" | "monthly";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultPhone?: string | null;
  defaultContactName?: string | null;
  defaultAssignedTo?: string | null;
  onSubmit: (data: {
    title: string;
    phone: string;
    contact_name?: string | null;
    description?: string | null;
    appointment_date: string;
    appointment_time: string;
    duration_minutes?: number;
    appointment_type_id?: string | null;
    assigned_to?: string | null;
    notes?: string | null;
    recurrence?: RecurrenceType;
    recurrence_end_date?: string | null;
    occurrences?: number | null;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultPhone,
  defaultContactName,
  defaultAssignedTo,
  onSubmit,
  isSubmitting,
}: AppointmentDialogProps) {
  const { appointmentTypes } = useAppointmentTypes();
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [typeId, setTypeId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [endMode, setEndMode] = useState<"count" | "date">("count");
  const [occurrences, setOccurrences] = useState(12);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setPhone(defaultPhone ?? "");
      setContactName(defaultContactName ?? "");
      setDescription("");
      setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
      setTime("09:00");
      setDuration(30);
      setTypeId("none");
      setAssignedTo(defaultAssignedTo ?? null);
      setNotes("");
      setRecurrence("none");
      setEndMode("count");
      setOccurrences(12);
      setRecurrenceEnd("");
    }
  }, [open, defaultDate, defaultPhone, defaultContactName, defaultAssignedTo]);

  const handleTypeChange = (val: string) => {
    setTypeId(val);
    if (val !== "none") {
      const t = appointmentTypes.find((x) => x.id === val);
      if (t) {
        setDuration(t.duration_minutes);
        if (!title) setTitle(t.name);
      }
    }
  };

  const canSubmit = title.trim() && phone.trim() && date && time && !isSubmitting;

  const handleSave = async () => {
    if (!canSubmit) return;
    if (recurrence !== "none" && endMode === "date" && !recurrenceEnd) {
      toast.error("Informe a data final da repetição");
      return;
    }
    await onSubmit({
      title: title.trim(),
      phone: phone.trim(),
      contact_name: contactName.trim() || null,
      description: description.trim() || null,
      appointment_date: date,
      appointment_time: time,
      duration_minutes: duration,
      appointment_type_id: typeId === "none" ? null : typeId,
      assigned_to: assignedTo,
      notes: notes.trim() || null,
      recurrence,
      recurrence_end_date: recurrence !== "none" && endMode === "date" ? recurrenceEnd || null : null,
      occurrences: recurrence !== "none" && endMode === "count" ? occurrences : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Consulta inicial" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Nome do contato</Label>
              <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Cliente" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora *</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="dur">Duração (min)</Label>
              <Input id="dur" type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} />
            </div>
          </div>

          {appointmentTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={typeId} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem serviço</SelectItem>
                  {appointmentTypes.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Responsável</Label>
            <AssigneeSelector value={assignedTo} onChange={setAssignedTo} />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Agendamento fixo (recorrente)
              </Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não se repete</SelectItem>
                  <SelectItem value="weekly">Toda semana</SelectItem>
                  <SelectItem value="biweekly">A cada 2 semanas</SelectItem>
                  <SelectItem value="monthly">Todo mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recurrence !== "none" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Terminar</Label>
                  <Select value={endMode} onValueChange={(v) => setEndMode(v as "count" | "date")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Após X repetições</SelectItem>
                      <SelectItem value="date">Em uma data final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {endMode === "count" ? (
                  <div className="space-y-2">
                    <Label>Repetições</Label>
                    <Input
                      type="number"
                      min={2}
                      max={104}
                      value={occurrences}
                      onChange={(e) => setOccurrences(Math.max(2, Math.min(104, Number(e.target.value) || 2)))}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Data final</Label>
                    <Input type="date" min={date} value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do agendamento" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visível apenas para a equipe" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
