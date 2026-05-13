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
  const [mEH, mEM] = parseHM(config.morning_window_end, "12:00");
  const [eSH, eSM] = parseHM(config.evening_window_start, "13:00");
  const [eEH, eEM] = parseHM(config.evening_window_end, "19:00");
  const mStart = mSH * 60 + mSM;
  const mEnd = mEH * 60 + mEM;
  const eStart = eSH * 60 + eSM;
  const eEnd = eEH * 60 + eEM;
  return (minutes >= mStart && minutes <= mEnd) || (minutes >= eStart && minutes <= eEnd);
}

/**
 * Gera N timestamps (UTC ISO) seguindo a regra:
 * 2 mensagens/dia (uma manhã, uma tarde), nas janelas BRT,
 * começando do próximo slot disponível a partir de "agora".
 *
 * @param config janelas
 * @param count quantidade de slots a gerar (ex: 12)
 * @param startsAt timestamp base (default: agora). Útil em testes.
 */
export function generateScheduleSequence(
  config: WindowConfig,
  count: number,
  startsAt?: Date,
): string[] {
  const [mSH, mSM] = parseHM(config.morning_window_start, "08:00");
  const [mEH, mEM] = parseHM(config.morning_window_end, "12:00");
  const [eSH, eSM] = parseHM(config.evening_window_start, "13:00");
  const [eEH, eEM] = parseHM(config.evening_window_end, "19:00");
  const mStart = mSH * 60 + mSM;
  const mEnd = mEH * 60 + mEM;
  const eStart = eSH * 60 + eSM;
  const eEnd = eEH * 60 + eEM;

  const baseLocal = startsAt
    ? new Date(startsAt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
    : getBrtNow().date;
  const tzOffsetMs = baseLocal.getTime() - (startsAt ?? new Date()).getTime();

  const result: string[] = [];
  // Cursor: data local BRT + slot "morning" | "evening"
  const cursor = new Date(baseLocal);
  let slot: "morning" | "evening" = "morning";
  const nowMin = baseLocal.getHours() * 60 + baseLocal.getMinutes();

  if (nowMin < mEnd - 5) {
    slot = "morning";
  } else if (nowMin < eEnd - 5) {
    slot = "evening";
  } else {
    // Já passou da tarde — começa amanhã de manhã
    cursor.setDate(cursor.getDate() + 1);
    slot = "morning";
  }

  // Se o cursor inicial cair em domingo, pula para segunda
  while (cursor.getDay() === 0) {
    cursor.setDate(cursor.getDate() + 1);
    slot = "morning";
  }

  for (let i = 0; i < count; i++) {
    let startMin: number;
    let endMin: number;
    if (slot === "morning") {
      startMin = mStart;
      endMin = mEnd;
      // Se for hoje e já estamos dentro da janela da manhã, garantir buffer de 5min
      if (
        cursor.toDateString() === baseLocal.toDateString() &&
        nowMin >= mStart - 1
      ) {
        startMin = Math.max(mStart, nowMin + 5);
      }
    } else {
      startMin = eStart;
      endMin = eEnd;
      if (
        cursor.toDateString() === baseLocal.toDateString() &&
        nowMin >= eStart - 1
      ) {
        startMin = Math.max(eStart, nowMin + 5);
      }
    }

    if (startMin >= endMin) startMin = endMin - 5;
    const range = Math.max(endMin - startMin, 1);
    const r = startMin + Math.floor(Math.random() * range);

    const slotLocal = new Date(cursor);
    slotLocal.setHours(Math.floor(r / 60), r % 60, 0, 0);
    // Converte BRT pseudo-local para UTC
    const utc = new Date(slotLocal.getTime() - tzOffsetMs);
    result.push(utc.toISOString());

    // Avança cursor
    if (slot === "morning") {
      slot = "evening";
    } else {
      slot = "morning";
      cursor.setDate(cursor.getDate() + 1);
      // Pula domingo
      while (cursor.getDay() === 0) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return result;
}
