import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";
import { resolveAccountId } from "../_account.ts";
import { getBrazilianPhoneVariant, normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const { phone, content, system } = await req.json();

    if (!phone || !content) {
      return jsonResponse({ error: "Phone and content required" }, 400);
    }

    let instanceName: string;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const accountId = system ? null : await resolveAccountId(supabaseAdmin, userId);

    // Resolve attendant display name to prefix message (e.g. "*Maria*:\nmensagem")
    let attendantName = "";
    {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      const raw = (profile?.full_name || profile?.email || "").trim();
      if (raw) {
        // Use only first name to keep messages clean
        attendantName = raw.split(/\s+/)[0];
      }
    }
    const outgoingText = attendantName ? `*${attendantName}*:\n${content}` : content;

    if (system) {
      // Use system WhatsApp instance (admin/support)
      const { data: sysInstance } = await supabaseAdmin
        .from("system_whatsapp_instance")
        .select("instance_name, status")
        .maybeSingle();

      if (!sysInstance || sysInstance.status !== "connected") {
        return jsonResponse({ error: "WhatsApp do sistema não está conectado" }, 400);
      }
      instanceName = sysInstance.instance_name;
    } else {
      // Use account's instance (works for owners and invited members alike)
      let instanceQuery = supabaseAdmin
        .from("whatsapp_instances")
        .select("instance_name, status, user_id");
      if (accountId) {
        instanceQuery = instanceQuery.eq("account_id", accountId);
      } else {
        instanceQuery = instanceQuery.eq("user_id", userId);
      }
      const { data: instance } = await instanceQuery.maybeSingle();

      if (!instance || instance.status !== "connected") {
        return jsonResponse({ error: "WhatsApp não está conectado" }, 400);
      }
      instanceName = instance.instance_name;
    }

    // Get Evolution API from global secrets
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    // Normalize Brazilian phone to canonical 13-digit form (with 9th digit)
    const normalizedPhone = normalizeBrazilianPhone(phone);

    // Send via Evolution API with automatic fallback for the "9th digit" issue:
    // some Brazilian WhatsApp accounts (legacy DDDs) only accept the 12-digit
    // form. We try the canonical (13-digit) first and, if Evolution rejects
    // the number as invalid/non-existent, retry with the variant.
    const candidates = [normalizedPhone];
    const variant = getBrazilianPhoneVariant(normalizedPhone);
    if (variant && variant !== normalizedPhone) candidates.push(variant);

    let sendResponse: Awaited<ReturnType<typeof evolutionRequest>> | null = null;
    for (const candidate of candidates) {
      sendResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/message/sendText/${instanceName}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: candidate, text: outgoingText }),
      });
      if (sendResponse.ok) break;

      const body = sendResponse.text || "";
      const isInvalidNumber =
        sendResponse.status === 400 ||
        sendResponse.status === 404 ||
        /not.?exists|invalid.?number|number.?does.?not|not.?in.?whatsapp|jid/i.test(body);
      if (!isInvalidNumber) break;
      console.warn(`Number ${candidate} rejected by Evolution, trying variant...`);
    }

    if (!sendResponse || !sendResponse.ok) {
      console.error("Evolution send error:", sendResponse);
      return jsonResponse(buildEvolutionErrorPayload(sendResponse!, "Erro ao enviar mensagem"), 502);
    }

    const newMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: outgoingText,
      type: "text",
      sent_by: "human",
      attendant_name: attendantName || null,
      attendant_user_id: userId,
    };

    if (system) {
      // Save to system conversations
      const { data: conversation } = await supabaseAdmin
        .from("system_whatsapp_conversations")
        .select("id, messages")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (conversation) {
        const existingMessages = (conversation.messages as any[]) || [];
        const updatedMessages = [...existingMessages, newMessage];
        await supabaseAdmin
          .from("system_whatsapp_conversations")
          .update({
            messages: updatedMessages,
            last_message_at: new Date().toISOString(),
            total_messages: updatedMessages.length,
            ai_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
      } else {
        await supabaseAdmin
          .from("system_whatsapp_conversations")
          .insert({
            phone: normalizedPhone,
            messages: [newMessage],
            last_message_at: new Date().toISOString(),
            total_messages: 1,
            ai_active: false,
          });
      }
    } else {
      // Save to account conversation (visible to whole team)
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
        const existingMessages = (conversation.messages as any[]) || [];
        const updatedMessages = [...existingMessages, newMessage];
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            messages: updatedMessages,
            last_message_at: new Date().toISOString(),
            total_messages: updatedMessages.length,
            ai_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
      } else {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .insert({
            user_id: userId,
            account_id: accountId,
            phone: normalizedPhone,
            messages: [newMessage],
            last_message_at: new Date().toISOString(),
            total_messages: 1,
            ai_active: false,
          });
      }

      // Mark AI session as handed off (use service role so members can write)
      const sessionOwnerId = (conversation as any)?.user_id || userId;
      await supabaseAdmin
        .from("whatsapp_ai_sessions")
        .upsert({
          user_id: sessionOwnerId,
          account_id: accountId,
          phone: normalizedPhone,
          status: "handed_off",
          last_human_message_at: new Date().toISOString(),
          handed_off_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,phone" });
    }

    return jsonResponse({ success: true });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
