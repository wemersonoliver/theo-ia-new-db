// Behavior Engine — roda APÓS specialist+guardrails e ANTES do transport.
// Responsável por: chunking 220ch, dedup, ordering. Não envia nada.
// Typing/delay ficam em humanize.ts (stub) e são consumidos pelo transport real.

const MAX_CHUNK = 220;

export interface PreparedMessage {
  text: string;
  index: number;
  total: number;
}

export function prepareMessages(rawMessages: string[]): PreparedMessage[] {
  const cleaned = (rawMessages ?? [])
    .map((m) => (m ?? "").toString().trim())
    .filter((m) => m.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const m of cleaned) {
    if (seen.has(m)) continue;
    seen.add(m);
    unique.push(m);
  }

  const chunks: string[] = [];
  for (const msg of unique) {
    if (msg.length <= MAX_CHUNK) {
      chunks.push(msg);
      continue;
    }
    const parts = splitBySentence(msg, MAX_CHUNK);
    for (const p of parts) chunks.push(p);
  }

  return chunks.map((text, i) => ({ text, index: i, total: chunks.length }));
}

function splitBySentence(text: string, max: number): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length <= max) {
      buf = (buf ? buf + " " : "") + s;
    } else {
      if (buf) out.push(buf);
      if (s.length <= max) buf = s;
      else {
        for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
        buf = "";
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}