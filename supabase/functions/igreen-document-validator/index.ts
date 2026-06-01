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
  extracted_text?: string | null;
  filename?: string | null;
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
Receberá uma imagem ou PDF, e PODE receber também um texto OCR pré-extraído (campo extracted_text).
Use AMBOS como evidência. Se o extracted_text claramente contiver dados de fatura de energia brasileira
(distribuidora reconhecida, kWh, valor a pagar, titular), classifique como "green_invoice" mesmo que
a leitura visual falhe.
Responda APENAS JSON com as chaves:
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
  const extracted_text = (body.extracted_text ?? null) as string | null;
  const filename = (body.filename ?? null) as string | null;

  if (!media_url) return json(failBody(correlation_id, "missing_media_url", 0), 400);

  // ───────────────────────────────────────────────────────────────────────
  // TEST-ONLY mock branch (opt-in; production never uses mock:// URLs).
  // Allows Phase 4 operational validation to exercise classification /
  // confidence / holder paths deterministically without burning Gemini quota
  // or requiring real Green invoices. Real URLs are unaffected.
  //   mock://?classification=green_invoice&confidence=0.92&holder=João%20Silva
  //         &doc=12345678901&distributor=ENEL&kwh=180&attempts=1
  //         &delay_ms=0
  // ───────────────────────────────────────────────────────────────────────
  if (media_url.startsWith("mock://")) {
    const qs = new URLSearchParams(media_url.replace(/^mock:\/\/\??/, ""));
    const delay = Number(qs.get("delay_ms") ?? 0);
    if (delay > 0) await sleep(Math.min(delay, 15000));
    if (qs.get("force_error") === "1") {
      return json(failBody(correlation_id, qs.get("error") ?? "mock_forced_error", Number(qs.get("attempts") ?? 3)), 200);
    }
    const cls = normalizeClassification(qs.get("classification") ?? "green_invoice");
    const conf = clamp01(Number(qs.get("confidence") ?? "0.95"));
    const extracted: ExtractedFields = {
      holder_name: qs.get("holder") ?? undefined,
      document_id: qs.get("doc") ?? undefined,
      address: qs.get("addr") ?? undefined,
      distributor: qs.get("distributor") ?? undefined,
      energy_consumption_kwh: qs.get("kwh") ? Number(qs.get("kwh")) : undefined,
    };
    return json({
      correlation_id,
      pipeline_version: CURRENT_PIPELINE_VERSION,
      provider: "gemini",
      classification: cls,
      confidence: conf,
      extracted,
      attempts: Number(qs.get("attempts") ?? 1),
    } as ValidatorResponse, 200);
  }

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
      const result = await callGemini({ apiKey, base64, mime: actualMime, extractedText: extracted_text, filename });
      // Fallback puro-texto: se Gemini Vision falhou mas temos OCR forte,
      // tenta classificar pela estrutura do texto.
      if (
        (result.classification === "unreadable" || result.confidence < 0.3) &&
        extracted_text && extracted_text.length > 300
      ) {
        const ocr = ocrFallback(extracted_text);
        if (ocr) {
          return json({
            correlation_id,
            pipeline_version: CURRENT_PIPELINE_VERSION,
            provider: "gemini",
            classification: "green_invoice",
            confidence: 0.75,
            extracted: ocr,
            attempts: attempt,
          } as ValidatorResponse, 200);
        }
      }
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

  // Última tentativa: se Gemini falhou totalmente mas temos OCR, usa fallback.
  if (extracted_text && extracted_text.length > 300) {
    const ocr = ocrFallback(extracted_text);
    if (ocr) {
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: "green_invoice",
        confidence: 0.7,
        extracted: ocr,
        attempts: RETRY_DELAYS.length + 1,
      } as ValidatorResponse, 200);
    }
  }
  return json(failBody(correlation_id, lastError, RETRY_DELAYS.length + 1), 200);
});

async function callGemini(args: { apiKey: string; base64: string; mime: string; extractedText?: string | null; filename?: string | null }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const userParts: any[] = [
      { text: "Classifique a fatura abaixo seguindo o JSON especificado." },
    ];
    if (args.filename) {
      userParts.push({ text: `Nome do arquivo: ${args.filename}` });
    }
    if (args.extractedText && args.extractedText.length > 50) {
      const txt = args.extractedText.length > 8000 ? args.extractedText.slice(0, 8000) : args.extractedText;
      userParts.push({ text: `OCR pré-extraído do documento:\n${txt}` });
    }
    userParts.push({ inlineData: { mimeType: args.mime, data: args.base64 } });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${args.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: userParts }],
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

// Lista de distribuidoras brasileiras reconhecidas (apenas para fallback OCR).
const KNOWN_DISTRIBUTORS = [
  "Celesc", "Enel", "CPFL", "Light", "Equatorial", "Energisa", "Neoenergia",
  "EDP", "Coelba", "Cemig", "Copel", "RGE", "Elektro", "Eletropaulo", "Cosern",
  "Celpe", "Coelce", "Amazonas Energia", "Roraima Energia", "Boa Vista Energia",
  "Ceee", "Celg", "Cerr", "Cepisa", "Ceron", "Eletroacre", "Sulgipe",
];

function ocrFallback(text: string): ExtractedFields | null {
  const t = text.replace(/\s+/g, " ");
  // Precisa indicar fatura de energia: presença de kWh + valor a pagar.
  const hasKwh = /\b\d{2,5}\s*(kwh|kw\/h)\b/i.test(t);
  const hasTotal = /(total\s+a\s+pagar|valor\s+a\s+pagar|r\$\s*\d{1,3}(\.\d{3})*,\d{2})/i.test(t);
  if (!hasKwh && !hasTotal) return null;

  // Distribuidora conhecida
  const distMatch = KNOWN_DISTRIBUTORS.find((d) => new RegExp(`\\b${d}\\b`, "i").test(t));
  if (!distMatch) return null;

  // Nome do titular: tenta "NOME:" depois palavras maiúsculas (≥2).
  let holder: string | undefined;
  const nomeColon = t.match(/\bNOME[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{4,80})/);
  if (nomeColon) {
    holder = nomeColon[1].trim().split(/\s{2,}|\bCPF\b|\bENDERECO\b|\bENDEREÇO\b/i)[0].trim();
  }
  if (!holder) {
    const upperRun = t.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}){1,5})\b/);
    if (upperRun) holder = upperRun[1].trim();
  }

  // Consumo kWh
  let kwh: number | undefined;
  const kwhMatch = t.match(/(\d{2,5})\s*(?:kwh|kw\/h)\b/i)
    ?? t.match(/total\s+apurado\s+(\d{2,5})/i);
  if (kwhMatch) {
    const n = Number(kwhMatch[1]);
    if (Number.isFinite(n) && n > 0 && n < 50000) kwh = n;
  }

  // CPF mascarado / qualquer documento
  let docId: string | undefined;
  const cpfMatch = t.match(/\b(\d{3}[\.\s]?\*{0,3}\d{0,3}[\.\s]?\d{0,3}[-\s]?\d{2})\b/);
  if (cpfMatch) docId = cpfMatch[1];

  return {
    holder_name: holder,
    document_id: docId,
    distributor: distMatch,
    energy_consumption_kwh: kwh,
  };
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