// Camada de abstração de provedor WhatsApp (Evolution ou WAHA).
//
// Uso típico:
//   const ctx = await resolveInstanceContext(supabase, { instanceId });
//   await sendWhatsAppText(ctx, phone, "olá");
//
// Toda edge function que hoje chama evolutionRequest diretamente deve migrar
// gradualmente para esses helpers. Enquanto isso, callers legados continuam
// funcionando via Evolution (compatibilidade preservada).

import {
  buildEvolutionErrorPayload,
  evolutionRequest,
  normalizeEvolutionUrl,
  type EvolutionRequestResult,
} from "./_evolution.ts";
import {
  buildWahaErrorPayload,
  normalizeWahaUrl,
  wahaChatId,
  wahaGetQrCode,
  wahaSendMedia,
  wahaSendText,
  wahaSessionCreate,
  wahaSessionDelete,
  wahaSessionLogout,
  wahaSessionStart,
  wahaSessionStatus,
  wahaStartTyping,
  wahaStopTyping,
  wahaCheckNumberExists,
  extractWahaMessageId,
  stripWahaSuffix,
  wahaResolveLid,
  type WahaRequestResult,
} from "./_waha.ts";
import {
  getBrazilianPhoneVariant,
  normalizeBrazilianPhone,
  resolveExistingWhatsappJid,
  resolvePreferredWhatsappChatNumber,
} from "./_phone.ts";

export type WaProvider = "evolution" | "waha";

export interface WaInstanceContext {
  provider: WaProvider;
  instanceName: string;         // Nome usado na Evolution API
  wahaSession: string;          // Nome da sessão WAHA (fallback = instanceName)
  status: string | null;
  system?: boolean;
  // Credenciais resolvidas em ambiente:
  evolutionUrl?: string | null;
  evolutionKey?: string | null;
  wahaUrl?: string | null;
  wahaKey?: string | null;
}

export interface WaSendResult {
  ok: boolean;
  provider: WaProvider;
  status: number;
  errorPayload?: Record<string, unknown>;
  raw?: EvolutionRequestResult | WahaRequestResult;
  /** Id da mensagem retornado pelo provider (para dedupe/rastreio no webhook). */
  messageId?: string | null;
  /** ChatId real usado no envio (útil para gravar em whatsapp_conversations.wa_chat_id). */
  waChatId?: string | null;
}

function getEvolutionCreds() {
  return {
    evolutionUrl: normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL")),
    evolutionKey: Deno.env.get("EVOLUTION_API_KEY") ?? null,
  };
}

function getWahaCreds() {
  return {
    wahaUrl: normalizeWahaUrl(Deno.env.get("WAHA_API_URL")),
    wahaKey: Deno.env.get("WAHA_API_KEY") ?? null,
  };
}

function ctxHasCreds(ctx: WaInstanceContext): { ok: boolean; error?: string } {
  if (ctx.provider === "evolution") {
    if (!ctx.evolutionUrl || !ctx.evolutionKey) {
      return { ok: false, error: "Evolution API não configurada" };
    }
  } else {
    if (!ctx.wahaUrl || !ctx.wahaKey) {
      return { ok: false, error: "WAHA API não configurada (defina WAHA_API_URL e WAHA_API_KEY)" };
    }
  }
  return { ok: true };
}

/**
 * Resolve o contexto (provider + credenciais) de uma instância do banco.
 * Aceita id direto ou (instance_name), ou instância do sistema (system=true).
 */
export async function resolveInstanceContext(
  supabase: any,
  opts: {
    instanceId?: string | null;
    instanceName?: string | null;
    accountId?: string | null;
    userId?: string | null;
    system?: boolean;
  },
): Promise<WaInstanceContext | null> {
  const evo = getEvolutionCreds();
  const waha = getWahaCreds();

  if (opts.system) {
    const { data } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status, provider, waha_session_name")
      .maybeSingle();
    if (!data) return null;
    const provider = (data.provider === "waha" ? "waha" : "evolution") as WaProvider;
    return {
      provider,
      instanceName: data.instance_name,
      wahaSession: data.waha_session_name || data.instance_name,
      status: data.status ?? null,
      system: true,
      ...evo,
      ...waha,
    };
  }

  let query = supabase
    .from("whatsapp_instances")
    .select("id, instance_name, status, provider, waha_session_name, account_id, user_id, is_primary");

  if (opts.instanceId) {
    query = query.eq("id", opts.instanceId).limit(1);
  } else if (opts.instanceName) {
    query = query.eq("instance_name", opts.instanceName).limit(1);
  } else if (opts.accountId) {
    query = query.eq("account_id", opts.accountId).order("is_primary", { ascending: false }).limit(1);
  } else if (opts.userId) {
    query = query.eq("user_id", opts.userId).limit(1);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const provider = (data.provider === "waha" ? "waha" : "evolution") as WaProvider;
  return {
    provider,
    instanceName: data.instance_name,
    wahaSession: data.waha_session_name || data.instance_name,
    status: data.status ?? null,
    ...evo,
    ...waha,
  };
}

// -------- Envio de texto (com fallback do "9º dígito" para BR) --------

export async function sendWhatsAppText(
  ctx: WaInstanceContext,
  phone: string,
  text: string,
  opts?: { waChatId?: string | null },
): Promise<WaSendResult> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) {
    return {
      ok: false, provider: ctx.provider, status: 500,
      errorPayload: { ok: false, error: creds.error! },
    };
  }

  const normalized = normalizeBrazilianPhone(phone);

  if (ctx.provider === "waha") {
    // 1) Se já temos o wa_chat_id salvo (mensagem prévia), usar direto — é o formato canônico do WAHA.
    let chatId = (opts?.waChatId || "").trim() || null;

    // 2) Sem wa_chat_id, tentar resolver via check-exists (regra oficial BR: escolhe com ou sem 9)
    if (!chatId) {
      const resolved = await wahaCheckNumberExists({
        wahaUrl: ctx.wahaUrl!,
        wahaKey: ctx.wahaKey!,
        session: ctx.wahaSession,
        phone: normalized,
      }).catch(() => null);
      if (resolved) chatId = `${resolved}@c.us`;
    }

    // 3) Também tenta variante BR se check-exists falhou
    if (!chatId) {
      const variant = getBrazilianPhoneVariant(normalized);
      if (variant) {
        const alt = await wahaCheckNumberExists({
          wahaUrl: ctx.wahaUrl!,
          wahaKey: ctx.wahaKey!,
          session: ctx.wahaSession,
          phone: variant,
        }).catch(() => null);
        if (alt) chatId = `${alt}@c.us`;
      }
    }

    // 4) Fallback final: usar o número normalizado bruto
    const sendChatId = chatId || `${normalized}@c.us`;

    const res = await wahaSendText({
      wahaUrl: ctx.wahaUrl!,
      wahaKey: ctx.wahaKey!,
      session: ctx.wahaSession,
      phone: sendChatId,
      text,
    });
    if (!res.ok) {
      return {
        ok: false, provider: "waha", status: res.status,
        errorPayload: buildWahaErrorPayload(res, "Erro ao enviar mensagem"),
        raw: res,
      };
    }
    return {
      ok: true,
      provider: "waha",
      status: res.status,
      raw: res,
      messageId: extractWahaMessageId(res),
      waChatId: sendChatId,
    };
  }

  // Evolution (com resolução de JID)
  const resolvedChatNumber = await resolvePreferredWhatsappChatNumber({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    instanceName: ctx.instanceName,
    phone: normalized,
  });
  const resolvedJid = await resolveExistingWhatsappJid({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    instanceName: ctx.instanceName,
    phone: normalized,
  });
  const candidates: string[] = [];
  if (resolvedChatNumber) candidates.push(resolvedChatNumber);
  if (resolvedJid && !candidates.includes(resolvedJid)) candidates.push(resolvedJid);
  if (!candidates.includes(normalized)) candidates.push(normalized);
  const variant = getBrazilianPhoneVariant(normalized);
  if (variant && !candidates.includes(variant)) candidates.push(variant);

  let last: EvolutionRequestResult | null = null;
  for (const candidate of candidates) {
    last = await evolutionRequest({
      evolutionUrl: ctx.evolutionUrl!,
      evolutionKey: ctx.evolutionKey!,
      path: `/message/sendText/${ctx.instanceName}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: candidate, text }),
    });
    if (last.ok) break;
    const body = last.text || "";
    const invalid = last.status === 400 || last.status === 404 ||
      /not.?exists|invalid.?number|number.?does.?not|not.?in.?whatsapp|jid/i.test(body);
    if (!invalid) break;
  }
  if (!last || !last.ok) {
    return {
      ok: false, provider: "evolution", status: last?.status ?? 0,
      errorPayload: last ? buildEvolutionErrorPayload(last, "Erro ao enviar mensagem") : { ok: false, error: "Envio falhou" },
      raw: last ?? undefined,
    };
  }
  return { ok: true, provider: "evolution", status: last.status, raw: last };
}

// -------- Envio de mídia --------

export async function sendWhatsAppMedia(
  ctx: WaInstanceContext,
  opts: {
    phone: string;
    mediaUrl?: string;
    mediaBase64?: string;
    mediaType: "image" | "video" | "audio" | "document";
    mimetype?: string;
    filename?: string;
    caption?: string;
    waChatId?: string | null;
  },
): Promise<WaSendResult> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) {
    return {
      ok: false, provider: ctx.provider, status: 500,
      errorPayload: { ok: false, error: creds.error! },
    };
  }

  const normalized = normalizeBrazilianPhone(opts.phone);

  if (ctx.provider === "waha") {
    let chatId = (opts.waChatId || "").trim() || null;
    if (!chatId) {
      const resolved = await wahaCheckNumberExists({
        wahaUrl: ctx.wahaUrl!,
        wahaKey: ctx.wahaKey!,
        session: ctx.wahaSession,
        phone: normalized,
      }).catch(() => null);
      if (resolved) chatId = `${resolved}@c.us`;
    }
    if (!chatId) {
      const variant = getBrazilianPhoneVariant(normalized);
      if (variant) {
        const alt = await wahaCheckNumberExists({
          wahaUrl: ctx.wahaUrl!,
          wahaKey: ctx.wahaKey!,
          session: ctx.wahaSession,
          phone: variant,
        }).catch(() => null);
        if (alt) chatId = `${alt}@c.us`;
      }
    }
    const sendChatId = chatId || `${normalized}@c.us`;

    const res = await wahaSendMedia({
      wahaUrl: ctx.wahaUrl!,
      wahaKey: ctx.wahaKey!,
      session: ctx.wahaSession,
      phone: sendChatId,
      mediaUrl: opts.mediaUrl,
      mediaBase64: opts.mediaBase64,
      mediaType: opts.mediaType,
      mimetype: opts.mimetype,
      filename: opts.filename,
      caption: opts.caption,
    });
    if (!res.ok) {
      return {
        ok: false, provider: "waha", status: res.status,
        errorPayload: buildWahaErrorPayload(res, "Erro ao enviar mídia"),
        raw: res,
      };
    }
    return {
      ok: true,
      provider: "waha",
      status: res.status,
      raw: res,
      messageId: extractWahaMessageId(res),
      waChatId: sendChatId,
    };
  }

  // Evolution
  const isAudio = opts.mediaType === "audio";
  const path = isAudio
    ? `/message/sendWhatsAppAudio/${ctx.instanceName}`
    : `/message/sendMedia/${ctx.instanceName}`;

  const candidates = [normalized];
  const variant = getBrazilianPhoneVariant(normalized);
  if (variant && variant !== normalized) candidates.push(variant);

  let last: EvolutionRequestResult | null = null;
  for (const candidate of candidates) {
    const reqBody = isAudio
      ? { number: candidate, audio: opts.mediaUrl || opts.mediaBase64 }
      : {
          number: candidate,
          mediatype: opts.mediaType,
          mimetype: opts.mimetype || undefined,
          caption: opts.caption || undefined,
          media: opts.mediaUrl || opts.mediaBase64,
          fileName: opts.filename || undefined,
        };
    last = await evolutionRequest({
      evolutionUrl: ctx.evolutionUrl!,
      evolutionKey: ctx.evolutionKey!,
      path,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });
    if (last.ok) break;
    const body = last.text || "";
    const invalid = last.status === 400 || last.status === 404 ||
      /not.?exists|invalid.?number|number.?does.?not|not.?in.?whatsapp|jid/i.test(body);
    if (!invalid) break;
  }
  if (!last || !last.ok) {
    return {
      ok: false, provider: "evolution", status: last?.status ?? 0,
      errorPayload: last ? buildEvolutionErrorPayload(last, "Erro ao enviar mídia") : { ok: false, error: "Envio falhou" },
      raw: last ?? undefined,
    };
  }
  return { ok: true, provider: "evolution", status: last.status, raw: last };
}

// -------- Presença (composing / recording) --------

export async function setWhatsAppPresence(
  ctx: WaInstanceContext,
  opts: { phone: string; presence: "composing" | "recording" | "paused"; delayMs?: number; waChatId?: string | null },
): Promise<void> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) return;

  if (ctx.provider === "waha") {
    // Resolver o chatId real igual ao envio de mensagens. Se o typing for
    // enviado com um chatId inexistente (ex.: número com 9 mas WA sem 9),
    // o WAHA aceita silenciosamente e nenhum "digitando..." aparece.
    let chatId = (opts.waChatId || "").trim() || null;
    const normalized = normalizeBrazilianPhone(opts.phone);
    if (!chatId) {
      try {
        const resolved = await wahaCheckNumberExists({
          wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession, phone: normalized,
        });
        if (resolved) chatId = `${resolved}@c.us`;
      } catch (_) { /* ignore */ }
    }
    if (!chatId) {
      const variant = getBrazilianPhoneVariant(normalized);
      if (variant) {
        try {
          const alt = await wahaCheckNumberExists({
            wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession, phone: variant,
          });
          if (alt) chatId = `${alt}@c.us`;
        } catch (_) { /* ignore */ }
      }
    }
    const finalChatId = chatId || `${normalized}@c.us`;

    if (opts.presence === "paused") {
      const r = await wahaStopTyping({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession, phone: finalChatId });
      if (!r.ok) console.error(`[waha:stopTyping] status=${r.status} body=${(r.text || "").slice(0, 200)}`);
      return;
    }
    const r = await wahaStartTyping({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession, phone: finalChatId });
    if (!r.ok) {
      console.error(`[waha:startTyping] status=${r.status} chatId=${finalChatId} body=${(r.text || "").slice(0, 200)}`);
    } else {
      console.log(`[waha:startTyping] ok chatId=${finalChatId}`);
    }
    if (opts.delayMs && opts.delayMs > 0) {
      setTimeout(() => {
        wahaStopTyping({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession, phone: finalChatId }).catch(() => {});
      }, opts.delayMs);
    }
    return;
  }

  await evolutionRequest({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    path: `/chat/presence/${ctx.instanceName}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      number: opts.phone,
      delay: opts.delayMs ?? 1200,
      presence: opts.presence,
    }),
  }).catch(() => {});
}

// -------- Gestão de instância / sessão --------

export interface WaConnectResult {
  ok: boolean;
  status: number;
  qrCodeBase64?: string | null;
  pairingCode?: string | null;
  error?: string;
  raw?: unknown;
}

export async function waConnect(
  ctx: WaInstanceContext,
  opts: { phoneNumber?: string | null; webhookUrl?: string } = {},
): Promise<WaConnectResult> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) return { ok: false, status: 500, error: creds.error };

  if (ctx.provider === "waha") {
    const wahaUrl = ctx.wahaUrl!;
    const wahaKey = ctx.wahaKey!;
    const session = ctx.wahaSession;

    // 1) Verifica estado atual
    let statusRes = await wahaSessionStatus({ wahaUrl, wahaKey, session });
    let sessionState = String((statusRes.data as any)?.status || (statusRes.data as any)?.state || "").toUpperCase();

    // 2) Se sessão não existe (404), cria
    if (!statusRes.ok && statusRes.status === 404) {
      const create = await wahaSessionCreate({
        wahaUrl, wahaKey, session,
        webhookUrl: opts.webhookUrl,
        phoneNumber: opts.phoneNumber ?? null,
      });
      if (!create.ok && create.status !== 422 && create.status !== 409) {
        const err = buildWahaErrorPayload(create as any, "Erro ao criar sessão WAHA");
        return { ok: false, status: create.status, error: err.error, raw: create };
      }
      // dá tempo pra sessão inicializar
      await new Promise((r) => setTimeout(r, 1500));
      statusRes = await wahaSessionStatus({ wahaUrl, wahaKey, session });
      sessionState = String((statusRes.data as any)?.status || "").toUpperCase();
    }

    // 3) Se STOPPED/FAILED, dá start
    if (sessionState === "STOPPED" || sessionState === "FAILED") {
      const started = await wahaSessionStart({ wahaUrl, wahaKey, session });
      if (!started.ok && started.status !== 422) {
        const err = buildWahaErrorPayload(started as any, "Erro ao iniciar sessão WAHA");
        return { ok: false, status: started.status, error: err.error, raw: started };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 4) Se já autenticado, retorna ok sem QR
    if (sessionState === "WORKING") {
      return { ok: true, status: 200, qrCodeBase64: null, pairingCode: null, raw: statusRes };
    }

    // 5) Poll curto até SCAN_QR_CODE (até ~6s)
    for (let i = 0; i < 6; i++) {
      const s = await wahaSessionStatus({ wahaUrl, wahaKey, session });
      const st = String((s.data as any)?.status || "").toUpperCase();
      if (st === "SCAN_QR_CODE" || st === "WORKING") { sessionState = st; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (sessionState === "WORKING") {
      return { ok: true, status: 200, qrCodeBase64: null, pairingCode: null };
    }

    // 6) Busca QR
    const qr = await wahaGetQrCode({ wahaUrl, wahaKey, session });
    if (!qr.raw.ok && !qr.base64) {
      const err = buildWahaErrorPayload(qr.raw as any, `Erro ao obter QR WAHA (session=${sessionState || "desconhecido"})`);
      return { ok: false, status: qr.raw.status, error: err.error, raw: qr.raw };
    }
    return {
      ok: true,
      status: qr.raw.status,
      qrCodeBase64: qr.base64,
      pairingCode: null,
      raw: qr.raw,
    };
  }

  // Evolution
  const conn = await evolutionRequest({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    path: opts.phoneNumber
      ? `/instance/connect/${ctx.instanceName}?number=${encodeURIComponent(opts.phoneNumber)}`
      : `/instance/connect/${ctx.instanceName}`,
  });
  if (!conn.ok) {
    const err = buildEvolutionErrorPayload(conn, "Erro ao conectar instância");
    return { ok: false, status: conn.status, error: err.error, raw: conn };
  }
  const d: any = conn.data ?? {};
  const qrRaw = d.base64 || d.qrcode?.base64 || d.qrcode || null;
  const qrCodeBase64 = typeof qrRaw === "string"
    ? (qrRaw.startsWith("data:image") ? (qrRaw.split(",")[1] || null) : qrRaw)
    : null;
  const pairingCode = d.pairingCode || d.qrcode?.pairingCode || null;
  return { ok: true, status: conn.status, qrCodeBase64, pairingCode, raw: conn };
}

export async function waLogout(ctx: WaInstanceContext): Promise<void> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) return;
  if (ctx.provider === "waha") {
    await wahaSessionLogout({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession }).catch(() => {});
    return;
  }
  await evolutionRequest({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    path: `/instance/logout/${ctx.instanceName}`,
    method: "DELETE",
  }).catch(() => {});
}

export async function waDelete(ctx: WaInstanceContext): Promise<void> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) return;
  if (ctx.provider === "waha") {
    await wahaSessionDelete({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession }).catch(() => {});
    return;
  }
  await evolutionRequest({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    path: `/instance/delete/${ctx.instanceName}`,
    method: "DELETE",
  }).catch(() => {});
}

export async function waConnectionState(ctx: WaInstanceContext): Promise<{ state: string | null; raw: unknown }> {
  const creds = ctxHasCreds(ctx);
  if (!creds.ok) return { state: null, raw: null };
  if (ctx.provider === "waha") {
    const r = await wahaSessionStatus({ wahaUrl: ctx.wahaUrl!, wahaKey: ctx.wahaKey!, session: ctx.wahaSession });
    const d: any = r.data || {};
    // WAHA status: STARTING | SCAN_QR_CODE | WORKING | FAILED | STOPPED
    const s = String(d?.status || d?.state || "").toUpperCase();
    const state = s === "WORKING" ? "open" : (s === "SCAN_QR_CODE" ? "qr" : s.toLowerCase() || null);
    return { state, raw: r };
  }
  const r = await evolutionRequest({
    evolutionUrl: ctx.evolutionUrl!,
    evolutionKey: ctx.evolutionKey!,
    path: `/instance/connectionState/${ctx.instanceName}`,
  });
  const d: any = r.data || {};
  const state = String(d?.state ?? d?.status ?? d?.instance?.state ?? d?.instance?.status ?? "").toLowerCase() || null;
  return { state, raw: r };
}

// Helper: quando o webhook recebe payload WAHA, converte para o formato interno
// esperado pelo processador (mesmo shape dos eventos Evolution: {event, instance, data}).
// Uso previsto no webhook: se detectar `session` no body, chamar `wahaToInternalEvent`.
export function isWahaWebhookPayload(body: any): boolean {
  if (!body || typeof body !== "object") return false;
  return typeof body.session === "string" && typeof body.event === "string";
}

/**
 * Normaliza um evento WAHA para o formato Evolution que o whatsapp-webhook já processa.
 * Suporta apenas os eventos usados hoje ("message" ~= "messages.upsert", "session.status" ~= "connection.update").
 */
export async function wahaToInternalEvent(body: any): Promise<{ event: string; instance: string; data: any } | null> {
  if (!isWahaWebhookPayload(body)) return null;
  const session = String(body.session);
  const type = String(body.event);
  const p = body.payload || body.data || {};

  if (type === "message" || type === "message.any") {
    const fromMe = !!p.fromMe;

    // Descobrir o chatId real (identificador que o WhatsApp usa para essa conversa).
    // Prioridade: chatId explícito > from (se não for do próprio) > to (quando fromMe).
    // - Regra: WAHA emite sufixos "@c.us" (contato), "@lid" (identificador oculto),
    //   "@g.us" (grupo), "@newsletter" e "@broadcast" (canais/status). Só processamos "@c.us".
    const rawChatId = String(p.chatId || (fromMe ? (p.to || p.from) : (p.from || p.to)) || "");
    if (!rawChatId) return null;

    const suffixMatch = rawChatId.match(/@([a-z.]+)$/i);
    let suffix = suffixMatch ? suffixMatch[1].toLowerCase() : "";
    let resolvedChatId = rawChatId;

    // Ignora grupos, canais e status
    if (suffix === "g.us" || suffix === "newsletter" || suffix === "broadcast" || suffix === "status") {
      return null;
    }
    // LID (identificador oculto do WhatsApp) — resolvemos para o número real via WAHA.
    if (suffix === "lid") {
      // Alguns payloads WAHA já trazem o número real em campos alternativos.
      const alt =
        p.participantAlt || p.senderAlt || p._data?.senderAlt ||
        (typeof p.author === "string" && p.author.includes("@c.us") ? p.author : null) ||
        (typeof p.pn === "string" ? p.pn : null);
      // Log de diagnóstico: quais chaves o payload tem quando chega um LID
      console.log(
        `[waha] LID recebido ${rawChatId}. payload keys=`,
        Object.keys(p).join(","),
        "| _data keys=",
        p._data ? Object.keys(p._data).join(",") : "(sem _data)",
        "| from=", p.from, "to=", p.to, "author=", p.author,
        "participant=", p.participant, "participantAlt=", p.participantAlt,
        "senderAlt=", p.senderAlt, "pn=", p.pn,
      );
      if (alt && String(alt).includes("@")) {
        resolvedChatId = String(alt);
      } else {
        const wahaUrl = normalizeWahaUrl(Deno.env.get("WAHA_API_URL"));
        const wahaKey = Deno.env.get("WAHA_API_KEY");
        if (wahaUrl && wahaKey) {
          const resolved = await wahaResolveLid({ wahaUrl, wahaKey, session, lid: rawChatId }).catch(() => null);
          if (resolved) {
            resolvedChatId = resolved;
            console.log("[waha] LID resolvido:", rawChatId, "→", resolved);
          }
        }
        if (resolvedChatId === rawChatId) {
          console.log("[waha] LID sem resolução — ignorando mensagem:", rawChatId);
          return null;
        }
      }
      const m = resolvedChatId.match(/@([a-z.]+)$/i);
      suffix = m ? m[1].toLowerCase() : "";
    }

    // Extrai dígitos e valida — telefone real tem entre 10 e 15 dígitos (E.164)
    const chatDigits = resolvedChatId.split("@")[0].replace(/\D/g, "");
    if (chatDigits.length < 10 || chatDigits.length > 15) {
      console.log("[waha] chatId com número inválido, ignorando:", resolvedChatId);
      return null;
    }

    // Normaliza para o formato interno (mesmo shape do Evolution): "<digits>@s.whatsapp.net"
    const remoteJid = `${chatDigits}@s.whatsapp.net`;
    const waChatId = suffix === "c.us" ? resolvedChatId : `${chatDigits}@c.us`;

    const messageId = p.id || p._data?.id?._serialized || crypto.randomUUID();
    const timestamp = p.timestamp ? (typeof p.timestamp === "number" ? p.timestamp : Math.floor(new Date(p.timestamp).getTime() / 1000)) : Math.floor(Date.now() / 1000);
    const body_text = p.body || p.text || "";
    const hasMedia = !!(p.hasMedia || p.media);
    const mimetype = p.media?.mimetype || p._data?.mimetype || null;

    const messagePayload: any = {};
    if (hasMedia && mimetype) {
      if (mimetype.startsWith("image/")) messagePayload.imageMessage = { mimetype, caption: body_text || undefined };
      else if (mimetype.startsWith("video/")) messagePayload.videoMessage = { mimetype, caption: body_text || undefined };
      else if (mimetype.startsWith("audio/")) messagePayload.audioMessage = { mimetype };
      else messagePayload.documentMessage = { mimetype, fileName: p.media?.filename || null, caption: body_text || undefined };
    } else {
      messagePayload.conversation = body_text;
    }

    return {
      event: "messages.upsert",
      instance: session,
      data: {
        key: { remoteJid, fromMe, id: messageId },
        pushName: p.notifyName || p._data?.notifyName || null,
        message: messagePayload,
        messageTimestamp: timestamp,
        _waha: {
          raw: p,
          chatId: waChatId,          // ex "5511999999999@c.us"
          mediaUrl: p.media?.url || null,
          mediaMimetype: mimetype,
          mediaFilename: p.media?.filename || null,
        },
      },
    };
  }

  if (type === "session.status") {
    const status = String(p.status || "").toUpperCase();
    const state = status === "WORKING" ? "open" : (status === "SCAN_QR_CODE" ? "connecting" : status.toLowerCase());
    return {
      event: "connection.update",
      instance: session,
      data: { state, _waha: true },
    };
  }

  return null;
}

export function makeUnifiedError(errorPayload: Record<string, unknown> | undefined, fallback: string) {
  return errorPayload || { ok: false, error: fallback };
}
