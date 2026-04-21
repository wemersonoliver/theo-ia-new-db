import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentEventChip } from "./AppointmentEventChip";
import { getAssigneeColor } from "@/lib/assignee-colors";
import type { Appointment } from "@/hooks/useAppointments";

export type CalendarView = "month" | "week" | "day";

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  appointments: Appointment[];
  onDayClick: (date: Date) => void;
  onEmptyDayClick: (date: Date) => void;
  onReschedule: (id: string, newDate: string) => void;
}

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06h-22h

export function AppointmentCalendar({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  appointments,
  onDayClick,
  onEmptyDayClick,
  onReschedule,
}: Props) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const apptByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = a.appointment_date;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => x.appointment_time.localeCompare(y.appointment_time));
    }
    return map;
  }, [appointments]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") onCursorChange(addMonths(cursor, dir));
    else if (view === "week") onCursorChange(addWeeks(cursor, dir));
    else onCursorChange(addDays(cursor, dir));
  };

  const headerLabel = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
  }, [view, cursor]);

  // ---- handlers de drag ----
  const handleDragStart = (e: React.DragEvent, appointmentId: string) => {
    e.dataTransfer.setData("text/appointment-id", appointmentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDayDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    const id = e.dataTransfer.getData("text/appointment-id");
    if (!id) return;
    const newDate = format(date, "yyyy-MM-dd");
    const appt = appointments.find((a) => a.id === id);
    if (appt && appt.appointment_date !== newDate) {
      onReschedule(id, newDate);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => onCursorChange(startOfDay(new Date()))}>
            Hoje
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-base font-semibold capitalize">{headerLabel}</h2>
        </div>

        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {view === "month" && (
        <MonthView
          cursor={cursor}
          apptByDate={apptByDate}
          dragOverDate={dragOverDate}
          setDragOverDate={setDragOverDate}
          onDayClick={onDayClick}
          onEmptyDayClick={onEmptyDayClick}
          onDragStart={handleDragStart}
          onDrop={handleDayDrop}
        />
      )}
      {view === "week" && (
        <WeekView
          cursor={cursor}
          apptByDate={apptByDate}
          dragOverDate={dragOverDate}
          setDragOverDate={setDragOverDate}
          onDayClick={onDayClick}
          onEmptyDayClick={onEmptyDayClick}
          onDragStart={handleDragStart}
          onDrop={handleDayDrop}
        />
      )}
      {view === "day" && (
        <DayView
          cursor={cursor}
          apptByDate={apptByDate}
          onDayClick={onDayClick}
          onEmptyDayClick={onEmptyDayClick}
        />
      )}
    </div>
  );
}

/* ---------------- Month View ---------------- */
interface SubProps {
  cursor: Date;
  apptByDate: Map<string, Appointment[]>;
  dragOverDate?: string | null;
  setDragOverDate?: (d: string | null) => void;
  onDayClick: (date: Date) => void;
  onEmptyDayClick: (date: Date) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDrop?: (e: React.DragEvent, date: Date) => void;
}

function MonthView({
  cursor,
  apptByDate,
  dragOverDate,
  setDragOverDate,
  onDayClick,
  onEmptyDayClick,
  onDragStart,
  onDrop,
}: SubProps) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayAppts = apptByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const isDragOver = dragOverDate === key;

          return (
            <div
              key={key}
              onClick={() => (dayAppts.length > 0 ? onDayClick(day) : onEmptyDayClick(day))}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDate?.(key);
              }}
              onDragLeave={() => setDragOverDate?.(null)}
              onDrop={(e) => onDrop?.(e, day)}
              className={`min-h-[110px] cursor-pointer border-b border-r p-1.5 transition ${
                inMonth ? "bg-background" : "bg-muted/30"
              } ${isDragOver ? "ring-2 ring-primary ring-inset bg-accent" : "hover:bg-accent/50"}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    today
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayAppts.length > 3 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <AppointmentEventChip
                    key={a.id}
                    appointment={a}
                    onClick={() => onDayClick(day)}
                    onDragStart={(e) => onDragStart?.(e, a.id)}
                  />
                ))}
                {dayAppts.length > 3 && (
                  <button
                    className="block w-full text-left text-[10px] font-medium text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(day);
                    }}
                  >
                    +{dayAppts.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Week View ---------------- */
function WeekView({
  cursor,
  apptByDate,
  dragOverDate,
  setDragOverDate,
  onDayClick,
  onEmptyDayClick,
  onDragStart,
  onDrop,
}: SubProps) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/40">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="px-2 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                {format(d, "EEE", { locale: ptBR })}
              </div>
              <div
                className={`mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  today ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[70vh] overflow-y-auto">
        {HOURS.map((h) => (
          <Row key={h} hour={h} days={days} apptByDate={apptByDate} dragOverDate={dragOverDate} setDragOverDate={setDragOverDate} onDayClick={onDayClick} onEmptyDayClick={onEmptyDayClick} onDragStart={onDragStart} onDrop={onDrop} />
        ))}
      </div>
    </div>
  );
}

function Row({
  hour,
  days,
  apptByDate,
  dragOverDate,
  setDragOverDate,
  onDayClick,
  onEmptyDayClick,
  onDragStart,
  onDrop,
}: {
  hour: number;
  days: Date[];
  apptByDate: Map<string, Appointment[]>;
  dragOverDate?: string | null;
  setDragOverDate?: (d: string | null) => void;
  onDayClick: (date: Date) => void;
  onEmptyDayClick: (date: Date) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDrop?: (e: React.DragEvent, date: Date) => void;
}) {
  return (
    <>
      <div className="border-b border-r px-2 py-1 text-right text-[10px] font-medium text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const all = apptByDate.get(key) ?? [];
        const slot = all.filter((a) => Number(a.appointment_time.slice(0, 2)) === hour);
        const isDragOver = dragOverDate === key;
        return (
          <div
            key={`${key}_${hour}`}
            onClick={() => (slot.length > 0 ? onDayClick(d) : onEmptyDayClick(d))}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverDate?.(key);
            }}
            onDragLeave={() => setDragOverDate?.(null)}
            onDrop={(e) => onDrop?.(e, d)}
            className={`min-h-[44px] cursor-pointer border-b border-r p-0.5 transition hover:bg-accent/40 ${
              isDragOver ? "ring-2 ring-primary ring-inset bg-accent" : ""
            }`}
          >
            <div className="space-y-0.5">
              {slot.map((a) => (
                <AppointmentEventChip
                  key={a.id}
                  appointment={a}
                  variant="week"
                  onClick={() => onDayClick(d)}
                  onDragStart={(e) => onDragStart?.(e, a.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Day View ---------------- */
function DayView({ cursor, apptByDate, onDayClick, onEmptyDayClick }: SubProps) {
  const key = format(cursor, "yyyy-MM-dd");
  const all = apptByDate.get(key) ?? [];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto">
        {HOURS.map((h) => {
          const slot = all.filter((a) => Number(a.appointment_time.slice(0, 2)) === h);
          return (
            <div
              key={h}
              className="grid grid-cols-[70px_1fr] border-b cursor-pointer hover:bg-accent/30"
              onClick={() => (slot.length > 0 ? onDayClick(cursor) : onEmptyDayClick(cursor))}
            >
              <div className="border-r px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="min-h-[60px] p-2 space-y-1">
                {slot.map((a) => {
                  const color = getAssigneeColor(a.assigned_to);
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick(cursor);
                      }}
                      className="rounded-md border px-3 py-2 text-sm cursor-pointer hover:shadow-sm"
                      style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                    >
                      <div className="font-semibold">
                        {a.appointment_time.slice(0, 5)} · {a.title}
                      </div>
                      {(a.contact_name || a.phone) && (
                        <div className="text-xs opacity-80 mt-0.5">
                          {a.contact_name ?? a.phone}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}