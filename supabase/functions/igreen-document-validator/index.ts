// igreen-document-validator — edge function PURA (Fase 4).
//
// Restrições (hard):
//   - SEM Supabase client
//   - SEM applyPatch
//   - SEM emitEvents
//   - SEM transport
//   - SEM decisão de fluxo
//
// Faz: chamar Gemini com a mídia, retornar JSON estruturado.
// Resiliência: timeout 12s, 2 retries com backoff (1s, 3s), fallback unreadable.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 12_000;
const RETRY_DELAYS = [1_000, 3_000];
const CURRENT_PIPELINE_VERSION = 1;

interface ValidatorRequest {
  correlation_id?: string;
  account_id?: string;
  phone?: string;
  kind?: "invoice" | "identity";
  media_url?: string;
  mime_type?: string;
  byte_size?: number;
  pipeline_version?: number;
}

interface ExtractedFields {
  holder_name?: string;
  document_id?: string;
  address?: string;
  energy_consumption_kwh?: number;
  distributor?: string;
}

interface ValidatorResponse {
  correlation_id: string | null;
  pipeline_version: number;
  provider: "gemini";
  classification: "green_invoice" | "other_invoice" | "unreadable" | "not_invoice";
  confidence: number;
  extracted: ExtractedFields;
  attempts: number;
  error?: string;
}

const SYSTEM = `Você é um classificador OCR de faturas de energia elétrica brasileiras.
Receberá uma imagem ou PDF. Responda APENAS JSON com as chaves:
{
  "classification": "green_invoice" | "other_invoice" | "unreadable" | "not_invoice",
  "confidence": number (0..1),
  "extracted": {
    "holder_name": string,
    "document_id": string,
    "address": string,
    "energy_consumption_kwh": number,
    "distributor": string
  }
}
- "green_invoice" se for fatura de energia de uma distribuidora válida.
- "other_invoice" se for outra fatura (água, telefone etc).
- "not_invoice" se não for fatura.
- "unreadable" se ilegível.
Não inclua texto fora do JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: ValidatorRequest = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const correlation_id = body.correlation_id ?? null;
  const media_url = body.media_url;
  const mime_type = (body.mime_type ?? "").toLowerCase();

  if (!media_url) return json(failBody(correlation_id, "missing_media_url", 0), 400);

  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) return json(failBody(correlation_id, "no_api_key", 0), 200);

  // 1) baixa mídia (uma única vez) — depois retry só na chamada Gemini.
  let base64: string;
  let actualMime = mime_type || "application/octet-stream";
  try {
    const r = await fetch(media_url);
    if (!r.ok) return json(failBody(correlation_id, `media_fetch_${r.status}`, 0), 200);
    if (!mime_type) actualMime = r.headers.get("content-type") ?? "application/octet-stream";
    const buf = new Uint8Array(await r.arrayBuffer());
    base64 = toBase64(buf);
  } catch (e) {
    return json(failBody(correlation_id, `media_fetch_error:${(e as Error).message}`, 0), 200);
  }

  let lastError = "unknown";
  for (let attempt = 1; attempt <= RETRY_DELAYS.length + 1; attempt++) {
    try {
      const result = await callGemini({ apiKey, base64, mime: actualMime });
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: result.classification,
        confidence: result.confidence,
        extracted: result.extracted,
        attempts: attempt,
      } as ValidatorResponse, 200);
    } catch (e) {
      lastError = (e as Error).message;
      const delay = RETRY_DELAYS[attempt - 1];
      if (delay !== undefined) {
        await sleep(delay);
      }
    }
  }

  return json(failBody(correlation_id, lastError, RETRY_DELAYS.length + 1), 200);
});

async function callGemini(args: { apiKey: string; base64: string; mime: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${args.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{
            role: "user",
            parts: [
              { text: "Classifique a fatura abaixo seguindo o JSON especificado." },
              { inlineData: { mimeType: args.mime, data: args.base64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 600, responseMimeType: "application/json" },
        }),
      },
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`gemini_${res.status}`);
    const j = await res.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = safeParse(text);
    const classification = normalizeClassification(parsed.classification);
    const confidence = clamp01(Number(parsed.confidence ?? 0));
    const extracted = (parsed.extracted ?? {}) as ExtractedFields;
    return { classification, confidence, extracted };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeClassification(c: unknown): ValidatorResponse["classification"] {
  const s = String(c ?? "").toLowerCase();
  if (s === "green_invoice" || s === "other_invoice" || s === "unreadable" || s === "not_invoice") return s;
  return "unreadable";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function failBody(correlation_id: string | null, error: string, attempts: number): ValidatorResponse {
  return {
    correlation_id,
    pipeline_version: CURRENT_PIPELINE_VERSION,
    provider: "gemini",
    classification: "unreadable",
    confidence: 0,
    extracted: {},
    attempts,
    error,
  };
}

function safeParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return {};
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(s);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}