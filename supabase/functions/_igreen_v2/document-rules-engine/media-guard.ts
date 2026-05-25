// Guardrail de MIME/tamanho — roda ANTES do validator.
// Whitelist: image/jpeg, image/png, image/webp, application/pdf
// Tamanho: 50KB .. 10MB

export const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const MIN_BYTES = 50 * 1024;
export const MAX_BYTES = 10 * 1024 * 1024;

export interface MediaGuardInput {
  mime_type?: string | null;
  byte_size?: number | null;
  media_url?: string | null;
}

export interface MediaGuardResult {
  ok: boolean;
  reason?: "missing_url" | "invalid_mime" | "missing_mime" | "too_small" | "too_large" | "missing_size";
  detail?: Record<string, unknown>;
}

export function checkMedia(input: MediaGuardInput): MediaGuardResult {
  if (!input.media_url) return { ok: false, reason: "missing_url" };
  const mime = (input.mime_type ?? "").toLowerCase().trim();
  if (!mime) return { ok: false, reason: "missing_mime" };
  if (!ALLOWED_MIMES.has(mime)) {
    return { ok: false, reason: "invalid_mime", detail: { mime } };
  }
  const size = Number(input.byte_size ?? 0);
  if (!size || !Number.isFinite(size)) return { ok: false, reason: "missing_size" };
  if (size < MIN_BYTES) return { ok: false, reason: "too_small", detail: { size, min: MIN_BYTES } };
  if (size > MAX_BYTES) return { ok: false, reason: "too_large", detail: { size, max: MAX_BYTES } };
  return { ok: true };
}