// Cálculo central da grade de horários de agendamento.
// Usado por manage-appointment (check_availability, create_appointment, reschedule_appointment)
// para garantir que a IA nunca ofereça/crie horários fora da configuração do usuário.

import { fetchAppointmentBlocks, findBlockConflict } from "./_appointment-blocks.ts";

export function dayOfWeekFromYmd(date: string): number {
  // Evita variação de fuso: fixa meio-dia UTC
  return new Date(`${String(date).slice(0, 10)}T12:00:00Z`).getUTCDay();
}

export interface DayAvailability {
  hasConfig: boolean;
  allDayBlocked: boolean;
  /** Todos os horários configurados no dia (HH:MM), independente de ocupação */
  grid: string[];
  /** Horários livres (HH:MM), já descontando ocupação e bloqueios */
  available: string[];
  /** Rótulo com vagas restantes quando max > 1 */
  availableLabels: string[];
  typeNames: { name: string; duration: number }[];
}

export async function computeDayAvailability(
  supabase: any,
  userId: string,
  date: string,
  ignoreAppointmentId?: string,
): Promise<DayAvailability> {
  const ymd = String(date).slice(0, 10);
  const dayOfWeek = dayOfWeekFromYmd(ymd);

  const result: DayAvailability = {
    hasConfig: false,
    allDayBlocked: false,
    grid: [],
    available: [],
    availableLabels: [],
    typeNames: [],
  };

  const dayBlocks = await fetchAppointmentBlocks(supabase, userId);
  const fullDayBlock = findBlockConflict(dayBlocks, ymd);
  if (fullDayBlock && fullDayBlock.all_day) {
    result.allDayBlocked = true;
    return result;
  }

  const { data: appointmentTypes } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");

  const typesForDay = (appointmentTypes || []).filter(
    (t: any) => Array.isArray(t.days_of_week) && t.days_of_week.includes(dayOfWeek),
  );

  const { data: legacySlots } = await supabase
    .from("appointment_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .order("start_time");

  const hasTypes = typesForDay.length > 0;
  const hasLegacy = Array.isArray(legacySlots) && legacySlots.length > 0;
  const hasAnyTypes = (appointmentTypes || []).length > 0;

  // Se o usuário usa appointment_types e não há tipo ativo neste dia,
  // o dia NÃO tem atendimento (não caia no legado).
  if (!hasTypes && (hasAnyTypes || !hasLegacy)) {
    result.hasConfig = hasAnyTypes;
    return result;
  }

  result.hasConfig = true;
  if (hasTypes) {
    result.typeNames = typesForDay.map((t: any) => ({ name: t.name, duration: t.duration_minutes }));
  }

  let existingQuery = supabase
    .from("appointments")
    .select("id, appointment_time, duration_minutes")
    .eq("user_id", userId)
    .eq("appointment_date", ymd)
    .neq("status", "cancelled");
  const { data: existingAppointments } = await existingQuery;

  const countByTime: Record<string, number> = {};
  for (const a of existingAppointments || []) {
    if (ignoreAppointmentId && a.id === ignoreAppointmentId) continue;
    const key = String(a.appointment_time).slice(0, 5);
    countByTime[key] = (countByTime[key] || 0) + 1;
  }

  const sources = hasTypes
    ? typesForDay.map((t: any) => ({
        start: t.start_time,
        end: t.end_time,
        duration: t.duration_minutes || 30,
        max: t.max_appointments_per_slot || 1,
      }))
    : (legacySlots || []).map((s: any) => ({
        start: s.start_time,
        end: s.end_time,
        duration: s.slot_duration_minutes || 30,
        max: s.max_appointments_per_slot || 1,
      }));

  const grid = new Set<string>();
  const available = new Set<string>();
  const labels: string[] = [];

  for (const src of sources) {
    const [sh, sm] = String(src.start).split(":").map(Number);
    const [eh, em] = String(src.end).split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;

    while (cur + src.duration <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      const display = `${hh}:${mm}`;
      grid.add(display);

      const used = countByTime[display] || 0;
      const blocked = findBlockConflict(dayBlocks, ymd, display, src.duration);
      if (used < src.max && !blocked && !available.has(display)) {
        available.add(display);
        const remaining = src.max - used;
        labels.push(src.max > 1 ? `${display} (${remaining} vaga${remaining > 1 ? "s" : ""})` : display);
      }
      cur += src.duration;
    }
  }

  result.grid = [...grid].sort();
  result.available = [...available].sort();
  result.availableLabels = labels.sort();
  return result;
}

export function formatSlotList(slots: string[]): string {
  return slots.join(", ");
}
