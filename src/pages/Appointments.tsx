import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppointments, Appointment } from "@/hooks/useAppointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  Phone, 
  User, 
  CheckCircle, 
  XCircle, 
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Concluído", variant: "outline" },
};

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { appointments, isLoading, updateStatus, deleteAppointment } = useAppointments(selectedDate);

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ id, status });
  };

  const getAppointmentDates = () => {
    const dates = new Set<string>();
    appointments.forEach((apt) => {
      dates.add(apt.appointment_date);
    });
    return dates;
  };

  const filteredAppointments = selectedDate
    ? appointments.filter(
        (apt) => apt.appointment_date === format(selectedDate, "yyyy-MM-dd")
      )
    : appointments;

  return (
    <DashboardLayout
      title="Agendamentos"
      description="Visualize e gerencie seus agendamentos"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário
            </CardTitle>
            <CardDescription>
              Selecione uma data para ver os agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md border"
              modifiers={{
                hasAppointment: (date) =>
                  getAppointmentDates().has(format(date, "yyyy-MM-dd")),
              }}
              modifiersStyles={{
                hasAppointment: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? `Agendamentos - ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                : "Todos os Agendamentos"}
            </CardTitle>
            <CardDescription>
              {filteredAppointments.length} agendamento(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Nenhum agendamento para esta data
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onStatusChange={handleStatusChange}
                    onDelete={(id) => deleteAppointment.mutate(id)}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface AppointmentCardProps {
  appointment: Appointment;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  formatTime: (time: string) => string;
}

function AppointmentCard({ appointment, onStatusChange, onDelete, formatTime }: AppointmentCardProps) {
  const status = statusConfig[appointment.status] || statusConfig.scheduled;
  const tags: string[] = appointment.tags || [];

  const tagColors: Record<string, string> = {
    confirmado: "bg-green-100 text-green-800 border-green-200",
    realizado: "bg-blue-100 text-blue-800 border-blue-200",
    "no-show": "bg-red-100 text-red-800 border-red-200",
    reagendado: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  return (
    <div className="flex items-start justify-between rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold">{appointment.title}</h4>
          <Badge variant={status.variant}>{status.label}</Badge>
          {appointment.confirmed_by_client && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
              ✓ Confirmado pelo cliente
            </Badge>
          )}
          {appointment.reminder_sent && (
            <Badge variant="outline" className="text-xs">
              🔔 Lembrete enviado
            </Badge>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tagColors[tag] || "bg-gray-100 text-gray-800 border-gray-200"}`}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTime(appointment.appointment_time)}
            {appointment.duration_minutes && ` (${appointment.duration_minutes}min)`}
          </span>
          
          <span className="flex items-center gap-1">
            <Phone className="h-4 w-4" />
            {appointment.phone}
          </span>
          
          {appointment.contact_name && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {appointment.contact_name}
            </span>
          )}
        </div>

        {appointment.description && (
          <p className="text-sm text-muted-foreground">{appointment.description}</p>
        )}
      </div>

      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {appointment.status !== "confirmed" && (
              <DropdownMenuItem onClick={() => onStatusChange(appointment.id, "confirmed")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar
              </DropdownMenuItem>
            )}
            {appointment.status !== "completed" && (
              <DropdownMenuItem onClick={() => onStatusChange(appointment.id, "completed")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Concluir
              </DropdownMenuItem>
            )}
            {appointment.status !== "cancelled" && (
              <DropdownMenuItem 
                onClick={() => onStatusChange(appointment.id, "cancelled")}
                className="text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onDelete(appointment.id)}
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
