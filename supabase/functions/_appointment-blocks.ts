// Helpers compartilhados para bloqueios de agenda (appointment_blocks)

export interface AppointmentBlockRow {
  id: string;
  reason: string;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: string;
  days_of_week: number[] | null;
}

export async function resolveAccountIdForUser(supabase: any, userId: string): Promise<string | null> {
  try {
    const { data: ownAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (ownAccount?.id) return ownAccount.id;

    const { data: memberAccount } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("invited_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return memberAccount?.account_id || null;
  } catch (e) {
    console.error("[blocks] resolveAccountIdForUser error", e);
    return null;
  }
}

export async function fetchAppointmentBlocks(supabase: any, userId: string): Promise<AppointmentBlockRow[]> {
  const accountId = await resolveAccountIdForUser(supabase, userId);
  if (!accountId) return [];
  const { data, error } = await supabase
    .from("appointment_blocks")
    .select("id, reason, all_day, start_date, end_date, start_time, end_time, recurrence, days_of_week")
    .eq("account_id", accountId);
  if (error) {
    console.error("[blocks] fetch error", error);
    return [];
  }
  return (data || []) as AppointmentBlockRow[];
}

export function blockCoversDate(block: AppointmentBlockRow, dateStr: string): boolean {
  if (block.recurrence === "weekly") {
    const dow = new Date(`${dateStr}T12:00:00`).getDay();
    if (!(block.days_of_week || []).includes(dow)) return false;
    if (block.start_date && dateStr < block.start_date) return false;
    if (block.end_date && dateStr > block.end_date) return false;
    return true;
  }
  const start = block.start_date;
  const end = block.end_date || block.start_date;
  if (!start) return false;
  return dateStr >= start && dateStr <= (end as string);
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Retorna o bloqueio conflitante (ou null) para uma data/hora. */
export function findBlockConflict(
  blocks: AppointmentBlockRow[],
  dateStr: string,
  time?: string | null,
  durationMinutes = 30
): AppointmentBlockRow | null {
  for (const b of blocks) {
    if (!blockCoversDate(b, dateStr)) continue;
    if (b.all_day || !b.start_time || !b.end_time) return b;
    if (!time) continue;
    const s = toMinutes(b.start_time);
    const e = toMinutes(b.end_time);
    const t = toMinutes(time);
    if (t < e && t + (durationMinutes || 30) > s) return b;
  }
  return null;
}