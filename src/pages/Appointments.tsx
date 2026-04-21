import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppointments } from "@/hooks/useAppointments";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { AppointmentCalendar, CalendarView } from "@/components/appointments/AppointmentCalendar";
import { AppointmentDayDrawer } from "@/components/appointments/AppointmentDayDrawer";
import { AppointmentFilters, StatusFilter } from "@/components/appointments/AppointmentFilters";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { getAssigneeColor } from "@/lib/assignee-colors";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarCheck, Loader2, Plus } from "lucide-react";

export default function Appointments() {
  const { user } = useAuth();
  const { isOwner, isManager } = useAccount();
  const { members } = useTeamMembers();
  const canSeeAll = isOwner || isManager;

  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(new Date());

  // Filtros
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>([]);
  const [search, setSearch] = useState("");

  // Dialog/Drawer
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<Date | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);

  // Range visível
  const range = useMemo(() => {
    if (view === "month") {
      return {
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
      };
    }
    if (view === "week") {
      return {
        start: startOfWeek(cursor, { weekStartsOn: 0 }),
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      };
    }
    return { start: cursor, end: cursor };
  }, [view, cursor]);

  const {
    appointments,
    todayAppointments,
    isLoading,
    updateStatus,
    deleteAppointment,
    assignAppointment,
    createAppointment,
    rescheduleAppointment,
  } = useAppointments(undefined, range);

  // Aplica filtros
  const filtered = useMemo(() => {
    let list = appointments;

    // Permissão: vendedor/agente só vê próprios
    if (!canSeeAll && user) {
      list = list.filter((a) => a.assigned_to === user.id || a.user_id === user.id);
    }

    if (selectedAssignees.length > 0) {
      list = list.filter((a) => a.assigned_to && selectedAssignees.includes(a.assigned_to));
    }

    if (selectedStatuses.length > 0) {
      list = list.filter((a) => selectedStatuses.includes(a.status as StatusFilter));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.contact_name?.toLowerCase().includes(q) ||
          a.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [appointments, canSeeAll, user, selectedAssignees, selectedStatuses, search]);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dialogOpen || drawerOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "t" || e.key === "T") setCursor(new Date());
      else if (e.key === "ArrowLeft")
        setCursor((c) =>
          view === "month" ? addDays(c, -30) : view === "week" ? addDays(c, -7) : addDays(c, -1)
        );
      else if (e.key === "ArrowRight")
        setCursor((c) =>
          view === "month" ? addDays(c, 30) : view === "week" ? addDays(c, 7) : addDays(c, 1)
        );
      else if (e.key === "m" || e.key === "M") setView("month");
      else if (e.key === "s" || e.key === "S") setView("week");
      else if (e.key === "d" || e.key === "D") setView("day");
      else if (e.key === "n" || e.key === "N") {
        setDialogDefaultDate(cursor);
        setDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, cursor, dialogOpen, drawerOpen]);

  const dayAppts = useMemo(() => {
    if (!drawerDate) return [];
    const key = format(drawerDate, "yyyy-MM-dd");
    return filtered.filter((a) => a.appointment_date === key);
  }, [drawerDate, filtered]);

  const todayPending = todayAppointments.filter((a) => a.status === "scheduled").length;

  // Membros visíveis na legenda (com agendamentos no range filtrado)
  const legendMembers = useMemo(() => {
    const usedIds = new Set<string | null>();
    filtered.forEach((a) => usedIds.add(a.assigned_to));
    return (members || [])
      .filter((m) => usedIds.has(m.user_id))
      .map((m) => ({ id: m.user_id, name: m.full_name || m.email || "Membro" }));
  }, [filtered, members]);

  return (
    <DashboardLayout title="Agendamentos" description="Sua agenda visual e simplificada">
      <TooltipProvider>
        <AppointmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultDate={dialogDefaultDate}
          isSubmitting={createAppointment.isPending}
          onSubmit={async (data) => {
            await createAppointment.mutateAsync(data);
          }}
        />

        <AppointmentDayDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          date={drawerDate}
          appointments={dayAppts}
          onCreate={() => {
            setDialogDefaultDate(drawerDate ?? undefined);
            setDialogOpen(true);
          }}
          onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
          onAssign={(id, userId) => assignAppointment.mutate({ id, userId })}
          onDelete={(id) => deleteAppointment.mutate(id)}
        />

        <div className="space-y-4">
          {/* Card de resumo */}
          {todayAppointments.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-3 py-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Hoje você tem {todayAppointments.length} agendamento{todayAppointments.length !== 1 ? "s" : ""}</span>
                  {todayPending > 0 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {todayPending} pendente{todayPending !== 1 ? "s" : ""} de confirmação
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros + botão Novo */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[280px]">
              <AppointmentFilters
                selectedAssignees={selectedAssignees}
                onAssigneesChange={setSelectedAssignees}
                selectedStatuses={selectedStatuses}
                onStatusesChange={setSelectedStatuses}
                search={search}
                onSearchChange={setSearch}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setDialogDefaultDate(cursor);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo
            </Button>
          </div>

          {/* Calendário */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AppointmentCalendar
              view={view}
              onViewChange={setView}
              cursor={cursor}
              onCursorChange={setCursor}
              appointments={filtered}
              onDayClick={(d) => {
                setDrawerDate(d);
                setDrawerOpen(true);
              }}
              onEmptyDayClick={(d) => {
                setDialogDefaultDate(d);
                setDialogOpen(true);
              }}
              onReschedule={(id, newDate) =>
                rescheduleAppointment.mutate({ id, appointment_date: newDate })
              }
            />
          )}

          {/* Legenda */}
          {legendMembers.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-semibold text-muted-foreground">Responsáveis:</span>
              {legendMembers.map((m) => {
                const c = getAssigneeColor(m.id);
                return (
                  <span key={m.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.dot }}
                    />
                    <span>{m.name}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Atalhos hint */}
          <p className="hidden md:block text-[11px] text-muted-foreground">
            Atalhos: <kbd className="rounded bg-muted px-1">T</kbd> Hoje · <kbd className="rounded bg-muted px-1">←</kbd>/<kbd className="rounded bg-muted px-1">→</kbd> Navegar · <kbd className="rounded bg-muted px-1">M</kbd>/<kbd className="rounded bg-muted px-1">S</kbd>/<kbd className="rounded bg-muted px-1">D</kbd> Trocar visualização · <kbd className="rounded bg-muted px-1">N</kbd> Novo
          </p>
        </div>

        {/* FAB mobile */}
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-40"
          onClick={() => {
            setDialogDefaultDate(cursor);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </TooltipProvider>
    </DashboardLayout>
  );
}
