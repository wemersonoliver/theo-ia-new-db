import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";
import { normalizeBrazilianPhone } from "../_phone.ts";
import { resolveInstanceContext, sendWhatsAppMedia } from "../_wa_provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type MediaType = "image" | "video" | "audio" | "document";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

    if (claimsError || !claimsData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.user.id;
    const body = await req.json();
    const {
      phone,
      mediaUrl,
      mediaType,
      filename,
      caption,
      mimetype,
      system,
    }: {
      phone?: string;
      mediaUrl?: string;
      mediaType?: MediaType;
      filename?: string;
      caption?: string;
      mimetype?: string;
      system?: boolean;
    } = body || {};

    if (!phone || !mediaUrl || !mediaType) {
      return jsonResponse({ error: "phone, mediaUrl and mediaType are required" }, 400);
    }
    if (!["image", "video", "audio", "document"].includes(mediaType)) {
      return jsonResponse({ error: "Invalid mediaType" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const accountId = system ? null : await resolveAccountId(supabaseAdmin, userId);

    // Resolve attendant first name (used as caption prefix on text-bearing media)
    let attendantName = "";
    {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      const raw = (profile?.full_name || profile?.email || "").trim();
      if (raw) attendantName = raw.split(/\s+/)[0];
    }

    // Resolve contexto (provider + credenciais)
    const normalizedPhoneEarly = normalizeBrazilianPhone(phone);
    let convInstanceId: string | null = null;
    if (!system) {
      let q = supabaseAdmin
        .from("whatsapp_conversations")
        .select("instance_id")
        .eq("phone", normalizedPhoneEarly);
      q = accountId ? q.eq("account_id", accountId) : q.eq("user_id", userId);
      const { data: conv } = await q.maybeSingle();
      convInstanceId = (conv as any)?.instance_id || null;
    }

    const ctx = await resolveInstanceContext(supabaseAdmin, {
      system,
      instanceId: convInstanceId,
      accountId,
      userId,
    });
    if (!ctx) {
      return jsonResponse({ error: system ? "WhatsApp do sistema não configurado" : "WhatsApp não configurado" }, 400);
    }
    if (ctx.status !== "connected") {
      return jsonResponse({ error: system ? "WhatsApp do sistema não está conectado" : "WhatsApp não está conectado" }, 400);
    }

    const normalizedPhone = normalizeBrazilianPhone(phone);

    // Build prefixed caption (only for non-audio, where the user actually sees text)
    const cleanCaption = (caption || "").trim();
    const captionWithName =
      mediaType !== "audio" && attendantName
        ? cleanCaption
          ? `*${attendantName}*:\n${cleanCaption}`
          : `*${attendantName}*`
        : cleanCaption;

    const sendResult = await sendWhatsAppMedia(ctx, {
      phone: normalizedPhone,
      mediaUrl,
      mediaType,
      mimetype: mimetype || undefined,
      filename: filename || undefined,
      caption: captionWithName,
    });
    if (!sendResult.ok) {
      console.error("sendMedia failed:", ctx.provider, sendResult);
      return jsonResponse(sendResult.errorPayload || { ok: false, error: "Erro ao enviar mídia" }, 502);
    }

    const newMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: cleanCaption,
      type: mediaType,
      sent_by: "human",
      media_url: mediaUrl,
      media_mime: mimetype || null,
      media_filename: filename || null,
      attendant_name: attendantName || null,
      attendant_user_id: userId,
    };

    if (system) {
      const { data: conversation } = await supabaseAdmin
        .from("system_whatsapp_conversations")
        .select("id, messages")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (conversation) {
        const existing = (conversation.messages as any[]) || [];
        const updated = [...existing, newMessage];
        await supabaseAdmin
          .from("system_whatsapp_conversations")
          .update({
            messages: updated,
            last_message_at: new Date().toISOString(),
            total_messages: updated.length,
            ai_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
      } else {
        await supabaseAdmin.from("system_whatsapp_conversations").insert({
          phone: normalizedPhone,
          messages: [newMessage],
          last_message_at: new Date().toISOString(),
          total_messages: 1,
          ai_active: false,
        });
      }
    } else {
      let convQuery = supabaseAdmin
        .from("whatsapp_conversations")
        .select("id, messages, user_id, account_id")
        .eq("phone", normalizedPhone);
      if (accountId) {
        convQuery = convQuery.eq("account_id", accountId);
      } else {
        convQuery = convQuery.eq("user_id", userId);
      }
      const { data: conversation } = await convQuery.maybeSingle();

      if (conversation) {
        const existing = (conversation.messages as any[]) || [];
        const updated = [...existing, newMessage];
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            messages: updated,
            last_message_at: new Date().toISOString(),
            total_messages: updated.length,
            ai_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
      } else {
        await supabaseAdmin.from("whatsapp_conversations").insert({
          user_id: userId,
          account_id: accountId,
          phone: normalizedPhone,
          messages: [newMessage],
          last_message_at: new Date().toISOString(),
          total_messages: 1,
          ai_active: false,
        });
      }

      const sessionOwnerId = (conversation as any)?.user_id || userId;
      await supabaseAdmin
        .from("whatsapp_ai_sessions")
        .upsert(
          {
            user_id: sessionOwnerId,
            account_id: accountId,
            phone: normalizedPhone,
            status: "handed_off",
            last_human_message_at: new Date().toISOString(),
            handed_off_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,phone" },
        );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("send-whatsapp-media error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});