// WAHA (WhatsApp HTTP API) adapter.
// Implementa o mesmo shape de retorno de _evolution.ts (`evolutionRequest`)
// para simplificar a integração via `_wa_provider.ts`.
//
// Docs de referência: https://waha.devlike.pro/
//
// Regras:
// - Autenticação via header `X-Api-Key` (WAHA_API_KEY)
// - Sessão do WhatsApp é chamada de "session" no WAHA (equivalente a instance_name na Evolution)
// - Chat IDs no WAHA usam sufixo `@c.us` (contatos) ou `@g.us` (grupos)

import { reportApiFailure, reportApiSuccess } from "./_health.ts";

export type WahaPayload = Record<string, any> | null;

export interface WahaSuccess {
  ok: true;
  status: number;
  url: string;
  data: WahaPayload;
  text: string;
}

export interface WahaFailure {
  ok: false;
  status: number;
  url: string;
  data: WahaPayload;
  text: string;
}

export type WahaRequestResult = WahaSuccess | WahaFailure;

export function normalizeWahaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function buildHeaders(apiKey: string, headers?: HeadersInit) {
  const h = new Headers(headers);
  h.set("X-Api-Key", apiKey);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  return h;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return { data: null as WahaPayload, text };
  try {
    return { data: JSON.parse(text) as WahaPayload, text };
  } catch {
    return { data: null as WahaPayload, text };
  }
}

export async function wahaRequest({
  wahaUrl,
  wahaKey,
  path,
  method,
  headers,
  body,
}: {
  wahaUrl: string;
  wahaKey: string;
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}): Promise<WahaRequestResult> {
  const normalized = normalizeWahaUrl(wahaUrl);
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${normalized}${resolvedPath}`;

  try {
    const response = await fetch(url, {
      method: method ?? (body ? "POST" : "GET"),
      headers: buildHeaders(wahaKey, headers),
      body,
    });
    const { data, text } = await parseResponse(response);
    if (response.ok) {
      reportApiSuccess("waha_api").catch(() => {});
      return { ok: true, status: response.status, url, data, text };
    }
    if (response.status >= 500 || response.status === 0) {
      reportApiFailure("waha_api", `HTTP ${response.status}: ${(text || "").slice(0, 200)}`).catch(() => {});
    }
    return { ok: false, status: response.status, url, data, text };
  } catch (error) {
    const text = error instanceof Error ? error.message : "Unknown WAHA API error";
    reportApiFailure("waha_api", text).catch(() => {});
    return { ok: false, status: 0, url, data: null, text };
  }
}

// ---------- Helpers de formato ----------

/**
 * Converte um número BR normalizado (13 dígitos "55DDDNNNNNNNNN") ou similar
 * para o chatId WAHA `<digits>@c.us`. Se já vier com @, retorna como está.
 */
export function wahaChatId(phone: string): string {
  const s = String(phone || "").trim();
  if (!s) return s;
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  return `${digits}@c.us`;
}

export function stripWahaSuffix(chatId: string): string {
  return String(chatId || "").replace(/@[a-z.]+$/i, "").replace(/\D/g, "");
}

export function buildWahaErrorPayload(result: WahaFailure, fallback: string) {
  const providerMessage =
    (typeof result.data?.message === "string" && result.data.message) ||
    (typeof result.data?.error === "string" && result.data.error) ||
    null;

  const isUnauthorized = result.status === 401 || result.status === 403;
  const error = isUnauthorized
    ? `WAHA API recusou a autenticação (${result.status}). Verifique WAHA_API_KEY.`
    : providerMessage
      ? `${fallback}: ${providerMessage}`
      : result.status
        ? `${fallback} (HTTP ${result.status}).`
        : fallback;

  return {
    ok: false,
    error,
    diagnostics: {
      provider: "waha_api",
      status: result.status,
      url: result.url,
      body_preview: (result.text || "").slice(0, 240) || null,
    },
  };
}

// ---------- Operações de envio ----------

export async function wahaSendText(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  phone: string;
  text: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: "/api/sendText",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: opts.session,
      chatId: wahaChatId(opts.phone),
      text: opts.text,
    }),
  });
}

/**
 * Envia mídia via WAHA. Aceita URL pública (`file.url`) ou base64 (`file.data`).
 * mediaType: 'image' | 'video' | 'audio' | 'document'.
 */
export async function wahaSendMedia(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  phone: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mediaType: "image" | "video" | "audio" | "document";
  mimetype?: string;
  filename?: string;
  caption?: string;
}): Promise<WahaRequestResult> {
  const endpointMap = {
    image: "/api/sendImage",
    video: "/api/sendVideo",
    audio: "/api/sendVoice",
    document: "/api/sendFile",
  } as const;

  const file: Record<string, any> = {};
  if (opts.mediaUrl) file.url = opts.mediaUrl;
  if (opts.mediaBase64) file.data = opts.mediaBase64;
  if (opts.mimetype) file.mimetype = opts.mimetype;
  if (opts.filename) file.filename = opts.filename;

  const body: Record<string, any> = {
    session: opts.session,
    chatId: wahaChatId(opts.phone),
    file,
  };
  if (opts.caption && opts.mediaType !== "audio") body.caption = opts.caption;

  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: endpointMap[opts.mediaType],
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- Presença ----------

export async function wahaStartTyping(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  phone: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: "/api/startTyping",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: opts.session,
      chatId: wahaChatId(opts.phone),
    }),
  });
}

export async function wahaStopTyping(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  phone: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: "/api/stopTyping",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: opts.session,
      chatId: wahaChatId(opts.phone),
    }),
  });
}

// ---------- Instância / sessão ----------

export async function wahaSessionStatus(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}`,
    method: "GET",
  });
}

export async function wahaSessionCreate(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  webhookUrl?: string;
  events?: string[];
  phoneNumber?: string | null;
}): Promise<WahaRequestResult> {
  const config: Record<string, any> = {};
  if (opts.webhookUrl) {
    config.webhooks = [
      {
        url: opts.webhookUrl,
        events: opts.events && opts.events.length
          ? opts.events
          : ["message.any", "session.status"],
        retries: { policy: "linear", delaySeconds: 2, attempts: 5 },
      },
    ];
  }
  const body: Record<string, any> = {
    name: opts.session,
    start: true,
    config,
  };
  if (opts.phoneNumber) body.phoneNumber = opts.phoneNumber;

  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: "/api/sessions",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function wahaSessionStart(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}/start`,
    method: "POST",
  });
}

/**
 * Atualiza a config da sessão (webhooks, eventos). WAHA aceita PUT em /api/sessions/{session}.
 */
export async function wahaSessionUpdate(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  webhookUrl: string;
  events?: string[];
}): Promise<WahaRequestResult> {
  const events = opts.events && opts.events.length ? opts.events : ["message.any", "session.status"];
  const body = {
    config: {
      webhooks: [
        {
          url: opts.webhookUrl,
          events,
          retries: { policy: "linear", delaySeconds: 2, attempts: 5 },
        },
      ],
    },
  };
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}`,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function wahaSessionStop(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}/stop`,
    method: "POST",
  });
}

export async function wahaSessionLogout(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}/logout`,
    method: "POST",
  });
}

export async function wahaSessionDelete(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<WahaRequestResult> {
  return wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/sessions/${encodeURIComponent(opts.session)}`,
    method: "DELETE",
  });
}

export async function wahaGetQrCode(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
}): Promise<{ base64: string | null; raw: WahaRequestResult }> {
  const raw = await wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/${encodeURIComponent(opts.session)}/auth/qr?format=image`,
    method: "GET",
  });
  if (!raw.ok) return { base64: null, raw };
  const data: any = raw.data || {};
  // WAHA retorna { mimetype, data } (base64) ou { value } (string base64)
  const b64 = data?.data || data?.value || data?.base64 || null;
  return { base64: typeof b64 === "string" ? b64 : null, raw };
}

export async function wahaCheckNumberExists(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  phone: string;
}): Promise<string | null> {
  // (unchanged)
  const digits = String(opts.phone || "").replace(/\D/g, "");
  const res = await wahaRequest({
    wahaUrl: opts.wahaUrl,
    wahaKey: opts.wahaKey,
    path: `/api/contacts/check-exists?session=${encodeURIComponent(opts.session)}&phone=${encodeURIComponent(digits)}`,
    method: "GET",
  });
  if (!res.ok) return null;
  const data: any = res.data || {};
  if (data?.numberExists && (data?.chatId || data?.jid)) {
    return stripWahaSuffix(data.chatId || data.jid);
  }
  return null;
}

/**
 * Resolve um chatId real (@c.us) a partir de um LID (@lid). Retorna null se o WAHA não conseguir.
 * Docs: GET /api/{session}/lids/{lid}
 */
export async function wahaResolveLid(opts: {
  wahaUrl: string;
  wahaKey: string;
  session: string;
  lid: string; // formato "12345678901234@lid" ou "12345678901234"
}): Promise<string | null> {
  const lidValue = String(opts.lid || "").split("@")[0].replace(/\D/g, "");
  if (!lidValue) return null;

  // Tentativa 1: endpoint oficial /api/{session}/lids/{lid}
  const attempts = [
    `/api/${encodeURIComponent(opts.session)}/lids/${encodeURIComponent(lidValue)}`,
    `/api/${encodeURIComponent(opts.session)}/lids/${encodeURIComponent(lidValue + "@lid")}`,
    `/api/lids/${encodeURIComponent(lidValue)}?session=${encodeURIComponent(opts.session)}`,
  ];
  for (const path of attempts) {
    const res = await wahaRequest({ wahaUrl: opts.wahaUrl, wahaKey: opts.wahaKey, path, method: "GET" });
    if (res.ok) {
      const d: any = res.data || {};
      const chatId = d?.chatId || d?.pn || d?.jid || d?.phoneNumber || null;
      if (typeof chatId === "string" && /\d/.test(chatId)) {
        const digits = chatId.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15) {
          console.log(`[waha] LID ${lidValue} resolvido via ${path} → ${digits}`);
          return `${digits}@c.us`;
        }
      }
    } else {
      console.log(`[waha] tentativa LID falhou (${res.status}) em ${path}`);
    }
  }

  // Tentativa 2: /api/contacts?contactId={lid}@lid&session=... (retorna contato se WAHA já indexou)
  const contactPaths = [
    `/api/contacts?contactId=${encodeURIComponent(lidValue + "@lid")}&session=${encodeURIComponent(opts.session)}`,
    `/api/contacts?contactId=${encodeURIComponent(lidValue + "@c.us")}&session=${encodeURIComponent(opts.session)}`,
  ];
  for (const path of contactPaths) {
    const res = await wahaRequest({ wahaUrl: opts.wahaUrl, wahaKey: opts.wahaKey, path, method: "GET" });
    if (res.ok) {
      const d: any = res.data || {};
      const candidate =
        d?.id?._serialized || d?.id || d?.number || d?.jid || d?.phoneNumber || d?.pn || null;
      if (typeof candidate === "string" && /\d/.test(candidate) && !candidate.includes("@lid")) {
        const digits = candidate.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15) {
          console.log(`[waha] LID ${lidValue} resolvido via contacts → ${digits}`);
          return `${digits}@c.us`;
        }
      }
    }
  }

  console.log(`[waha] LID ${lidValue} não pôde ser resolvido em nenhum endpoint`);
  return null;
}

/**
 * Baixa uma mídia hospedada no WAHA (URL retornada em payload.media.url) autenticando com X-Api-Key.
 * Retorna base64 puro (sem prefixo data:) e o mime detectado.
 */
export async function wahaDownloadMediaBase64(opts: {
  wahaUrl: string;
  wahaKey: string;
  mediaUrl: string;
}): Promise<{ base64: string; mime: string; size: number } | null> {
  try {
    // WAHA frequentemente retorna URLs com host interno (ex: http://localhost:3000/api/files/...)
    // que não são alcançáveis a partir do edge. Reescrevemos o host para o WAHA_API_URL público.
    let finalUrl = opts.mediaUrl;
    try {
      const u = new URL(opts.mediaUrl);
      const looksInternal =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "0.0.0.0" ||
        u.hostname.endsWith(".local") ||
        u.pathname.startsWith("/api/files/");
      if (looksInternal && opts.wahaUrl) {
        const base = new URL(opts.wahaUrl.replace(/\/+$/, ""));
        finalUrl = `${base.origin}${u.pathname}${u.search}`;
      }
    } catch (_) { /* mantém original */ }

    // Se a URL final for do próprio WAHA, autentica; se for pública (S3, etc.), tenta sem header
    const isWahaHosted = finalUrl.startsWith(opts.wahaUrl) || finalUrl.includes("/api/files/");
    const headers: HeadersInit = isWahaHosted ? { "X-Api-Key": opts.wahaKey } : {};
    const resp = await fetch(finalUrl, { headers });
    if (!resp.ok) {
      console.error("wahaDownloadMediaBase64: HTTP", resp.status, finalUrl.slice(0, 160));
      return null;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    const mime = resp.headers.get("content-type") || "application/octet-stream";
    // Convert to base64
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const base64 = btoa(bin);
    return { base64, mime, size: buf.length };
  } catch (e) {
    console.error("wahaDownloadMediaBase64 error:", (e as Error).message);
    return null;
  }
}

/**
 * Extrai o messageId da resposta de POST /api/sendText|sendImage|... do WAHA.
 * WAHA retorna algo como { id: "true_5511999999999@c.us_ABCDEF..." } ou {_data: { id: {...} }, id: "..." }.
 */
export function extractWahaMessageId(result: WahaRequestResult | null | undefined): string | null {
  if (!result || !result.ok) return null;
  const d: any = result.data || {};
  const id =
    d?.id?._serialized ||
    d?.id ||
    d?._data?.id?._serialized ||
    d?.key?.id ||
    d?.messageId ||
    null;
  return typeof id === "string" ? id : null;
}
