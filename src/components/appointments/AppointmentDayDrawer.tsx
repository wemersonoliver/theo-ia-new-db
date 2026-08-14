import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import { getAssigneeColor } from "@/lib/assignee-colors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Phone, User, CheckCircle, XCircle, Plus, Bot, UserCog, Cog, Ban, Trash2, Repeat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const recurrenceLabel: Record<string, string> = {
  weekly: "Toda semana",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

import type { Appointment } from "@/hooks/useAppointments";
import type { AppointmentBlock } from "@/hooks/useAppointmentBlocks";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Concluído", variant: "outline" },
};

function OriginBadge({ via }: { via?: string | null }) {
  if (via === "ai") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-purple-400/40 text-purple-500">
        <Bot className="h-3 w-3" /> IA
      </Badge>
    );
  }
  if (via === "system") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <Cog className="h-3 w-3" /> Sistema
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <UserCog className="h-3 w-3" /> Manual
    </Badge>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: Date | null;
  appointments: Appointment[];
  blocks?: AppointmentBlock[];
  onCreate: () => void;
  onCreateBlock?: () => void;
  onDeleteBlock?: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onAssign: (id: string, userId: string | null) => void;
  onDelete: (id: string) => void;
  onSeriesStatusChange?: (id: string, status: string) => void;
  onDeleteSeries?: (id: string) => void;
}

export function AppointmentDayDrawer({
  open,
  onOpenChange,
  date,
  appointments,
  blocks = [],
  onCreate,
  onCreateBlock,
  onDeleteBlock,
  onStatusChange,
  onAssign,
  onDelete,
  onSeriesStatusChange,
  onDeleteSeries,
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

        <div className="mt-4 flex gap-2">
          <Button onClick={onCreate} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo agendamento
          </Button>
          {onCreateBlock && (
            <Button onClick={onCreateBlock} variant="outline" className="w-full" size="sm">
              <Ban className="h-4 w-4 mr-2" />
              Bloquear horário
            </Button>
          )}
        </div>

        {blocks.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bloqueios</p>
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.all_day ? "Dia inteiro" : `${b.start_time?.slice(0, 5)} – ${b.end_time?.slice(0, 5)}`}
                    {b.recurrence === "weekly" ? " · toda semana" : ""}
                  </p>
                </div>
                {onDeleteBlock && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteBlock(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

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
                        <OriginBadge via={appt.created_via} />
                        {appt.series_id && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Repeat className="h-3 w-3" />
                            Fixo{appt.recurrence && recurrenceLabel[appt.recurrence] ? ` · ${recurrenceLabel[appt.recurrence]}` : ""}
                          </Badge>
                        )}
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
                        {appt.series_id && <DropdownMenuLabel className="text-xs">Somente este</DropdownMenuLabel>}
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
                        {appt.series_id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Toda a série (deste dia em diante)</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => onSeriesStatusChange?.(appt.id, "cancelled")}
                              className="text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Cancelar série
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteSeries?.(appt.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir série
                            </DropdownMenuItem>
                          </>
                        )}
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