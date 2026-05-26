// Phase 5 — Typing presence. Envia "composing" antes de cada chunk.

export function computeTypingDurationMs(text: string): number {
  if (!text) return 600;
  return Math.min(8_000, Math.max(600, Math.floor((text.length / 45) * 1000)));
}

export async function sendTyping(args: {
  evolutionUrl: string;
  evolutionKey: string;
  instance: string;
  phone: string;
  durationMs: number;
}): Promise<void> {
  try {
    const url = `${args.evolutionUrl.replace(/\/+$/, "")}/chat/sendPresence/${args.instance}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.evolutionKey },
      body: JSON.stringify({
        number: args.phone,
        delay: args.durationMs,
        presence: "composing",
      }),
    });
  } catch (e) {
    console.error("[transport:typing] failed (non-blocking)", e);
  }
}