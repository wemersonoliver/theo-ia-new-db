// Shared phone normalization for Brazilian numbers.
// Resolve o famoso "nono dígito": números brasileiros de celular devem ter 13 dígitos
// (55 + DDD + 9 + 8 dígitos). Alguns aparelhos/JIDs do WhatsApp omitem o 9, criando
// conversas duplicadas (ex: 558597627354 vs 5585997627354).
//
// Esta função sempre retorna a forma CANÔNICA com o 9, quando aplicável:
// - 10 dígitos (DDD + 8): assume celular, prefixa "55" + insere "9"
// - 11 dígitos (DDD + 9 + 8): prefixa "55"
// - 12 dígitos (55 + DDD + 8): insere "9" após o DDD
// - 13 dígitos (55 + DDD + 9 + 8): retorna como está
// - outros: retorna apenas os dígitos

export function normalizeBrazilianPhone(raw: string | null | undefined): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // 10 dígitos: DDD + 8 (celular antigo sem 9) -> 55 + DDD + 9 + 8
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `55${ddd}9${rest}`;
  }

  // 11 dígitos: DDD + 9 + 8 -> 55 + tudo
  if (digits.length === 11) {
    return `55${digits}`;
  }

  // 12 dígitos começando com 55: 55 + DDD + 8 (faltou o 9) -> insere 9
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    // Apenas insere 9 se for celular (DDD válido brasileiro 11-99)
    const dddNum = parseInt(ddd, 10);
    if (dddNum >= 11 && dddNum <= 99) {
      return `55${ddd}9${rest}`;
    }
    return digits;
  }

  // 13 dígitos canônicos
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  return digits;
}

// Retorna o "irmão" do número brasileiro: a forma alternativa com/sem o 9.
// Útil para fallback no envio Evolution: alguns JIDs reais são de 12 dígitos
// (sem o 9), e a normalização canônica força 13. Se o envio falhar, tente
// a outra forma antes de desistir.
export function getBrazilianPhoneVariant(raw: string | null | undefined): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits.startsWith("55")) return null;

  // 13 dígitos (55 + DDD + 9 + 8 dígitos): produz versão sem o 9 (12 dígitos)
  if (digits.length === 13) {
    const ddd = digits.slice(2, 4);
    const ninth = digits.slice(4, 5);
    const rest = digits.slice(5);
    if (ninth === "9") {
      return `55${ddd}${rest}`;
    }
    return null;
  }

  // 12 dígitos (55 + DDD + 8 dígitos): produz versão com o 9 (13 dígitos)
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    return `55${ddd}9${rest}`;
  }

  return null;
}

function normalizeEvolutionBaseUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/manager$/i, "");
}

function extractDigitsFromRemoteJid(remoteJid: unknown): string | null {
  if (typeof remoteJid !== "string") return null;
  const base = remoteJid.split("@")[0];
  const digits = base.replace(/\D/g, "");
  return digits || null;
}

// Quando já existe uma conversa no WhatsApp, o JID do chat é mais confiável
// do que uma validação genérica por número. Isso resolve casos de números BR
// recém-criados/recuperados em que a Evolution aceita o envio para 13 dígitos,
// mas o chat real ativo está no JID alternativo sem o nono dígito.
export async function resolvePreferredWhatsappChatNumber(args: {
  evolutionUrl: string;
  evolutionKey: string;
  instanceName: string;
  phone: string;
}): Promise<string | null> {
  try {
    const canonical = normalizeBrazilianPhone(args.phone);
    const variant = getBrazilianPhoneVariant(canonical);
    const candidateSet = new Set([args.phone, canonical, variant].filter(Boolean) as string[]);

    const response = await fetch(`${normalizeEvolutionBaseUrl(args.evolutionUrl)}/chat/findChats/${args.instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: args.evolutionKey,
        Authorization: `Bearer ${args.evolutionKey}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) return null;
    const chats = await response.json().catch(() => null);
    if (!Array.isArray(chats)) return null;

    for (const chat of chats) {
      const remoteJid = chat?.id || chat?.remoteJid || chat?.jid;
      const digits = extractDigitsFromRemoteJid(remoteJid);
      if (!digits) continue;
      if (candidateSet.has(digits) || normalizeBrazilianPhone(digits) === canonical) {
        return digits;
      }
    }

    return null;
  } catch (e) {
    console.warn("[resolvePreferredWhatsappChatNumber] lookup failed:", (e as Error)?.message);
    return null;
  }
}

// Resolve o JID REAL do WhatsApp consultando o endpoint
// /chat/whatsappNumbers/{instance} da Evolution. Tenta as duas formas
// (com e sem o "9") e retorna a primeira que existir no WhatsApp.
// Importante: Baileys aceita o POST de envio mesmo para JIDs inexistentes
// (retorna 200 OK pois apenas enfileira), por isso o fallback baseado em
// erro HTTP não detecta esse caso — precisamos resolver ANTES de enviar.
export async function resolveExistingWhatsappJid(args: {
  evolutionUrl: string;
  evolutionKey: string;
  instanceName: string;
  phone: string;
}): Promise<string | null> {
  const candidates: string[] = [];
  const canonical = normalizeBrazilianPhone(args.phone);
  if (canonical) candidates.push(canonical);
  const variant = getBrazilianPhoneVariant(canonical);
  if (variant && !candidates.includes(variant)) candidates.push(variant);
  if (candidates.length === 0) return null;

  const url = `${normalizeEvolutionBaseUrl(args.evolutionUrl)}/chat/whatsappNumbers/${args.instanceName}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: args.evolutionKey,
        Authorization: `Bearer ${args.evolutionKey}`,
      },
      body: JSON.stringify({ numbers: candidates }),
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => null) as Array<{ exists?: boolean; jid?: string; number?: string }> | null;
    if (!Array.isArray(data)) return null;
    // Procura na ordem de preferência: canonical primeiro, depois variant.
    for (const cand of candidates) {
      const hit = data.find((d) => d?.exists && (
        (d.number && d.number.replace(/\D/g, "") === cand) ||
        (d.jid && d.jid.split("@")[0] === cand)
      ));
      if (hit) {
        const j = (hit.number || hit.jid || "").toString().split("@")[0].replace(/\D/g, "");
        if (j) return j;
      }
    }
    // Se nenhum match estrito, pega o primeiro existente.
    const firstExists = data.find((d) => d?.exists);
    if (firstExists) {
      const j = (firstExists.number || firstExists.jid || "").toString().split("@")[0].replace(/\D/g, "");
      if (j) return j;
    }
    return null;
  } catch (e) {
    console.warn("[resolveExistingWhatsappJid] lookup failed:", (e as Error)?.message);
    return null;
  }
}
