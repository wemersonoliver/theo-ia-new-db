import type { ToolDefinition } from "../tool-router/types.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const PRODUCT_TO_KEY: Record<string, string> = {
  green: "green",
  telecom: "telecom",
  expansao: "expansao",
};

async function resolveInstanceName(account_id: string): Promise<string | null> {
  try {
    const { data } = await svc()
      .from("whatsapp_instances")
      .select("instance_name, status, is_primary")
      .eq("account_id", account_id)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });
    const connected = (data ?? []).find((i: any) => i.status === "connected");
    if (connected?.instance_name) return connected.instance_name as string;
    if ((data ?? [])[0]?.instance_name) return (data as any)[0].instance_name;
  } catch (e) {
    console.error("[send-discovery-video] resolveInstanceName error", e);
  }
  return null;
}

async function lookupVideoUrl(account_id: string, productKey: string): Promise<string | null> {
  try {
    const { data } = await svc()
      .from("igreen_account_products")
      .select("video_url, enabled")
      .eq("account_id", account_id)
      .eq("key", productKey)
      .maybeSingle();
    if (!data || (data as any).enabled === false) return null;
    const url = (data as any).video_url;
    return typeof url === "string" && url.trim().length > 0 ? url : null;
  } catch (e) {
    console.error("[send-discovery-video] lookupVideoUrl error", e);
    return null;
  }
}

async function sendVideoViaEvolution(args: {
  evolutionUrl: string;
  evolutionKey: string;
  instance: string;
  phone: string;
  video_url: string;
}): Promise<{ ok: boolean; provider_message_id: string | null; error?: string }> {
  try {
    const r = await fetch(
      `${args.evolutionUrl}/message/sendMedia/${args.instance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: args.evolutionKey },
        body: JSON.stringify({
          number: args.phone,
          mediatype: "video",
          media: args.video_url,
        }),
      },
    );
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, provider_message_id: null, error: `evolution_send_${r.status}: ${body.slice(0, 200)}` };
    }
    const j = await r.json().catch(() => ({}));
    return { ok: true, provider_message_id: (j as { key?: { id?: string } })?.key?.id ?? null };
  } catch (e) {
    return { ok: false, provider_message_id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function persistOutboundVideoMessage(args: {
  account_id: string;
  phone: string;
  video_url: string;
  provider_message_id: string | null;
}): Promise<void> {
  try {
    const client = svc();
    const msg = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: "[Vídeo]",
      type: "video",
      sent_by: "ai",
      media_url: args.video_url,
      provider_message_id: args.provider_message_id,
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
      await client.from("whatsapp_conversations").update({
        messages: updated,
        last_message_at: new Date().toISOString(),
        total_messages: ((conv as any).total_messages ?? existing.length) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", (conv as any).id);
    }
  } catch (e) {
    console.error("[send-discovery-video] persistOutboundVideoMessage failed", e);
  }
}

async function recordTransportEvent(args: {
  account_id: string;
  phone: string;
  correlation_id: string | null;
  status: "sent" | "failed";
  provider_message_id: string | null;
  video_url: string | null;
  error: string | null;
}): Promise<void> {
  try {
    await svc().from("igreen_transport_events").insert({
      account_id: args.account_id,
      phone: args.phone,
      correlation_id: args.correlation_id ?? "send_discovery_video",
      chunk_index: 0,
      kind: "video",
      status: args.status,
      payload: { media_url: args.video_url },
      provider_message_id: args.provider_message_id,
      error: args.error,
      sent_at: args.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (e) {
    console.error("[send-discovery-video] recordTransportEvent failed", e);
  }
}

interface Args { produto: string }

export const sendDiscoveryVideoTool: ToolDefinition<Args> = {
  name: "send_discovery_video",
  description: "Envia o vídeo de descoberta via Evolution API. Idempotente por (produto, phone).",
  idempotencyKey: (a, ctx) => `video:${a.produto}:${ctx.phone}`,
  validate: (raw) => {
    const r = raw as Args;
    if (!r?.produto) throw new Error("produto required");
    return { produto: r.produto };
  },
  execute: async (ctx, args) => {
    const extras = (ctx.state.extras ?? {}) as Record<string, unknown>;
    if (extras.video_sent) {
      return { success: true, skipped: true, skip_reason: "state_unchanged" };
    }

    const productKey = PRODUCT_TO_KEY[args.produto] ?? args.produto;
    const videoUrl = await lookupVideoUrl(ctx.account_id, productKey);
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
    const instance = await resolveInstanceName(ctx.account_id);

    if (!videoUrl || !evolutionUrl || !evolutionKey || !instance) {
      console.warn("[send-discovery-video] skipped", {
        account_id: ctx.account_id,
        phone: ctx.phone,
        has_video_url: !!videoUrl,
        has_credentials: !!(evolutionUrl && evolutionKey),
        has_instance: !!instance,
      });
      return {
        success: false,
        skipped: true,
        skip_reason: !videoUrl ? "video_url_not_configured" : "evolution_or_instance_missing",
        events: [{
          type: "discovery_video_skipped",
          priority: "high",
          source: "tool",
          payload: {
            reason: !videoUrl ? "video_url_not_configured" : "evolution_or_instance_missing",
          },
        }],
        suggested_state_patch: {
          extras: {
            ...extras,
            video_send_skipped: true,
            video_send_skip_reason: !videoUrl
              ? "video_url_not_configured"
              : "evolution_or_instance_missing",
          },
        },
      };
    }

    const send = await sendVideoViaEvolution({
      evolutionUrl,
      evolutionKey,
      instance,
      phone: ctx.phone,
      video_url: videoUrl,
    });

    if (!send.ok) {
      console.error("[send-discovery-video] send failed", send.error);
      await recordTransportEvent({
        account_id: ctx.account_id,
        phone: ctx.phone,
        correlation_id: ctx.correlation_id ?? null,
        status: "failed",
        provider_message_id: null,
        video_url: videoUrl,
        error: send.error ?? "send_failed",
      });
      return {
        success: false,
        error: send.error ?? "send_failed",
        events: [{
          type: "discovery_video_failed",
          priority: "high",
          source: "tool",
          payload: { error: send.error ?? null },
        }],
      };
    }

    await persistOutboundVideoMessage({
      account_id: ctx.account_id,
      phone: ctx.phone,
      video_url: videoUrl,
      provider_message_id: send.provider_message_id,
    });
    await recordTransportEvent({
      account_id: ctx.account_id,
      phone: ctx.phone,
      correlation_id: ctx.correlation_id ?? null,
      status: "sent",
      provider_message_id: send.provider_message_id,
      video_url: videoUrl,
      error: null,
    });

    return {
      success: true,
      events: [{
        type: "discovery_video_sent",
        priority: "medium",
        source: "tool",
        payload: { provider_message_id: send.provider_message_id },
      }],
      suggested_state_patch: {
        extras: {
          ...extras,
          video_sent: true,
          video_sent_at: new Date().toISOString(),
          video_sent_provider_id: send.provider_message_id,
        },
      },
    };
  },
};