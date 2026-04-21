// Shared helper to download media from Evolution API and upload to whatsapp-media bucket.
// Used by whatsapp-webhook to persist incoming media so the frontend can render images, audio, video, documents.

import { evolutionRequest, normalizeEvolutionUrl } from "./_evolution.ts";

interface DownloadResult {
  base64: string | null;
  mimetype: string | null;
}

/**
 * Calls Evolution API to download media bytes (base64) for a given message key.
 * Tries both common endpoints used across Evolution API versions.
 */
export async function downloadEvolutionMedia(
  evolutionUrl: string,
  evolutionKey: string,
  instanceName: string,
  messageKey: any,
): Promise<DownloadResult> {
  const baseUrl = normalizeEvolutionUrl(evolutionUrl);
  if (!baseUrl) return { base64: null, mimetype: null };

  // Try the most common endpoint first
  const paths = [
    `/chat/getBase64FromMediaMessage/${instanceName}`,
  ];

  for (const path of paths) {
    try {
      const result = await evolutionRequest({
        evolutionUrl: baseUrl,
        evolutionKey,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      });

      if (result.ok && result.data) {
        const data = result.data as any;
        const base64 = data?.base64 || data?.media || data?.body || null;
        const mimetype = data?.mimetype || data?.mediaType || null;
        if (base64) return { base64, mimetype };
      }
    } catch (e) {
      console.error(`downloadEvolutionMedia error on ${path}:`, e);
    }
  }

  return { base64: null, mimetype: null };
}

function base64ToBytes(base64: string): Uint8Array {
  // Strip data URI prefix if present
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extFromMime(mime: string | null, fallback: string): string {
  if (!mime) return fallback;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  const base = mime.split(";")[0].trim().toLowerCase();
  return map[base] || fallback;
}

export interface UploadMediaParams {
  supabase: any;
  scope: string; // e.g. user_id or "system"
  phone: string;
  base64: string;
  mimetype: string | null;
  messageId: string;
  fallbackExt: string; // e.g. "jpg", "ogg", "mp4", "bin"
  filename?: string | null;
}

export interface UploadedMedia {
  url: string;
  mime: string;
  filename: string;
  path: string;
}

/**
 * Uploads media bytes to the public whatsapp-media bucket and returns the public URL.
 */
export async function uploadMediaToStorage(params: UploadMediaParams): Promise<UploadedMedia | null> {
  const { supabase, scope, phone, base64, mimetype, messageId, fallbackExt, filename } = params;
  try {
    const bytes = base64ToBytes(base64);
    const ext = filename?.includes(".")
      ? filename.split(".").pop()!.toLowerCase()
      : extFromMime(mimetype, fallbackExt);
    const finalMime = mimetype?.split(";")[0].trim() || `application/octet-stream`;
    const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${scope}/${phone}/${Date.now()}_${safeId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(path, bytes, {
        contentType: finalMime,
        upsert: false,
      });

    if (uploadError) {
      console.error("uploadMediaToStorage error:", uploadError);
      return null;
    }

    const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    if (!pub?.publicUrl) return null;

    return {
      url: pub.publicUrl,
      mime: finalMime,
      filename: filename || `${safeId}.${ext}`,
      path,
    };
  } catch (e) {
    console.error("uploadMediaToStorage exception:", e);
    return null;
  }
}

/**
 * Convenience: download from Evolution API + upload to storage in one call.
 */
export async function persistEvolutionMedia(opts: {
  supabase: any;
  evolutionUrl: string;
  evolutionKey: string;
  instanceName: string;
  messageKey: any;
  scope: string;
  phone: string;
  messageId: string;
  fallbackExt: string;
  filename?: string | null;
  knownMime?: string | null;
}): Promise<UploadedMedia | null> {
  const { base64, mimetype } = await downloadEvolutionMedia(
    opts.evolutionUrl,
    opts.evolutionKey,
    opts.instanceName,
    opts.messageKey,
  );
  if (!base64) return null;

  return uploadMediaToStorage({
    supabase: opts.supabase,
    scope: opts.scope,
    phone: opts.phone,
    base64,
    mimetype: opts.knownMime || mimetype,
    messageId: opts.messageId,
    fallbackExt: opts.fallbackExt,
    filename: opts.filename ?? null,
  });
}
