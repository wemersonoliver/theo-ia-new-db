import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAssigneeColor } from "@/lib/assignee-colors";
import type { Appointment } from "@/hooks/useAppointments";

const statusLabel: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

interface Props {
  appointment: Appointment;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
  variant?: "month" | "week";
}

export function AppointmentEventChip({
  appointment,
  onClick,
  onDragStart,
  draggable = true,
  variant = "month",
}: Props) {
  const color = getAssigneeColor(appointment.assigned_to);
  const time = appointment.appointment_time?.slice(0, 5) ?? "";
  const isCancelled = appointment.status === "cancelled";

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={onDragStart}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(e);
          }}
          className={`group block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition hover:shadow-sm ${
            isCancelled ? "line-through opacity-60" : ""
          } ${variant === "week" ? "px-2 py-1 text-xs" : ""}`}
          style={{
            backgroundColor: color.bg,
            borderColor: color.border,
            color: color.text,
          }}
        >
          <span className="font-semibold tabular-nums">{time}</span>{" "}
          <span className="font-medium">{appointment.title}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-sm">{appointment.title}</div>
          <div className="text-muted-foreground">
            🕒 {time}
            {appointment.duration_minutes ? ` · ${appointment.duration_minutes}min` : ""}
          </div>
          {appointment.contact_name && (
            <div>👤 {appointment.contact_name}</div>
          )}
          <div>📞 {appointment.phone}</div>
          <div className="pt-1">
            <span
              className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: color.dot, color: "white" }}
            >
              {statusLabel[appointment.status] ?? appointment.status}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}