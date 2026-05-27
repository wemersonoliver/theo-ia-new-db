export interface Msg { role: string; content: string }
export function dedupConsecutive(msgs: Msg[]): { msgs: Msg[]; removed: number } {
  if (msgs.length <= 1) return { msgs, removed: 0 };
  const out: Msg[] = [msgs[0]]; let removed = 0;
  for (let i = 1; i < msgs.length; i++) {
    const prev = out[out.length - 1];
    if (prev.role === msgs[i].role && norm(prev.content) === norm(msgs[i].content)) { removed++; continue; }
    out.push(msgs[i]);
  }
  return { msgs: out, removed };
}
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
