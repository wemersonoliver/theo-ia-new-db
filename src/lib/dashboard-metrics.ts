import type { Message } from "@/hooks/useConversations";

export interface ConversationLite {
  phone: string;
  assigned_to: string | null;
  last_message_at: string | null;
  created_at: string;
  messages: Message[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ConversationMetrics {
  leads: number;
  services: number;
  avgFirstResponseSec: number;
  avgServiceTimeSec: number;
  perAttendant: Record<string, { tma: number; count: number }>;
}

const SESSION_GAP_MS = 24 * 60 * 60 * 1000;

function tsMs(t: string): number {
  const n = new Date(t).getTime();
  return isNaN(n) ? 0 : n;
}

/**
 * For one conversation, compute first-response time (sec) and service time (sec)
 * limited to messages within the given range. Sessions split by 24h gap.
 */
export function conversationTimes(
  conv: ConversationLite,
  range: DateRange
): { firstResponseSec: number | null; serviceTimeSec: number | null; hadActivity: boolean } {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const msgs = (conv.messages || [])
    .filter((m) => m.type !== "context_summary")
    .map((m) => ({ ...m, _t: tsMs(m.timestamp) }))
    .filter((m) => m._t >= startMs && m._t <= endMs)
    .sort((a, b) => a._t - b._t);

  if (msgs.length === 0) return { firstResponseSec: null, serviceTimeSec: null, hadActivity: false };

  // First customer msg → first reply (ai or human)
  const firstClient = msgs.find((m) => !m.from_me);
  let firstResponseSec: number | null = null;
  if (firstClient) {
    const firstReply = msgs.find((m) => m.from_me && m._t > firstClient._t);
    if (firstReply) {
      firstResponseSec = Math.max(0, Math.round((firstReply._t - firstClient._t) / 1000));
    }
  }

  // Service time = duration of the (last) session within the range
  // Session: contiguous messages with gaps < 24h
  let sessionStart = msgs[0]._t;
  let sessionEnd = msgs[0]._t;
  let bestDur = 0;
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i]._t - msgs[i - 1]._t > SESSION_GAP_MS) {
      bestDur = Math.max(bestDur, sessionEnd - sessionStart);
      sessionStart = msgs[i]._t;
    }
    sessionEnd = msgs[i]._t;
  }
  bestDur = Math.max(bestDur, sessionEnd - sessionStart);
  const serviceTimeSec = Math.round(bestDur / 1000);

  return { firstResponseSec, serviceTimeSec, hadActivity: true };
}

export function aggregateConversationMetrics(
  conversations: ConversationLite[],
  range: DateRange
): ConversationMetrics {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  let leads = 0;
  let services = 0;
  let frSum = 0;
  let frCount = 0;
  let stSum = 0;
  let stCount = 0;
  const perAttendant: Record<string, { tma: number; count: number }> = {};

  for (const conv of conversations) {
    const msgs = (conv.messages || [])
      .filter((m) => m.type !== "context_summary")
      .map((m) => ({ ...m, _t: tsMs(m.timestamp) }))
      .sort((a, b) => a._t - b._t);

    // Lead = first ever client message inside the range
    const firstClientEver = msgs.find((m) => !m.from_me);
    if (firstClientEver && firstClientEver._t >= startMs && firstClientEver._t <= endMs) {
      leads++;
    }

    const inRange = msgs.filter((m) => m._t >= startMs && m._t <= endMs);
    const hadReplyInRange = inRange.some((m) => m.from_me);
    if (hadReplyInRange) services++;

    const t = conversationTimes(conv, range);
    if (t.firstResponseSec !== null) {
      frSum += t.firstResponseSec;
      frCount++;
    }
    if (t.serviceTimeSec !== null && t.serviceTimeSec > 0) {
      stSum += t.serviceTimeSec;
      stCount++;
      const key = conv.assigned_to || "__unassigned__";
      const cur = perAttendant[key] || { tma: 0, count: 0 };
      cur.tma = (cur.tma * cur.count + t.serviceTimeSec) / (cur.count + 1);
      cur.count++;
      perAttendant[key] = cur;
    }
  }

  return {
    leads,
    services,
    avgFirstResponseSec: frCount > 0 ? Math.round(frSum / frCount) : 0,
    avgServiceTimeSec: stCount > 0 ? Math.round(stSum / stCount) : 0,
    perAttendant,
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function pctVariation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function shiftRangeBack(range: DateRange): DateRange {
  const dur = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - dur),
    end: new Date(range.start.getTime()),
  };
}

export function presetRange(preset: "today" | "7d" | "30d" | "month"): DateRange {
  const end = new Date();
  const start = new Date();
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 30);
  } else if (preset === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}