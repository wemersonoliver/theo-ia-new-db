// Phase 5 — Embedding worker. Usa Lovable AI Gateway (openai/text-embedding-3-small).

import { withBackoff } from "../retry/backoff.ts";

const MODEL = "openai/text-embedding-3-small";

export async function embed(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.warn("[embedding-worker] LOVABLE_API_KEY missing — embed returns null");
    return null;
  }
  try {
    return await withBackoff(async () => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, input: text.slice(0, 8_000) }),
      });
      if (!r.ok) throw new Error(`embed_${r.status}`);
      const j = await r.json();
      return (j?.data?.[0]?.embedding ?? null) as number[] | null;
    });
  } catch (e) {
    console.error("[embedding-worker] failed", e);
    return null;
  }
}

export const EMBEDDING_DIM = 1536;