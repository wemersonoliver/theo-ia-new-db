import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppointmentTypes } from "@/hooks/useAppointmentTypes";
import { Clock, Plus, Trash2, Loader2, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export default function AppointmentSettings() {
  const { appointmentTypes, isLoading, saveType, deleteType, toggleActive } = useAppointmentTypes();

  const emptyForm = {
    name: "", description: "", duration_minutes: 30,
    days_of_week: [1, 2, 3, 4, 5] as number[],
    start_time: "08:00", end_time: "18:00", max_appointments_per_slot: 1,
  };

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do serviço"); return; }
    if (form.days_of_week.length === 0) { toast.error("Selecione pelo menos um dia"); return; }
    saveType.mutate({
      id: editingId || undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.duration_minutes,
      days_of_week: form.days_of_week,
      start_time: form.start_time + (form.start_time.length === 5 ? ":00" : ""),
      end_time: form.end_time + (form.end_time.length === 5 ? ":00" : ""),
      max_appointments_per_slot: form.max_appointments_per_slot,
    });
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (type: typeof appointmentTypes[0]) => {
    setEditingId(type.id);
    setForm({
      name: type.name,
      description: type.description || "",
      duration_minutes: type.duration_minutes,
      days_of_week: type.days_of_week || [1, 2, 3, 4, 5],
      start_time: type.start_time?.slice(0, 5) || "08:00",
      end_time: type.end_time?.slice(0, 5) || "18:00",
      max_appointments_per_slot: type.max_appointments_per_slot || 1,
    });
  };

  const formatTime = (time: string) => time?.slice(0, 5) || "";
  const dayLabels = (days: number[]) => days.map(d => DAYS.find(dd => dd.value === d)?.label?.slice(0, 3)).filter(Boolean).join(", ");

  if (isLoading) {
    return (
      <DashboardLayout title="Configurar Agendamentos" description="Configure seus serviços e horários">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configurar Agendamentos" description="Configure seus serviços, dias e horários de atendimento">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {editingId ? "Editar Serviço" : "Adicionar Serviço"}
            </CardTitle>
            <CardDescription>
              Cada serviço tem seus próprios dias, horários e duração. A IA usará essas informações para agendar corretamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Serviço</Label>
              <Input
                placeholder="Ex: Corte de Cabelo, Consulta, Aula Experimental..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva brevemente o serviço..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Dias Disponíveis</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map(day => (
                  <label key={day.value} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent/50">
                    <Checkbox checked={form.days_of_week.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário Início</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário Fim</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (minutos)</Label>
                <Input type="number" min={5} max={480} step={5} value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="space-y-2">
                <Label>Vagas por Horário</Label>
                <Input type="number" min={1} max={100} value={form.max_appointments_per_slot}
                  onChange={e => setForm({ ...form, max_appointments_per_slot: parseInt(e.target.value) || 1 })} />
                <p className="text-xs text-muted-foreground">
                  Ex: 1 para consultórios, 10+ para aulas em grupo.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={saveType.isPending}>
                {saveType.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? "Salvar Alterações" : "Adicionar Serviço"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Serviços Cadastrados
            </CardTitle>
            <CardDescription>
              Cada serviço com seus dias e horários próprios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appointmentTypes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum serviço cadastrado. Adicione seus serviços para começar a receber agendamentos.
              </p>
            ) : (
              <div className="space-y-3">
                {appointmentTypes.map(type => (
                  <div key={type.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={type.is_active}
                          onCheckedChange={checked => toggleActive.mutate({ id: type.id, isActive: checked })}
                        />
                        <p className={cn("font-medium", !type.is_active && "text-muted-foreground")}>{type.name}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteType.mutate(type.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {type.description && <p className="text-xs text-muted-foreground pl-14 line-clamp-1">{type.description}</p>}
                    <div className="text-sm text-muted-foreground pl-14 space-y-0.5">
                      <p>{type.duration_minutes}min · {type.max_appointments_per_slot === 1 ? "1 vaga" : `${type.max_appointments_per_slot} vagas`}</p>
                      <p>{dayLabels(type.days_of_week || [])} · {formatTime(type.start_time)} - {formatTime(type.end_time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
