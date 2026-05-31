import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AutomationResult, IgreenConversationState } from "../types.ts";
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

// Mapeia media_key → product key (igreen_account_products.key)
const MEDIA_KEY_TO_PRODUCT: Record<string, string> = {
  discovery_video: "green",
  telecom_video: "telecom",
  expansao_video: "expansao",
};

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
    const connected = (data ?? []).find((i: any) => i.status === "connected");
    if (connected?.instance_name) return connected.instance_name as string;
    if ((data ?? [])[0]?.instance_name) return (data as any)[0].instance_name;
  } catch (e) {
    console.error("[media-dispatch] resolveInstanceName error", e);
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
    if (!data) return null;
    if (data.enabled === false) return null;
    const url = (data as any).video_url;
    return typeof url === "string" && url.trim().length > 0 ? url : null;
  } catch (e) {
    console.error("[media-dispatch] lookupVideoUrl error", e);
    return null;
  }
}

async function persistOutboundVideoMessage(args: {
  account_id: string;
  phone: string;
  video_url: string;
  provider_message_id: string | null;
  correlation_id?: string | null;
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
      correlation_id: args.correlation_id ?? null,
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
    console.error("[media-dispatch] persistOutboundVideoMessage failed", e);
  }
}

async function sendVideoViaEvolution(args: {
  evolutionUrl: string;
  evolutionKey: string;
  instance: string;
  phone: string;
  video_url: string;
  caption?: string;
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
          caption: args.caption ?? undefined,
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

export async function mediaDispatchAutomation(args: {
  account_id: string;
  phone: string;
  media_key: string;
  state: IgreenConversationState;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "media-dispatch",
      idempotency_key: `media:${args.account_id}:${args.phone}:${args.media_key}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      const extras = (args.state.extras ?? {}) as Record<string, unknown>;
      const dispatched = Array.isArray(extras.dispatched_media)
        ? [...(extras.dispatched_media as unknown[])]
        : [];
      if (dispatched.includes(args.media_key)) {
        return { skipped: true, reason: "state_unchanged" };
      }

      const productKey = MEDIA_KEY_TO_PRODUCT[args.media_key] ?? null;
      const videoUrl = productKey
        ? await lookupVideoUrl(args.account_id, productKey)
        : null;

      const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
      const instance = await resolveInstanceName(args.account_id);

      // Sem URL configurada OU sem credenciais: registra mas não inventa mídia.
      if (!videoUrl || !evolutionUrl || !evolutionKey || !instance) {
        console.warn("[media-dispatch] no_video_dispatched", {
          account_id: args.account_id,
          phone: args.phone,
          media_key: args.media_key,
          has_video_url: !!videoUrl,
          has_credentials: !!(evolutionUrl && evolutionKey),
          has_instance: !!instance,
        });
        // Mantemos o registro de "dispatched" para não tentar de novo no mesmo turno,
        // mas marcamos video_send_skipped=true para o agente reagir.
        dispatched.push(args.media_key);
        return {
          success: false,
          skipped: true,
          reason: !videoUrl ? "video_url_not_configured" : "evolution_or_instance_missing",
          events: [{
            type: "media_dispatch_skipped",
            priority: "high",
            source: "automation",
            payload: {
              media_key: args.media_key,
              reason: !videoUrl ? "video_url_not_configured" : "evolution_or_instance_missing",
            },
          }],
          suggested_state_patch: {
            extras: {
              ...extras,
              dispatched_media: dispatched,
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
        phone: args.phone,
        video_url: videoUrl,
      });

      if (!send.ok) {
        console.error("[media-dispatch] send failed", send.error);
        return {
          success: false,
          error: send.error ?? "send_failed",
          events: [{
            type: "media_dispatch_failed",
            priority: "high",
            source: "automation",
            payload: { media_key: args.media_key, error: send.error ?? null },
          }],
        };
      }

      dispatched.push(args.media_key);
      await persistOutboundVideoMessage({
        account_id: args.account_id,
        phone: args.phone,
        video_url: videoUrl,
        provider_message_id: send.provider_message_id,
        correlation_id: args.correlation_id ?? null,
      });

      return {
        success: true,
        events: [{
          type: "media_dispatched",
          priority: "medium",
          source: "automation",
          payload: { media_key: args.media_key, provider_message_id: send.provider_message_id },
        }],
        suggested_state_patch: {
          extras: {
            ...extras,
            dispatched_media: dispatched,
            video_send_skipped: false,
            video_sent_provider_id: send.provider_message_id,
          },
        },
      };
    },
  );
}