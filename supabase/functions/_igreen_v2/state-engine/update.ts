// D14 — ÚNICO ponto de escrita em public.igreen_conversation_state.
//
// NENHUM outro arquivo do projeto pode conter:
//   from("igreen_conversation_state").update(...)
//   from("igreen_conversation_state").upsert(...)
//
// Toda mudança de estado passa por applyPatch() abaixo:
//   - valida shape do patch
//   - (próximas fases) valida transição contra transitions whitelist
//   - emite trace + events
//   - persiste com optimistic locking (version)
//   - aplicar o mesmo patch 2x é no-op (D14 + D4)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { IgreenConversationState, IgreenEvent } from "../types.ts";
import { emitEvents, trace } from "../observability/trace.ts";
import { validateTransition } from "./transitions.ts";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

const ALLOWED_FIELDS = new Set<keyof IgreenConversationState>([
  "produto",
  "etapa_funil",
  "specialist",
  "intent",
  "handoff_ativo",
  "fatura_valida",
  "identidade_validada",
  "holder_match",
  "lead_score",
  "lead_temperature",
  "extras",
  "last_event_at",
]);

// Memory safety (D5/D14): extras é jsonb livre; precisa de limite p/ não crescer indefinidamente.
const MAX_EXTRAS_KEYS = 64;
const MAX_EXTRAS_BYTES = 16 * 1024; // 16KB serializado
const MAX_APPLY_RETRIES = 3;

function capExtras(extras: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(extras);
  let trimmed = extras;
  if (keys.length > MAX_EXTRAS_KEYS) {
    const keep = keys.slice(keys.length - MAX_EXTRAS_KEYS);
    trimmed = Object.fromEntries(keep.map((k) => [k, extras[k]]));
  }
  let serialized = JSON.stringify(trimmed);
  while (serialized.length > MAX_EXTRAS_BYTES) {
    const ks = Object.keys(trimmed);
    if (ks.length === 0) break;
    delete (trimmed as Record<string, unknown>)[ks[0]];
    serialized = JSON.stringify(trimmed);
  }
  return trimmed;
}

export async function loadState(
  account_id: string,
  phone: string,
): Promise<IgreenConversationState | null> {
  const { data, error } = await svc()
    .from("igreen_conversation_state")
    .select("*")
    .eq("account_id", account_id)
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    console.error("[state-engine] loadState error", error);
    return null;
  }
  return data as IgreenConversationState | null;
}

export async function ensureState(
  account_id: string,
  phone: string,
): Promise<IgreenConversationState> {
  const existing = await loadState(account_id, phone);
  if (existing) return existing;

  const { data, error } = await svc()
    .from("igreen_conversation_state")
    .insert({ account_id, phone })
    .select("*")
    .single();
  if (error) {
    // Pode ter sido criado em paralelo — tenta carregar de novo.
    const again = await loadState(account_id, phone);
    if (again) return again;
    throw error;
  }
  return data as IgreenConversationState;
}

function sanitizePatch(
  patch: Partial<IgreenConversationState> | undefined,
): Partial<IgreenConversationState> {
  if (!patch) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_FIELDS.has(k as keyof IgreenConversationState)) out[k] = v;
  }
  if (out.extras && typeof out.extras === "object") {
    out.extras = capExtras(out.extras as Record<string, unknown>);
  }
  return out as Partial<IgreenConversationState>;
}

/**
 * Aplica um patch ao state. Único caminho autorizado para UPDATE em igreen_conversation_state (D14).
 * Retorna o novo state após a aplicação ou null se rejeitado.
 */
export async function applyPatch(args: {
  account_id: string;
  phone: string;
  patch?: Partial<IgreenConversationState>;
  events?: IgreenEvent[];
  source?: string;
}): Promise<IgreenConversationState | null> {
  const { account_id, phone, events } = args;
  const clean = sanitizePatch(args.patch);
  const hasPatch = Object.keys(clean).length > 0;

  // Sempre garante existência do state
  const current = await ensureState(account_id, phone);

  if (!hasPatch) {
    await emitEvents(account_id, phone, events);
    return current;
  }

  // Valida transição de etapa_funil (D9 + D14)
  if (clean.etapa_funil && !validateTransition(current.etapa_funil, clean.etapa_funil as string)) {
    await trace({
      account_id,
      phone,
      step: "state_engine.apply_patch.invalid_transition",
      level: "standard",
      payload: { from: current.etapa_funil, to: clean.etapa_funil },
    });
    await emitEvents(account_id, phone, [
      {
        type: "invalid_transition",
        priority: "high",
        source: "state_engine",
        payload: { from: current.etapa_funil, to: clean.etapa_funil },
      },
    ]);
    return null;
  }

  // Retry com re-read em caso de conflito de versão (D14 hardening).
  let attempt = 0;
  let working = current;
  let data: IgreenConversationState | null = null;
  let lastError: { message?: string } | null = null;
  while (attempt < MAX_APPLY_RETRIES) {
    attempt++;
    const next = {
      ...clean,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (working.version ?? 1) + 1,
    };
    const res = await svc()
      .from("igreen_conversation_state")
      .update(next)
      .eq("account_id", account_id)
      .eq("phone", phone)
      .eq("version", working.version ?? 1)
      .select("*")
      .maybeSingle();
    if (res.data && !res.error) {
      data = res.data as IgreenConversationState;
      break;
    }
    lastError = res.error ?? { message: "version_conflict" };
    // Re-read e revalida transição antes de tentar de novo
    const fresh = await loadState(account_id, phone);
    if (!fresh) break;
    if (clean.etapa_funil && !validateTransition(fresh.etapa_funil, clean.etapa_funil as string)) {
      lastError = { message: "transition_invalidated_after_conflict" };
      break;
    }
    working = fresh;
  }

  if (!data) {
    await trace({
      account_id,
      phone,
      step: "state_engine.apply_patch.rejected",
      level: "standard",
      payload: { reason: lastError?.message ?? "version_conflict", attempted: clean, attempts: attempt },
    });
    await emitEvents(account_id, phone, [
      {
        type: "invalid_state_patch",
        priority: "high",
        source: "state_engine",
        payload: { reason: lastError?.message ?? "version_conflict", attempted: clean, attempts: attempt },
      },
    ]);
    return null;
  }

  const finalVersion = (data as { version?: number }).version ?? (working.version ?? 1) + 1;
  await trace({
    account_id,
    phone,
    step: "state_engine.apply_patch.ok",
    level: "standard",
    payload: { patch: clean, source: args.source ?? null, attempts: attempt },
  });
  await emitEvents(account_id, phone, [
    ...(events ?? []),
    {
      type: "state_version_incremented",
      priority: "low",
      source: "state_engine",
      payload: { from: working.version ?? 1, to: finalVersion, fields: Object.keys(clean), attempts: attempt },
    },
  ]);

  return data;
}