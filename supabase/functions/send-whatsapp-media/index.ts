import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";
import { resolveAccountId } from "../_account.ts";
import { getBrazilianPhoneVariant, normalizeBrazilianPhone } from "../_phone.ts";

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

    // Resolve instance name
    let instanceName: string;
    if (system) {
      const { data: sysInstance } = await supabaseAdmin
        .from("system_whatsapp_instance")
        .select("instance_name, status")
        .maybeSingle();
      if (!sysInstance || sysInstance.status !== "connected") {
        return jsonResponse({ error: "WhatsApp do sistema não está conectado" }, 400);
      }
      instanceName = sysInstance.instance_name;
    } else {
      const normalizedPhoneEarly = normalizeBrazilianPhone(phone);
      let convInstanceId: string | null = null;
      {
        let q = supabaseAdmin
          .from("whatsapp_conversations")
          .select("instance_id")
          .eq("phone", normalizedPhoneEarly);
        q = accountId ? q.eq("account_id", accountId) : q.eq("user_id", userId);
        const { data: conv } = await q.maybeSingle();
        convInstanceId = (conv as any)?.instance_id || null;
      }

      let instance: { instance_name: string; status: string } | null = null;
      if (convInstanceId) {
        const { data } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name, status")
          .eq("id", convInstanceId)
          .maybeSingle();
        instance = data as any;
      }
      if (!instance) {
        let q = supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name, status, user_id, is_primary")
          .order("is_primary", { ascending: false });
        q = accountId ? q.eq("account_id", accountId) : q.eq("user_id", userId);
        const { data } = await q.limit(1).maybeSingle();
        instance = data as any;
      }
      if (!instance || instance.status !== "connected") {
        return jsonResponse({ error: "WhatsApp não está conectado" }, 400);
      }
      instanceName = instance.instance_name;
    }

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    const normalizedPhone = normalizeBrazilianPhone(phone);
    const candidates = [normalizedPhone];
    const variant = getBrazilianPhoneVariant(normalizedPhone);
    if (variant && variant !== normalizedPhone) candidates.push(variant);

    // Build prefixed caption (only for non-audio, where the user actually sees text)
    const cleanCaption = (caption || "").trim();
    const captionWithName =
      mediaType !== "audio" && attendantName
        ? cleanCaption
          ? `*${attendantName}*:\n${cleanCaption}`
          : `*${attendantName}*`
        : cleanCaption;

    const isAudio = mediaType === "audio";
    const path = isAudio
      ? `/message/sendWhatsAppAudio/${instanceName}`
      : `/message/sendMedia/${instanceName}`;

    let sendResponse: Awaited<ReturnType<typeof evolutionRequest>> | null = null;
    for (const candidate of candidates) {
      const reqBody = isAudio
        ? { number: candidate, audio: mediaUrl }
        : {
            number: candidate,
            mediatype: mediaType,
            mimetype: mimetype || undefined,
            caption: captionWithName || undefined,
            media: mediaUrl,
            fileName: filename || undefined,
          };

      sendResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (sendResponse.ok) break;

      const txt = sendResponse.text || "";
      const isInvalidNumber =
        sendResponse.status === 400 ||
        sendResponse.status === 404 ||
        /not.?exists|invalid.?number|number.?does.?not|not.?in.?whatsapp|jid/i.test(txt);
      if (!isInvalidNumber) break;
      console.warn(`Number ${candidate} rejected by Evolution (media), trying variant...`);
    }

    if (!sendResponse || !sendResponse.ok) {
      console.error("Evolution sendMedia error:", sendResponse);
      return jsonResponse(buildEvolutionErrorPayload(sendResponse!, "Erro ao enviar mídia"), 502);
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