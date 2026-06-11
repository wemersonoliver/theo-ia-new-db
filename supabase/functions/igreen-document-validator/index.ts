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
import { openAIVisionFallback } from "../_shared/ai-fallback/index.ts";

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
  expected_name?: string | null;
}

interface ExtractedFields {
  holder_name?: string;
  document_id?: string;
  address?: string;
  energy_consumption_kwh?: number;
  distributor?: string;
  // Confiança da extração do titular. Quando "low", o agente NÃO deve
  // afirmar que a fatura está em nome de outra pessoa — deve perguntar.
  holder_confidence?: "high" | "medium" | "low";
  // CPF do titular extraído da fatura — pode vir mascarado (ex.: "022.***.***-04")
  // ou completo. Usado para reconciliar com o CPF do RG/CNH e desbloquear
  // casos em que o nome veio com OCR ruim mas o CPF bate.
  holder_cpf_mask?: string;
}

interface ValidatorResponse {
  correlation_id: string | null;
  pipeline_version: number;
  provider: "gemini" | "openai";
  classification:
    | "green_invoice" | "other_invoice" | "unreadable" | "not_invoice"
    | "cnh" | "rg" | "identity" | "not_identity";
  confidence: number;
  extracted: ExtractedFields;
  attempts: number;
  error?: string;
}

const SYSTEM = `Você é um classificador OCR de faturas de energia elétrica brasileiras.
Receberá uma imagem ou PDF, e PODE receber também um texto OCR pré-extraído.
Faturas brasileiras vêm em DEZENAS de layouts (Enel, Equatorial, CPFL, Light, Coelba,
Cemig, Celesc, Energisa, EDP, Neoenergia, Copel, etc.). Você DEVE analisar o cabeçalho
inteiro e identificar o nome do TITULAR — a pessoa para quem a fatura é emitida.

REGRAS HARD para holder_name:
- O titular é SEMPRE um nome de PESSOA (ou razão social) com 2 ou mais palavras alfabéticas.
- NUNCA confunda com cabeçalhos de tabelas de tributos: "BC ICMS", "ICMS", "PIS", "COFINS",
  "TUSD", "TE", "BANDEIRA", "TARIFA", "SUBTOTAL", "TOTAL A PAGAR", "BASE", "ALÍQUOTA".
- NUNCA confunda com o nome da distribuidora (ENEL, CPFL, EQUATORIAL, LIGHT etc.).
- NUNCA invente nome. Se não houver nome claro de pessoa, devolva holder_name="" e
  holder_confidence="low".
- Procure por âncoras: "Nome do Cliente", "Cliente:", "Nome/Razão Social", "Titular",
  "Devedor", "Consumidor", "Destinatário", "Sr(a):", "Razão Social", "Nome:".
- Considere também o nome em CAIXA ALTA que aparece logo após o cabeçalho da distribuidora,
  geralmente junto do endereço de cobrança.
- Extraia o CPF/CNPJ do titular, mesmo mascarado ("022.***.***-04"), no campo holder_cpf_mask.

Responda APENAS JSON com as chaves:
{
  "classification": "green_invoice" | "other_invoice" | "unreadable" | "not_invoice",
  "confidence": number (0..1),
  "extracted": {
    "holder_name": string,
    "holder_confidence": "high" | "medium" | "low",
    "holder_cpf_mask": string,
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

const SYSTEM_IDENTITY = `Você é um classificador OCR de documentos de identidade brasileiros (RG ou CNH).
Receberá uma imagem ou PDF, e PODE receber também um texto OCR pré-extraído (campo extracted_text).
Use AMBOS como evidência.
Responda APENAS JSON com as chaves:
{
  "classification": "cnh" | "rg" | "identity" | "not_identity" | "unreadable",
  "confidence": number (0..1),
  "extracted": {
    "holder_name": string,   // nome completo do titular do documento (campo NOME ou equivalente)
    "document_id": string    // CPF ou RG, sem máscara obrigatória
  }
}
- "cnh" se for Carteira Nacional de Habilitação brasileira.
- "rg" se for Carteira/Cédula de Identidade (RG/RIC) brasileira.
- "identity" se for outro documento oficial de identificação com foto (passaporte BR, RNE, CNH digital sem clareza de tipo).
- "not_identity" se NÃO for documento de identidade (ex.: fatura, comprovante, foto pessoal).
- "unreadable" se ilegível.
Confidence alta (>=0.9) quando o nome do titular for legível.
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
  const expected_name = (body.expected_name ?? null) as string | null;
  const kind = (body.kind ?? "invoice") as "invoice" | "identity";
  const systemPrompt = kind === "identity" ? SYSTEM_IDENTITY : SYSTEM;
  const userInstruction = kind === "identity"
    ? "Classifique o documento de identidade abaixo seguindo o JSON especificado."
    : "Classifique a fatura abaixo seguindo o JSON especificado.";

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

  if (kind === "identity" && extracted_text && extracted_text.length > 80) {
    const ocr = identityOcrFallback(extracted_text, expected_name);
    if (ocr) {
      console.log(`[igreen-document-validator] identity fast-path HIT cls=${ocr.classification} holder=${ocr.extracted.holder_name ?? "?"} len=${extracted_text.length}`);
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: ocr.classification,
        confidence: ocr.confidence,
        extracted: ocr.extracted,
        attempts: 1,
      } as ValidatorResponse, 200);
    }
    console.log(`[igreen-document-validator] identity fast-path MISS len=${extracted_text.length}`);
  }

  // ───────────────────────────────────────────────────────────────────────
  // FAST-PATH: se o OCR pré-extraído já parece uma fatura de energia
  // brasileira válida (distribuidora reconhecida + sinais de fatura),
  // classifica direto SEM depender do Gemini Vision. Isso evita o caso
  // em que o Vision retorna unreadable apesar do PDF estar perfeito.
  // Aplica-se SOMENTE à vertical iGreen (esta edge function é exclusiva
  // dela), não impacta usuários do plano comum.
  // ───────────────────────────────────────────────────────────────────────
  if (kind === "invoice" && extracted_text && extracted_text.length > 120) {
    const ocr = ocrFallback(extracted_text, filename) ?? weakInvoiceOcrFallback(extracted_text, filename);
    if (ocr) {
      console.log(`[igreen-document-validator] fast-path HIT distributor=${ocr.distributor ?? "?"} kwh=${ocr.energy_consumption_kwh ?? "?"} len=${extracted_text.length}`);
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: "green_invoice",
        confidence: ocr.energy_consumption_kwh ? 0.92 : 0.76,
        extracted: ocr,
        attempts: 1,
      } as ValidatorResponse, 200);
    } else {
      console.log(`[igreen-document-validator] fast-path MISS len=${extracted_text.length} reason=ocr_signals_not_matched`);
    }
  } else {
    console.log(`[igreen-document-validator] fast-path SKIP extracted_text_len=${extracted_text?.length ?? 0}`);
  }

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
      const result = await callGemini({
        apiKey, base64, mime: actualMime, extractedText: extracted_text, filename,
        systemPrompt, userInstruction, kind,
      });
      // Fallback puro-texto: se Gemini Vision falhou mas temos OCR forte,
      // tenta classificar pela estrutura do texto.
      if (
        kind === "invoice" &&
        (result.classification === "unreadable" || result.confidence < 0.3) &&
        extracted_text && extracted_text.length > 120
      ) {
        const ocr = ocrFallback(extracted_text, filename) ?? weakInvoiceOcrFallback(extracted_text, filename);
        if (ocr) {
          return json({
            correlation_id,
            pipeline_version: CURRENT_PIPELINE_VERSION,
            provider: "gemini",
            classification: "green_invoice",
            confidence: ocr.energy_consumption_kwh ? 0.75 : 0.72,
            extracted: ocr,
            attempts: attempt,
          } as ValidatorResponse, 200);
        }
      }
      if (
        kind === "identity" &&
        (result.classification === "unreadable" || result.confidence < 0.4) &&
        extracted_text && extracted_text.length > 80
      ) {
        const ocr = identityOcrFallback(extracted_text, expected_name);
        if (ocr) {
          return json({
            correlation_id,
            pipeline_version: CURRENT_PIPELINE_VERSION,
            provider: "gemini",
            classification: ocr.classification,
            confidence: Math.max(0.78, ocr.confidence - 0.08),
            extracted: ocr.extracted,
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
  if (kind === "invoice" && extracted_text && extracted_text.length > 120) {
    const ocr = ocrFallback(extracted_text, filename) ?? weakInvoiceOcrFallback(extracted_text, filename);
    if (ocr) {
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: "green_invoice",
        confidence: ocr.energy_consumption_kwh ? 0.7 : 0.72,
        extracted: ocr,
        attempts: RETRY_DELAYS.length + 1,
      } as ValidatorResponse, 200);
    }
  }
  if (kind === "identity" && extracted_text && extracted_text.length > 80) {
    const ocr = identityOcrFallback(extracted_text, expected_name);
    if (ocr) {
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "gemini",
        classification: ocr.classification,
        confidence: Math.max(0.7, ocr.confidence - 0.15),
        extracted: ocr.extracted,
        attempts: RETRY_DELAYS.length + 1,
      } as ValidatorResponse, 200);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // FALLBACK FINAL: OpenAI Vision (gpt-4o) quando Gemini falhou de vez e
  // o OCR estrutural não bateu. Só roda se OPENAI_API_KEY estiver setado.
  // ───────────────────────────────────────────────────────────────────────
  try {
    const fb = await openAIVisionFallback({
      systemPrompt,
      userPrompt: `${userInstruction} Retorne JSON puro.`,
      imageBase64: base64,
      mime: actualMime,
      extraText: extracted_text && extracted_text.length > 50
        ? `OCR pré-extraído do documento:\n${extracted_text.slice(0, 8000)}`
        : null,
      model: "gpt-4o",
      ctx: { account_id: body.account_id, phone: body.phone, correlation_id, reason: `gemini_failed:${lastError}` },
    });
    if (fb) {
      const classification = kind === "identity"
        ? normalizeIdentityClassification((fb.parsed as any).classification)
        : normalizeClassification((fb.parsed as any).classification);
      const confidence = clamp01(Number((fb.parsed as any).confidence ?? 0));
      const extracted = ((fb.parsed as any).extracted ?? {}) as ExtractedFields;
      console.log(`[igreen-document-validator] OPENAI fallback used model=${fb.model} cls=${classification} conf=${confidence}`);
      return json({
        correlation_id,
        pipeline_version: CURRENT_PIPELINE_VERSION,
        provider: "openai",
        classification,
        confidence,
        extracted,
        attempts: RETRY_DELAYS.length + 2,
      } as ValidatorResponse, 200);
    }
  } catch (e) {
    console.error(`[igreen-document-validator] openai vision fallback threw: ${(e as Error).message}`);
  }

  return json(failBody(correlation_id, lastError, RETRY_DELAYS.length + 1), 200);
});

async function callGemini(args: {
  apiKey: string; base64: string; mime: string;
  extractedText?: string | null; filename?: string | null;
  systemPrompt?: string; userInstruction?: string; kind?: "invoice" | "identity";
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const userParts: any[] = [
      { text: args.userInstruction ?? "Classifique a fatura abaixo seguindo o JSON especificado." },
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
          systemInstruction: { parts: [{ text: args.systemPrompt ?? SYSTEM }] },
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
    const classification = (args.kind === "identity"
      ? normalizeIdentityClassification(parsed.classification)
      : normalizeClassification(parsed.classification));
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

function ocrFallback(text: string, filename?: string | null): ExtractedFields | null {
  const t = text.replace(/\s+/g, " ");
  // Sinais de fatura de energia brasileira (qualquer um basta):
  //  - kWh em qualquer posição (antes OU depois dos dígitos)
  //  - "Total a pagar", "Valor a pagar", "Total Apurado" ou valor R$ formatado
  const hasKwh = /\bkwh\b|\bkw\/h\b/i.test(t);
  const hasTotal = /(total\s+a\s+pagar|valor\s+a\s+pagar|total\s+apurado|r\$\s*\d{1,3}(\.\d{3})*,\d{2})/i.test(t);
  if (!hasKwh && !hasTotal) return null;

  // Distribuidora conhecida
  const distMatch = KNOWN_DISTRIBUTORS.find((d) => new RegExp(`\\b${d}\\b`, "i").test(t));
  if (!distMatch) return null;

  // Nome do titular: prioriza rótulos reais da fatura antes de qualquer
  // sequência em maiúsculas. PDFs da Celesc costumam vir como markdown/OCR:
  // "**Nome do titular/cliente:** WEMERSON LEITE OLIVEIRA". Antes o fallback
  // caía no primeiro texto maiúsculo do documento ("DOCUMENTO AUXILIAR...").
  let holder: string | undefined;
  const labeledHolder = extractInvoiceHolderName(t);
  if (labeledHolder) {
    holder = labeledHolder;
  }
  if (!holder) {
    const upperRun = t.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}){1,5})\b/);
    if (upperRun) {
      const candidate = cleanInvoiceHolderCandidate(upperRun[1]);
      if (candidate) holder = candidate;
    }
  }

  // Consumo kWh
  let kwh: number | undefined;
  const kwhMatch = t.match(/(\d{2,5})\s*(?:kwh|kw\/h)\b/i)
    ?? t.match(/\bkwh\s*\|\s*(\d{2,5})/i)
    ?? t.match(/total\s+apurado\s+(\d{2,5})/i)
    ?? t.match(/consumo[^0-9]{0,30}(\d{2,5})\s*kwh/i);
  if (kwhMatch) {
    const n = Number(kwhMatch[1]);
    if (Number.isFinite(n) && n > 0 && n < 50000) kwh = n;
  }

  // CPF mascarado / qualquer documento (aceita formatos com asteriscos)
  let docId: string | undefined;
  const cpfMatch = t.match(/\*{2,3}\.?\d{3}\.?\d{3}-?\*{2}/)
    ?? t.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (cpfMatch) docId = cpfMatch[0];

  return {
    holder_name: holder ?? holderFromFilename(filename),
    document_id: docId,
    distributor: distMatch,
    energy_consumption_kwh: kwh,
  };
}

function weakInvoiceOcrFallback(text: string, filename?: string | null): ExtractedFields | null {
  const t = text.replace(/\s+/g, " ");
  const distMatch = KNOWN_DISTRIBUTORS.find((d) => new RegExp(`\\b${d}\\b`, "i").test(t));
  const hasEnergyDoc = /(nota fiscal de energia|energia elétrica|energia eletrica|conta de luz|fatura de energia|danf3e)/i.test(t);
  if (!distMatch || !hasEnergyDoc) return null;
  return {
    holder_name: extractInvoiceHolderName(t) ?? holderFromFilename(filename),
    distributor: distMatch,
  };
}

function extractInvoiceHolderName(text: string): string | undefined {
  const patterns = [
    /nome\s*(?:do\s*)?(?:titular|cliente)?\s*(?:\/\s*(?:titular|cliente))?\s*[:\-* ]+\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{4,90})(?=\s*(?:\*\*|cpf|cnpj|documento|endere[cç]o|unidade|cliente|etapa|refer[eê]ncia|vencimento|total|$))/i,
    /(?:titular|cliente)\s*[:\-* ]+\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{4,90})(?=\s*(?:\*\*|cpf|cnpj|documento|endere[cç]o|unidade|cliente|etapa|refer[eê]ncia|vencimento|total|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const cleaned = cleanInvoiceHolderCandidate(m?.[1]);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function cleanInvoiceHolderCandidate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/\*+/g, " ")
    .replace(/\b(CPF|CNPJ|ENDERE[CÇ]O|UNIDADE|CONSUMIDORA|CLIENTE|ETAPA|REFER[EÊ]NCIA|VENCIMENTO|TOTAL)\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 5) return undefined;
  if (/(documento auxiliar|nota fiscal|energia eletrica|energia elétrica|distribuidora|classifica[cç][aã]o|modalidade|fornecimento|ilumina[cç][aã]o)/i.test(cleaned)) {
    return undefined;
  }
  const parts = cleaned.split(" ").filter((p) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ']{2,}$/i.test(p));
  if (parts.length < 2) return undefined;
  return parts.slice(0, 6).join(" ");
}

function holderFromFilename(filename?: string | null): string | undefined {
  if (!filename) return undefined;
  const cleaned = filename
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\b(fatura|conta|energia|celesc|enel|pdf|documento|doc)\b/gi, " ")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return undefined;
  return cleaned.split(" ")
    .filter((p) => p.length >= 2)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ") || undefined;
}

function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function nameTokens(s: string | null | undefined): string[] {
  return normalizeText(s).split(" ").filter((t) => t.length >= 3 && !DOCUMENT_STOPWORDS.has(t));
}

const DOCUMENT_STOPWORDS = new Set([
  "republica", "federativa", "brasil", "ministerio", "secretaria", "nacional", "transito",
  "carteira", "habilitacao", "registro", "geral", "identidade", "validade", "emissao", "nascimento",
  "doc", "cpf", "nome", "filiacao", "local", "data", "permissao", "categoria", "assinatura", "digital",
]);

function titleCaseName(s: string): string {
  return normalizeText(s).split(" ").filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function expectedNameAppears(text: string, expectedName: string | null | undefined): boolean {
  const expected = nameTokens(expectedName);
  if (expected.length < 2) return false;
  const normalized = normalizeText(text);
  let hits = 0;
  for (const token of expected) if (normalized.includes(token)) hits++;
  return hits >= Math.min(2, expected.length);
}

function extractIdentityName(text: string, expectedName: string | null | undefined): string | undefined {
  if (expectedNameAppears(text, expectedName)) return titleCaseName(expectedName!);
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [
    /(?:^|\b)nome\s*[:\-]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{6,90})(?=\s+(?:doc|cpf|rg|registro|data|nascimento|filia|validade|permiss))/i,
    /(?:^|\b)nome\s*[:\-]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{6,90})/i,
  ];
  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (m?.[1]) {
      const candidate = titleCaseName(m[1].slice(0, 90));
      if (nameTokens(candidate).length >= 2) return candidate;
    }
  }
  return undefined;
}

function extractIdentityDocId(text: string): string | undefined {
  const cpf = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  if (cpf) return cpf[0];
  const rg = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}[- ]?[0-9Xx]\b/);
  if (rg) return rg[0];
  return undefined;
}

function identityOcrFallback(text: string, expectedName?: string | null): ({ classification: ValidatorResponse["classification"]; confidence: number; extracted: ExtractedFields } | null) {
  const n = normalizeText(text);
  const hasBrazilIdSignal = /(republica federativa do brasil|gov br|carteira nacional de habilitacao|registro geral|cedula de identidade|documento nacional de identidade|departamento nacional de transito|denatran)/i.test(n);
  const isCnh = /(carteira nacional de habilitacao|permissao para dirigir|categoria|denatran|renach)/i.test(n);
  const isRg = /(registro geral|cedula de identidade|instituto de identificacao|secretaria de seguranca|orgao expedidor)/i.test(n);
  if (!hasBrazilIdSignal && !isCnh && !isRg) return null;
  const holder = extractIdentityName(text, expectedName);
  const docId = extractIdentityDocId(text);
  if (!holder && !docId && !expectedNameAppears(text, expectedName)) return null;
  const classification: ValidatorResponse["classification"] = isCnh ? "cnh" : isRg ? "rg" : "identity";
  const confidence = holder ? (expectedNameAppears(text, expectedName) ? 0.94 : 0.86) : 0.74;
  return {
    classification,
    confidence,
    extracted: {
      holder_name: holder,
      document_id: docId,
    },
  };
}

function normalizeClassification(c: unknown): ValidatorResponse["classification"] {
  const s = String(c ?? "").toLowerCase();
  if (s === "green_invoice" || s === "other_invoice" || s === "unreadable" || s === "not_invoice") return s;
  return "unreadable";
}

function normalizeIdentityClassification(c: unknown): ValidatorResponse["classification"] {
  const s = String(c ?? "").toLowerCase().trim();
  if (s === "cnh" || s === "rg" || s === "identity" || s === "not_identity" || s === "unreadable") return s as any;
  // Aliases comuns devolvidos pelo LLM.
  if (s.includes("cnh") || s.includes("habilita")) return "cnh";
  if (s.includes("rg") || s.includes("identidade") || s.includes("cédula") || s.includes("cedula")) return "rg";
  if (s.includes("not") || s.includes("fatura") || s.includes("invoice") || s.includes("conta")) return "not_identity";
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