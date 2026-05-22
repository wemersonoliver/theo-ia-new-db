// Helpers compartilhados de janela e agendamento de follow-up.
// Opera em fuso America/Sao_Paulo.

export interface WindowConfig {
  morning_window_start?: string; // "08:00"
  morning_window_end?: string;   // "12:00"
  evening_window_start?: string; // "13:00"
  evening_window_end?: string;   // "19:00"
}

function parseHM(s: string | undefined, fallback: string): [number, number] {
  const [h, m] = (s || fallback).split(":").map(Number);
  return [h || 0, m || 0];
}

export function getBrtNow(): { date: Date; tzOffsetMs: number; minutes: number } {
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffsetMs = nowBrt.getTime() - Date.now();
  const minutes = nowBrt.getHours() * 60 + nowBrt.getMinutes();
  return { date: nowBrt, tzOffsetMs, minutes };
}

export function isWithinWindow(config: WindowConfig): boolean {
  const { date, minutes } = getBrtNow();
  // Bloquear envios automáticos aos domingos (BRT)
  if (date.getDay() === 0) return false;
  const [mSH, mSM] = parseHM(config.morning_window_start, "08:00");
  const [eEH, eEM] = parseHM(config.evening_window_end, "19:00");
  // Janela ÚNICA: morning_window_start (default 08:00) até evening_window_end (default 19:00)
  const dayStart = mSH * 60 + mSM;
  const dayEnd = eEH * 60 + eEM;
  return minutes >= dayStart && minutes <= dayEnd;
}

/**
 * Gera N timestamps (UTC ISO) seguindo a regra:
 * 1 mensagem por dia, em horário aleatório dentro da janela única (default 08:00–19:00 BRT),
 * começando do próximo dia útil disponível a partir de "agora". Pula domingos.
 *
 * @param config janelas
 * @param count quantidade de slots a gerar (ex: 6)
 * @param startsAt timestamp base (default: agora). Útil em testes.
 */
export function generateScheduleSequence(
  config: WindowConfig,
  count: number,
  startsAt?: Date,
): string[] {
  const [mSH, mSM] = parseHM(config.morning_window_start, "08:00");
  const [eEH, eEM] = parseHM(config.evening_window_end, "19:00");
  const dayStart = mSH * 60 + mSM;
  const dayEnd = eEH * 60 + eEM;

  const baseLocal = startsAt
    ? new Date(startsAt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
    : getBrtNow().date;
  const tzOffsetMs = baseLocal.getTime() - (startsAt ?? new Date()).getTime();

  const result: string[] = [];
  const cursor = new Date(baseLocal);
  const nowMin = baseLocal.getHours() * 60 + baseLocal.getMinutes();

  // Se já passou da janela do dia, começa amanhã
  if (nowMin >= dayEnd - 5) {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Se o cursor inicial cair em domingo, pula para segunda
  while (cursor.getDay() === 0) {
    cursor.setDate(cursor.getDate() + 1);
  }

  for (let i = 0; i < count; i++) {
    let startMin = dayStart;
    const endMin = dayEnd;
    if (
      cursor.toDateString() === baseLocal.toDateString() &&
      nowMin >= dayStart - 1
    ) {
      startMin = Math.max(dayStart, nowMin + 5);
    }

    if (startMin >= endMin) startMin = endMin - 5;
    const range = Math.max(endMin - startMin, 1);
    const r = startMin + Math.floor(Math.random() * range);

    const slotLocal = new Date(cursor);
    slotLocal.setHours(Math.floor(r / 60), r % 60, 0, 0);
    const utc = new Date(slotLocal.getTime() - tzOffsetMs);
    result.push(utc.toISOString());

    // Avança para o próximo dia (1 mensagem por dia)
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getDay() === 0) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}
