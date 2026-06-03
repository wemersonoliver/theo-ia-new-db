// Camada de fallback automático Gemini → OpenAI.
// Cada caller continua dono do seu próprio retry/timeout do Gemini;
// quando o Gemini falhar de forma terminal, este módulo chama OpenAI
// com prompt equivalente e devolve o mesmo shape de JSON.
//
// Uso típico:
//   const fb = await openAIJsonFallback({
//     systemPrompt, userPrompt, model: "gpt-4o-mini",
//     reason: "gemini_429", account_id, phone,
//   });
//   if (fb) return fb.parsed;

import { callOpenAI, callOpenAIVision } from "./openai.ts";

export interface FallbackContext {
  account_id?: string;
  phone?: string;
  correlation_id?: string | null;
  reason: string; // ex: gemini_429, gemini_timeout, gemini_empty
}

export interface FallbackJsonResult {
  parsed: Record<string, unknown>;
  raw_text: string;
  provider: "openai";
  model: string;
  latency_ms: number;
}

/** Fallback texto/JSON. Retorna null se OPENAI_API_KEY ausente ou se falhar também. */
export async function openAIJsonFallback(args: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  ctx: FallbackContext;
}): Promise<FallbackJsonResult | null> {
  if (!Deno.env.get("OPENAI_API_KEY")) {
    console.warn(`[ai-fallback] OPENAI_API_KEY ausente — fallback indisponível (reason=${args.ctx.reason})`);
    return null;
  }
  const t0 = Date.now();
  try {
    const r = await callOpenAI({
      model: args.model ?? "gpt-4o-mini",
      json: true,
      maxTokens: args.maxTokens ?? 600,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
    });
    const parsed = safeParse(r.text);
    console.log(`[ai-fallback] openai_json OK model=${r.model} reason=${args.ctx.reason} latency=${Date.now() - t0}ms`);
    return {
      parsed,
      raw_text: r.text,
      provider: "openai",
      model: r.model,
      latency_ms: Date.now() - t0,
    };
  } catch (e) {
    console.error(`[ai-fallback] openai_json FAIL reason=${args.ctx.reason} err=${(e as Error).message}`);
    return null;
  }
}

/** Fallback vision (OCR/imagem). */
export async function openAIVisionFallback(args: {
  systemPrompt: string;
  userPrompt: string;
  imageBase64: string;
  mime: string;
  extraText?: string | null;
  model?: string;
  ctx: FallbackContext;
}): Promise<FallbackJsonResult | null> {
  if (!Deno.env.get("OPENAI_API_KEY")) {
    console.warn(`[ai-fallback] OPENAI_API_KEY ausente — vision fallback indisponível (reason=${args.ctx.reason})`);
    return null;
  }
  const t0 = Date.now();
  try {
    const r = await callOpenAIVision({
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      imageBase64: args.imageBase64,
      mime: args.mime,
      extraText: args.extraText,
      model: args.model ?? "gpt-4o",
    });
    const parsed = safeParse(r.text);
    console.log(`[ai-fallback] openai_vision OK model=${r.model} reason=${args.ctx.reason} latency=${Date.now() - t0}ms`);
    return {
      parsed,
      raw_text: r.text,
      provider: "openai",
      model: r.model,
      latency_ms: Date.now() - t0,
    };
  } catch (e) {
    console.error(`[ai-fallback] openai_vision FAIL reason=${args.ctx.reason} err=${(e as Error).message}`);
    return null;
  }
}

function safeParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return {};
}
