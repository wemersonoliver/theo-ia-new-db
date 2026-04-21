import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { getAssigneeColor } from "@/lib/assignee-colors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Phone, User, CheckCircle, XCircle, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Appointment } from "@/hooks/useAppointments";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Concluído", variant: "outline" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: Date | null;
  appointments: Appointment[];
  onCreate: () => void;
  onStatusChange: (id: string, status: string) => void;
  onAssign: (id: string, userId: string | null) => void;
  onDelete: (id: string) => void;
}

export function AppointmentDayDrawer({
  open,
  onOpenChange,
  date,
  appointments,
  onCreate,
  onStatusChange,
  onAssign,
  onDelete,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">
            {date ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Agendamentos"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
          </p>
        </SheetHeader>

        <div className="mt-4">
          <Button onClick={onCreate} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo agendamento neste dia
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {appointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum agendamento neste dia
            </p>
          ) : (
            appointments.map((appt) => {
              const color = getAssigneeColor(appt.assigned_to);
              const status = statusConfig[appt.status] || statusConfig.scheduled;
              return (
                <div
                  key={appt.id}
                  className="rounded-lg border-l-4 border-y border-r p-3 space-y-2 bg-card"
                  style={{ borderLeftColor: color.dot }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm truncate">{appt.title}</h4>
                        <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appt.appointment_time?.slice(0, 5)}
                          {appt.duration_minutes ? ` · ${appt.duration_minutes}min` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {appt.phone}
                        </span>
                        {appt.contact_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appt.contact_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Ações</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {appt.status !== "confirmed" && (
                          <DropdownMenuItem onClick={() => onStatusChange(appt.id, "confirmed")}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Confirmar
                          </DropdownMenuItem>
                        )}
                        {appt.status !== "completed" && (
                          <DropdownMenuItem onClick={() => onStatusChange(appt.id, "completed")}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Concluir
                          </DropdownMenuItem>
                        )}
                        {appt.status !== "cancelled" && (
                          <DropdownMenuItem
                            onClick={() => onStatusChange(appt.id, "cancelled")}
                            className="text-destructive"
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Cancelar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDelete(appt.id)}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {appt.description && (
                    <p className="text-xs text-muted-foreground">{appt.description}</p>
                  )}

                  <div className="pt-1">
                    <AssigneeSelector
                      compact
                      value={appt.assigned_to ?? null}
                      onChange={(userId) => onAssign(appt.id, userId)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}