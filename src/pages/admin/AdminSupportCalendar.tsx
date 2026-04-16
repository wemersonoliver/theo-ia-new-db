import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupportAppointmentTypes, type SupportAppointmentType } from "@/hooks/useSupportAppointmentTypes";
import { useSupportAppointments } from "@/hooks/useSupportAppointments";
import { Calendar, Plus, Trash2, Save, Loader2, CheckCircle, XCircle } from "lucide-react";

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

function TypeForm({ initial, onSave, onCancel }: { initial?: Partial<SupportAppointmentType>; onSave: (v: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [duration, setDuration] = useState(initial?.duration_minutes || 30);
  const [days, setDays] = useState<number[]>(initial?.days_of_week || [1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState((initial?.start_time || "09:00").slice(0, 5));
  const [endTime, setEndTime] = useState((initial?.end_time || "18:00").slice(0, 5));
  const [maxPerSlot, setMaxPerSlot] = useState(initial?.max_appointments_per_slot || 1);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  return (
    <div className="space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-slate-200 text-xs">Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-200 text-xs">Duração (min)</Label>
          <Input type="number" min={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-200" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-slate-200 text-xs">Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-slate-800 border-slate-700 text-slate-200" />
      </div>
      <div className="space-y-1">
        <Label className="text-slate-200 text-xs">Dias da semana</Label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1 cursor-pointer">
              <Checkbox checked={days.includes(d.value)} onCheckedChange={(c) => {
                setDays((prev) => c ? [...prev, d.value].sort() : prev.filter((x) => x !== d.value));
              }} />
              <span className="text-xs text-slate-300">{d.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-slate-200 text-xs">Início</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-200 text-xs">Fim</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-200 text-xs">Máx por horário</Label>
          <Input type="number" min={1} value={maxPerSlot} onChange={(e) => setMaxPerSlot(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-200" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label className="text-slate-200 text-xs">Ativo</Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-300">Cancelar</Button>
        <Button size="sm" onClick={() => onSave({
          ...(initial?.id ? { id: initial.id } : {}),
          name, description, duration_minutes: duration, days_of_week: days,
          start_time: startTime, end_time: endTime, max_appointments_per_slot: maxPerSlot, is_active: isActive,
        })} className="bg-amber-500 hover:bg-amber-600 text-black gap-1"><Save className="h-3 w-3" /> Salvar</Button>
      </div>
    </div>
  );
}

export default function AdminSupportCalendar() {
  const { types, isLoading: typesLoading, upsert, remove } = useSupportAppointmentTypes();
  const { appointments, isLoading: apptsLoading, updateStatus, remove: removeAppt } = useSupportAppointments();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = filterStatus === "all" ? appointments : appointments.filter((a) => a.status === filterStatus);

  return (
    <AdminLayout title="Agenda de Suporte" description="Configure tipos de reunião e veja os agendamentos do time">
      <div className="max-w-5xl">
        <Tabs defaultValue="types" className="space-y-4">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="types" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">Tipos de reunião</TabsTrigger>
            <TabsTrigger value="appts" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">Agendamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><Calendar className="h-5 w-5 text-amber-400" /> Tipos de Reunião</CardTitle>
                {!creating && <Button size="sm" onClick={() => setCreating(true)} className="bg-amber-500 hover:bg-amber-600 text-black gap-1"><Plus className="h-3 w-3" /> Novo</Button>}
              </CardHeader>
              <CardContent className="space-y-3">
                {creating && (
                  <TypeForm onSave={(v) => upsert.mutate(v, { onSuccess: () => setCreating(false) })} onCancel={() => setCreating(false)} />
                )}
                {typesLoading ? (
                  <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-400" /></div>
                ) : types.length === 0 && !creating ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhum tipo cadastrado.</p>
                ) : (
                  types.map((t) => editingId === t.id ? (
                    <TypeForm key={t.id} initial={t} onSave={(v) => upsert.mutate(v, { onSuccess: () => setEditingId(null) })} onCancel={() => setEditingId(null)} />
                  ) : (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-200">{t.name}</p>
                          <Badge className={t.is_active ? "bg-emerald-900/40 text-emerald-300" : "bg-slate-700 text-slate-400"}>{t.is_active ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {t.duration_minutes}min · {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)} · {t.days_of_week.map((d) => DAYS[d]?.label).join(",")}
                        </p>
                        {t.description && <p className="text-xs text-slate-400 mt-1">{t.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(t.id)} className="text-slate-300 hover:bg-slate-800">Editar</Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${t.name}"?`)) remove.mutate(t.id); }} className="text-red-400 hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appts" className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><Calendar className="h-5 w-5 text-amber-400" /> Agendamentos</CardTitle>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Agendados</SelectItem>
                    <SelectItem value="confirmed">Confirmados</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {apptsLoading ? (
                  <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-400" /></div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Nenhum agendamento.</p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200">{a.contact_name || "—"}</p>
                            <Badge className={
                              a.status === "scheduled" ? "bg-amber-900/40 text-amber-300"
                              : a.status === "confirmed" ? "bg-blue-900/40 text-blue-300"
                              : a.status === "completed" ? "bg-emerald-900/40 text-emerald-300"
                              : "bg-red-900/40 text-red-300"
                            }>{a.status}</Badge>
                            {a.support_appointment_types?.name && <Badge variant="outline" className="border-slate-600 text-slate-400">{a.support_appointment_types.name}</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(a.appointment_date + "T00:00:00").toLocaleDateString("pt-BR")} às {a.appointment_time.slice(0, 5)} · {a.duration_minutes}min · {a.phone}
                          </p>
                          {a.notes && <p className="text-xs text-slate-400 mt-1">{a.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                          {a.status !== "completed" && <Button size="icon" variant="ghost" onClick={() => updateStatus.mutate({ id: a.id, status: "completed" })} className="text-emerald-400 hover:bg-emerald-950/30" title="Concluir"><CheckCircle className="h-4 w-4" /></Button>}
                          {a.status !== "cancelled" && <Button size="icon" variant="ghost" onClick={() => updateStatus.mutate({ id: a.id, status: "cancelled" })} className="text-amber-400 hover:bg-amber-950/30" title="Cancelar"><XCircle className="h-4 w-4" /></Button>}
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este agendamento?")) removeAppt.mutate(a.id); }} className="text-red-400 hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
