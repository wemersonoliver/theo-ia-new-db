// Phase 5 — Send orchestrator. Wrapper único: lock → typing → delay → send → record.
// Idempotente via (correlation_id, chunk_index). Não escreve em igreen_lead_data (D13).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { humanize, type HumanChunk } from "./humanize.ts";
import { computeTypingDurationMs, sendTyping } from "./typing.ts";
import { acquireTransportLock, releaseTransportLock, waitForLock } from "./media-queue.ts";
import { withTimeout, DEFAULT_TIMEOUTS } from "../cost-governor/timeout-orchestrator.ts";
import { withBackoff } from "../retry/backoff.ts";

let _c: SupabaseClient | null = null;
const svc = () => (_c ??= createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
));

export interface SendOrchestratorArgs {
  account_id: string;
  correlation_id: string;
  phone: string;
  instance: string;
  text?: string;
  media?: { kind: "image" | "audio" | "document"; base64?: string; url?: string; caption?: string; mimetype?: string };
  evolutionUrl?: string;
  evolutionKey?: string;
  dryRun?: boolean;
}

export interface SendOrchestratorResult {
  delivered: boolean;
  chunks: number;
  events: Array<{ chunk_index: number; status: string; provider_message_id?: string | null }>;
  lock_acquired: boolean;
}

async function recordEvent(args: {
  correlation_id: string;
  account_id: string;
  phone: string;
  chunk_index: number;
  kind: string;
  status: string;
  payload?: Record<string, unknown>;
  provider_message_id?: string | null;
  error?: string | null;
}) {
  try {
    await svc().from("igreen_transport_events").upsert({
      correlation_id: args.correlation_id,
      account_id: args.account_id,
      phone: args.phone,
      chunk_index: args.chunk_index,
      kind: args.kind,
      status: args.status,
      payload: args.payload ?? {},
      provider_message_id: args.provider_message_id ?? null,
      error: args.error ?? null,
      sent_at: args.status === "sent" ? new Date().toISOString() : null,
    }, { onConflict: "correlation_id,chunk_index" });
  } catch (e) {
    console.error("[send-orch] recordEvent failed", e);
  }
}

async function realSendText(args: { url: string; key: string; instance: string; phone: string; text: string }) {
  const r = await fetch(`${args.url.replace(/\/+$/, "")}/message/sendText/${args.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: args.key },
    body: JSON.stringify({ number: args.phone, text: args.text }),
  });
  if (!r.ok) throw new Error(`evolution_send_${r.status}`);
  const j = await r.json().catch(() => ({}));
  return (j as { key?: { id?: string } })?.key?.id ?? null;
}

async function persistOutboundChunk(args: {
  account_id: string;
  phone: string;
  correlation_id: string;
  chunk_index: number;
  text: string;
  provider_message_id: string | null;
}): Promise<void> {
  try {
    const client = svc();
    const msg = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: args.text,
      type: "text",
      sent_by: "ai",
      provider_message_id: args.provider_message_id,
      correlation_id: args.correlation_id,
      chunk_index: args.chunk_index,
    };

    const { data: conv } = await client
      .from("whatsapp_conversations")
      .select("id, messages, total_messages")
      .eq("account_id", args.account_id)
      .eq("phone", args.phone)
      .maybeSingle();

    if (conv) {
      const existing = Array.isArray((conv as any).messages) ? (conv as any).messages : [];
      const updated = [...existing, msg];
      await client
        .from("whatsapp_conversations")
        .update({
          messages: updated,
          last_message_at: new Date().toISOString(),
          total_messages: ((conv as any).total_messages ?? existing.length) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (conv as any).id);
    } else {
      await client.from("whatsapp_conversations").insert({
        account_id: args.account_id,
        phone: args.phone,
        messages: [msg],
        last_message_at: new Date().toISOString(),
        total_messages: 1,
        ai_active: true,
      });
    }
  } catch (e) {
    console.error("[send-orch] persistOutboundChunk failed", e);
  }
}

export async function sendOrchestrated(args: SendOrchestratorArgs): Promise<SendOrchestratorResult> {
  const evolutionUrl = args.evolutionUrl ?? Deno.env.get("EVOLUTION_API_URL") ?? "";
  const evolutionKey = args.evolutionKey ?? Deno.env.get("EVOLUTION_API_KEY") ?? "";
  const lock = await waitForLock(args.phone, args.account_id, DEFAULT_TIMEOUTS.transportMs * 2);
  if (!lock) {
    return { delivered: false, chunks: 0, events: [], lock_acquired: false };
  }
  try {
    const chunks: HumanChunk[] = args.text ? humanize(args.text) : [];
    const events: SendOrchestratorResult["events"] = [];
    for (const c of chunks) {
      await recordEvent({
        correlation_id: args.correlation_id,
        account_id: args.account_id,
        phone: args.phone,
        chunk_index: c.index,
        kind: "text",
        status: "queued",
        payload: { chars: c.text.length },
      });
      if (args.dryRun || !evolutionUrl || !evolutionKey) {
        await recordEvent({
          correlation_id: args.correlation_id,
          account_id: args.account_id,
          phone: args.phone,
          chunk_index: c.index,
          kind: "text",
          status: "sent",
          provider_message_id: `dry_${c.index}`,
        });
        events.push({ chunk_index: c.index, status: "sent", provider_message_id: `dry_${c.index}` });
        continue;
      }
      const typingMs = computeTypingDurationMs(c.text);
      await sendTyping({ evolutionUrl, evolutionKey, instance: args.instance, phone: args.phone, durationMs: Math.min(typingMs, c.jitter_ms) });
      await new Promise((r) => setTimeout(r, c.jitter_ms));
      try {
        // Retry mais resiliente para o transporte: 5 tentativas, jitter exponencial
        // até 15s. Cobre instabilidade momentânea da Evolution (5xx).
        const id = await withTimeout("transport.send", DEFAULT_TIMEOUTS.transportMs * 3, () =>
          withBackoff(
            () => realSendText({ url: evolutionUrl, key: evolutionKey, instance: args.instance, phone: args.phone, text: c.text }),
            { attempts: 5, baseMs: 800, maxMs: 15000 },
          ),
        );
        await recordEvent({
          correlation_id: args.correlation_id,
          account_id: args.account_id,
          phone: args.phone,
          chunk_index: c.index,
          kind: "text",
          status: "sent",
          provider_message_id: id,
        });
        await persistOutboundChunk({
          account_id: args.account_id,
          phone: args.phone,
          correlation_id: args.correlation_id,
          chunk_index: c.index,
          text: c.text,
          provider_message_id: id,
        });
        events.push({ chunk_index: c.index, status: "sent", provider_message_id: id });
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        await recordEvent({
          correlation_id: args.correlation_id,
          account_id: args.account_id,
          phone: args.phone,
          chunk_index: c.index,
          kind: "text",
          status: "failed",
          error: msg,
        });
        events.push({ chunk_index: c.index, status: "failed" });
      }
      if (c.pause_after_ms) await new Promise((r) => setTimeout(r, c.pause_after_ms));
    }
    return { delivered: events.every((e) => e.status === "sent"), chunks: chunks.length, events, lock_acquired: true };
  } finally {
    await releaseTransportLock(lock);
  }
}