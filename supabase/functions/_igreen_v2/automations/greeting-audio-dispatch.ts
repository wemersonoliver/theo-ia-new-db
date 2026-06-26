// Greeting audio dispatch — envia áudio de saudação (slot 1 ou 2) via Evolution.
// Mostra "gravando áudio" antes do envio (presence: recording).
// Slot 2 aguarda delay_after_ms antes de começar.
// Persiste no whatsapp_conversations como mensagem from_me com transcrição
// para que a IA tenha contexto nos próximos turnos.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AutomationResult } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";

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

function normalizeEvolutionUrl(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/\/+$/, "").replace(/\/manager$/, "");
}

async function resolveInstanceName(account_id: string): Promise<string | null> {
  try {
    const { data } = await svc()
      .from("whatsapp_instances")
      .select("instance_name, status, is_primary")
      .eq("account_id", account_id)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });
    const connected = (data ?? []).find((i: { status?: string }) => i.status === "connected");
    if (connected?.instance_name) return connected.instance_name as string;
    if ((data ?? [])[0]?.instance_name) return (data as Array<{ instance_name: string }>)[0].instance_name;
  } catch (e) {
    console.error("[greeting-audio-dispatch] resolveInstanceName error", e);
  }
  return null;
}

async function fetchSlot(slot: number): Promise<{
  storage_path: string | null;
  transcript: string;
  delay_after_ms: number;
  enabled: boolean;
} | null> {
  const { data, error } = await svc()
    .from("igreen_default_greeting_audios")
    .select("storage_path, transcript, delay_after_ms, enabled")
    .eq("slot", slot)
    .maybeSingle();
  if (error) {
    console.error("[greeting-audio-dispatch] fetchSlot error", error);
    return null;
  }
  return data as {
    storage_path: string | null;
    transcript: string;
    delay_after_ms: number;
    enabled: boolean;
  } | null;
}

async function getSignedUrl(storage_path: string): Promise<string | null> {
  try {
    const { data, error } = await svc().storage
      .from("igreen-audios")
      .createSignedUrl(storage_path, 60 * 10); // 10 min
    if (error || !data?.signedUrl) {
      console.error("[greeting-audio-dispatch] signedUrl error", error);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error("[greeting-audio-dispatch] signedUrl ex", e);
    return null;
  }
}

async function sendRecordingPresence(args: {
  evolutionUrl: string; evolutionKey: string; instance: string; phone: string; durationMs: number;
}): Promise<void> {
  try {
    await fetch(`${args.evolutionUrl}/chat/sendPresence/${args.instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.evolutionKey },
      body: JSON.stringify({
        number: args.phone,
        delay: Math.min(15000, Math.max(2000, args.durationMs)),
        presence: "recording",
      }),
    });
  } catch (e) {
    console.error("[greeting-audio-dispatch] presence failed (non-blocking)", e);
  }
}

async function sendWhatsappAudio(args: {
  evolutionUrl: string; evolutionKey: string; instance: string; phone: string; audioUrl: string;
}): Promise<{ ok: boolean; provider_message_id: string | null; error?: string }> {
  try {
    const r = await fetch(`${args.evolutionUrl}/message/sendWhatsAppAudio/${args.instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.evolutionKey },
      body: JSON.stringify({
        number: args.phone,
        audio: args.audioUrl,
        encoding: true,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, provider_message_id: null, error: `evolution_${r.status}: ${body.slice(0, 200)}` };
    }
    const j = await r.json().catch(() => ({}));
    return { ok: true, provider_message_id: (j as { key?: { id?: string } })?.key?.id ?? null };
  } catch (e) {
    return { ok: false, provider_message_id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function persistAudioMessage(args: {
  account_id: string; phone: string; transcript: string;
  audio_url: string; provider_message_id: string | null; correlation_id?: string | null;
}): Promise<void> {
  try {
    const client = svc();
    const msg = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: args.transcript,
      type: "audio",
      sent_by: "ai",
      media_url: args.audio_url,
      provider_message_id: args.provider_message_id,
      correlation_id: args.correlation_id ?? null,
    };
    const { data: conv } = await client
      .from("whatsapp_conversations")
      .select("id, messages, total_messages")
      .eq("account_id", args.account_id)
      .eq("phone", args.phone)
      .maybeSingle();
    if (conv) {
      const existing = Array.isArray((conv as { messages?: unknown[] }).messages)
        ? (conv as { messages: unknown[] }).messages
        : [];
      const updated = [...existing, msg];
      await client.from("whatsapp_conversations").update({
        messages: updated,
        last_message_at: new Date().toISOString(),
        total_messages: ((conv as { total_messages?: number }).total_messages ?? existing.length) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", (conv as { id: string }).id);
    }
  } catch (e) {
    console.error("[greeting-audio-dispatch] persist failed (non-blocking)", e);
  }
}

export async function greetingAudioDispatchAutomation(args: {
  account_id: string;
  phone: string;
  slot: number;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "greeting-audio-dispatch",
      idempotency_key: `greeting-audio:${args.account_id}:${args.phone}:${args.slot}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      const slotRow = await fetchSlot(args.slot);
      if (!slotRow || !slotRow.enabled || !slotRow.storage_path) {
        return {
          success: false,
          skipped: true,
          reason: !slotRow ? "slot_not_found" : !slotRow.enabled ? "slot_disabled" : "audio_not_uploaded",
        };
      }

      // Slot 2 aguarda intervalo configurado antes de tudo
      if (args.slot === 2 && slotRow.delay_after_ms > 0) {
        await new Promise((r) => setTimeout(r, slotRow.delay_after_ms));
      }

      const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
      const instance = await resolveInstanceName(args.account_id);
      const signedUrl = await getSignedUrl(slotRow.storage_path);

      if (!evolutionUrl || !evolutionKey || !instance || !signedUrl) {
        return {
          success: false,
          error: "missing_dependency",
          events: [{
            type: "greeting_audio_failed",
            priority: "high",
            source: "automation",
            payload: {
              slot: args.slot,
              has_evolution: !!(evolutionUrl && evolutionKey),
              has_instance: !!instance,
              has_signed_url: !!signedUrl,
            },
          }],
        };
      }

      // Estima duração para o presence "recording": 1s a cada 12 chars (ou 3s mínimo)
      const recordingMs = Math.max(3000, Math.min(15000, Math.floor(slotRow.transcript.length / 12) * 1000));
      await sendRecordingPresence({
        evolutionUrl, evolutionKey, instance, phone: args.phone, durationMs: recordingMs,
      });
      // Aguarda um pouco para o presence aparecer no celular antes de o áudio chegar
      await new Promise((r) => setTimeout(r, Math.min(recordingMs, 3000)));

      const send = await sendWhatsappAudio({
        evolutionUrl, evolutionKey, instance, phone: args.phone, audioUrl: signedUrl,
      });

      if (!send.ok) {
        return {
          success: false,
          error: send.error ?? "send_failed",
          events: [{
            type: "greeting_audio_failed",
            priority: "high",
            source: "automation",
            payload: { slot: args.slot, error: send.error ?? null },
          }],
        };
      }

      await persistAudioMessage({
        account_id: args.account_id,
        phone: args.phone,
        transcript: slotRow.transcript,
        audio_url: signedUrl,
        provider_message_id: send.provider_message_id,
        correlation_id: args.correlation_id ?? null,
      });

      return {
        success: true,
        events: [{
          type: "greeting_audio_sent",
          priority: "medium",
          source: "automation",
          payload: { slot: args.slot, provider_message_id: send.provider_message_id },
        }],
      };
    },
  );
}