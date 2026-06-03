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

import { callOpenAI, callOpenAIVision, isProviderOutOfCredits, markProviderOutOfCredits, detectCreditError } from "./openai.ts";
import { geminiContentsToOpenAI, geminiToolsToOpenAI, openAIResultToGeminiJson } from "./tool-adapter.ts";

export { isProviderOutOfCredits, markProviderOutOfCredits, detectCreditError };

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

export interface FallbackTextResult {
  text: string;
  provider: "openai";
  model: string;
  latency_ms: number;
}

/** Fallback de texto livre (sem JSON). Retorna null se OPENAI indisponível/falhou ou breaker aberto. */
export async function openAITextFallback(args: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  ctx: FallbackContext;
}): Promise<FallbackTextResult | null> {
  if (!Deno.env.get("OPENAI_API_KEY")) return null;
  if (isProviderOutOfCredits("openai")) {
    console.warn(`[ai-fallback] openai breaker aberto (sem créditos) — reason=${args.ctx.reason}`);
    return null;
  }
  const t0 = Date.now();
  try {
    const r = await callOpenAI({
      model: args.model ?? "gpt-4o-mini",
      maxTokens: args.maxTokens ?? 600,
      temperature: args.temperature ?? 0.4,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
    });
    console.log(`[ai-fallback] openai_text OK model=${r.model} reason=${args.ctx.reason} latency=${Date.now() - t0}ms`);
    return { text: r.text, provider: "openai", model: r.model, latency_ms: Date.now() - t0 };
  } catch (e) {
    console.error(`[ai-fallback] openai_text FAIL reason=${args.ctx.reason} err=${(e as Error).message}`);
    return null;
  }
}

/**
 * Fallback para chamadas Gemini com function calling.
 * Recebe o payload Gemini (systemInstruction + contents + tools), chama OpenAI
 * e devolve um JSON com o MESMO shape que aiResponse.json() do Gemini.
 * Retorna null se OPENAI indisponível, sem créditos ou falhou.
 */
export async function openAIGeminiShapeFallback(args: {
  systemPrompt: string;
  contents: any[];
  tools?: any; // { functionDeclarations: [...] } no formato Gemini
  model?: string;
  maxTokens?: number;
  temperature?: number;
  ctx: FallbackContext;
}): Promise<any | null> {
  if (!Deno.env.get("OPENAI_API_KEY")) return null;
  if (isProviderOutOfCredits("openai")) {
    console.warn(`[ai-fallback] openai breaker aberto — reason=${args.ctx.reason}`);
    return null;
  }
  const t0 = Date.now();
  try {
    const messages = geminiContentsToOpenAI(args.contents, args.systemPrompt);
    const tools = args.tools ? geminiToolsToOpenAI(args.tools) : undefined;
    const r = await callOpenAI({
      model: args.model ?? "gpt-4o-mini",
      maxTokens: args.maxTokens ?? 1500,
      temperature: args.temperature ?? 0.5,
      messages: messages as any,
      tools,
    });
    const shaped = openAIResultToGeminiJson({
      text: r.text,
      tool_calls: r.tool_calls,
      model: r.model,
      raw: r.raw,
    });
    console.log(`[ai-fallback] openai_gemini_shape OK model=${r.model} reason=${args.ctx.reason} latency=${Date.now() - t0}ms hasTools=${(r.tool_calls?.length ?? 0) > 0}`);
    return shaped;
  } catch (e) {
    console.error(`[ai-fallback] openai_gemini_shape FAIL reason=${args.ctx.reason} err=${(e as Error).message}`);
    return null;
  }
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
