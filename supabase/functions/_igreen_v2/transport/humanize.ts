// Phase 5 — Humanização. Split por 220 chars, jitter 1.2-2.8s, pausa em "?".

export const MAX_CHUNK_CHARS = 220;

export interface HumanChunk {
  text: string;
  jitter_ms: number;
  pause_after_ms: number;
  index: number;
}

function jitter(): number {
  return Math.floor(1_200 + Math.random() * 1_600);
}

export function splitMessage(raw: string): string[] {
  const t = (raw ?? "").trim();
  if (t.length <= MAX_CHUNK_CHARS) return t ? [t] : [];
  const parts: string[] = [];
  const sentences = t.split(/(?<=[\.\?!])\s+/);
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length <= MAX_CHUNK_CHARS) {
      buf = (buf ? buf + " " : "") + s;
    } else {
      if (buf) parts.push(buf);
      if (s.length > MAX_CHUNK_CHARS) {
        // hard split
        for (let i = 0; i < s.length; i += MAX_CHUNK_CHARS) {
          parts.push(s.slice(i, i + MAX_CHUNK_CHARS));
        }
        buf = "";
      } else {
        buf = s;
      }
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export function humanize(raw: string): HumanChunk[] {
  const parts = splitMessage(raw);
  return parts.map((text, index) => ({
    text,
    index,
    jitter_ms: jitter(),
    pause_after_ms: /[\?]\s*$/.test(text) ? 1_500 : 0,
  }));
}