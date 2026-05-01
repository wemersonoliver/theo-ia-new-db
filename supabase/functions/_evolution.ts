import { reportApiFailure, reportApiSuccess } from "./_health.ts";

const EVOLUTION_AUTH_MODES = ["apikey", "bearer", "both"] as const;

export type EvolutionAuthMode = (typeof EVOLUTION_AUTH_MODES)[number];

type EvolutionPayload = Record<string, any> | null;

export interface EvolutionSuccess {
  ok: true;
  status: number;
  url: string;
  authMode: EvolutionAuthMode;
  data: EvolutionPayload;
  text: string;
}

export interface EvolutionFailure {
  ok: false;
  status: number;
  url: string;
  authMode: EvolutionAuthMode;
  data: EvolutionPayload;
  text: string;
}

export type EvolutionRequestResult = EvolutionSuccess | EvolutionFailure;

export function normalizeEvolutionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, "").replace(/\/manager$/i, "");
}

function buildAuthHeaders(
  evolutionKey: string,
  mode: EvolutionAuthMode,
  headers?: HeadersInit,
) {
  const resolvedHeaders = new Headers(headers);

  if (mode === "apikey" || mode === "both") {
    resolvedHeaders.set("apikey", evolutionKey);
  }

  if (mode === "bearer" || mode === "both") {
    resolvedHeaders.set("Authorization", `Bearer ${evolutionKey}`);
  }

  return resolvedHeaders;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return { data: null, text };

  try {
    return { data: JSON.parse(text) as EvolutionPayload, text };
  } catch {
    return { data: null, text };
  }
}

function getOrderedAuthModes(preferredAuthMode?: EvolutionAuthMode) {
  if (!preferredAuthMode) return EVOLUTION_AUTH_MODES;
  return [
    preferredAuthMode,
    ...EVOLUTION_AUTH_MODES.filter((mode) => mode !== preferredAuthMode),
  ] as const;
}

export async function evolutionRequest({
  evolutionUrl,
  evolutionKey,
  path,
  method,
  headers,
  body,
  preferredAuthMode,
}: {
  evolutionUrl: string;
  evolutionKey: string;
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  preferredAuthMode?: EvolutionAuthMode;
}): Promise<EvolutionRequestResult> {
  const normalizedUrl = normalizeEvolutionUrl(evolutionUrl);
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${normalizedUrl}${resolvedPath}`;

  let lastFailure: EvolutionFailure | null = null;

  for (const authMode of getOrderedAuthModes(preferredAuthMode)) {
    try {
      const response = await fetch(url, {
        method: method ?? (body ? "POST" : "GET"),
        headers: buildAuthHeaders(evolutionKey, authMode, headers),
        body,
      });

      const { data, text } = await parseResponse(response);
      if (response.ok) {
        reportApiSuccess("evolution_api").catch(() => {});
        return { ok: true, status: response.status, url, authMode, data, text };
      }

      lastFailure = { ok: false, status: response.status, url, authMode, data, text };
      if (![401, 403].includes(response.status)) {
        // Erros 5xx e timeouts indicam API fora; 4xx (exceto 401/403) podem ser problemas de payload
        if (response.status >= 500 || response.status === 0) {
          reportApiFailure("evolution_api", `HTTP ${response.status}: ${(text || "").slice(0, 200)}`).catch(() => {});
        }
        return lastFailure;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unknown Evolution API error";
      reportApiFailure("evolution_api", text).catch(() => {});
      return { ok: false, status: 0, url, authMode, data: null, text };
    }
  }

  if (lastFailure && (lastFailure.status >= 500 || lastFailure.status === 0 || lastFailure.status === 401 || lastFailure.status === 403)) {
    reportApiFailure("evolution_api", `HTTP ${lastFailure.status}: ${(lastFailure.text || "").slice(0, 200)}`).catch(() => {});
  }
  return lastFailure ?? { ok: false, status: 0, url, authMode: "apikey", data: null, text: "Unknown Evolution API error" };
}

function pickErrorMessage(data: EvolutionPayload) {
  const candidates = [
    data?.response?.message,
    data?.message,
    data?.error,
    data?.details,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function buildEvolutionErrorPayload(result: EvolutionFailure, fallback: string) {
  const providerMessage = pickErrorMessage(result.data);
  const isUnauthorized = result.status === 401 || result.status === 403;
  const error = isUnauthorized
    ? `Evolution API recusou a autenticação (${result.status}). Verifique a EVOLUTION_API_KEY e o formato aceito pelo servidor.`
    : providerMessage
      ? `${fallback}: ${providerMessage}`
      : result.status
        ? `${fallback} (HTTP ${result.status}).`
        : fallback;

  return {
    ok: false,
    error,
    diagnostics: {
      provider: "evolution_api",
      status: result.status,
      auth_mode: result.authMode,
      url: result.url,
      body_preview: (result.text || "").slice(0, 240) || null,
    },
  };
}

export function getEvolutionErrorMessage(result: EvolutionFailure, fallback: string) {
  return buildEvolutionErrorPayload(result, fallback).error;
}