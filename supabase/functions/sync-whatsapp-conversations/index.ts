import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, instanceName } = await req.json();

    if (!userId || !instanceName) {
      return new Response(JSON.stringify({ error: "Missing userId or instanceName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting conversation sync for user ${userId}, instance ${instanceName}`);

    // 1. Fetch all chats from Evolution API
    const chatsResponse = await fetch(`${evolutionUrl}/chat/findChats/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({}),
    });

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text();
      console.error("Failed to fetch chats:", errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch chats from Evolution API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chats = await chatsResponse.json();
    console.log(`Found ${Array.isArray(chats) ? chats.length : 0} chats`);

    if (!Array.isArray(chats) || chats.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let syncedCount = 0;

    // 2. For each individual chat (skip groups), fetch messages and save
    for (const chat of chats) {
      const remoteJid = chat.id || chat.remoteJid || chat.jid;
      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) continue;

      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      if (!phone || phone.length < 8) continue;

      try {
        // Fetch messages for this chat
        const messagesResponse = await fetch(`${evolutionUrl}/chat/findMessages/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid,
              },
            },
            limit: 100,
          }),
        });

        if (!messagesResponse.ok) {
          console.error(`Failed to fetch messages for ${phone}:`, await messagesResponse.text());
          continue;
        }

        const messagesData = await messagesResponse.json();
        
        // Handle different response formats from Evolution API
        let rawMessages: any[];
        if (Array.isArray(messagesData)) {
          rawMessages = messagesData;
        } else if (messagesData?.messages && Array.isArray(messagesData.messages)) {
          rawMessages = messagesData.messages;
        } else if (messagesData?.records && Array.isArray(messagesData.records)) {
          rawMessages = messagesData.records;
        } else if (typeof messagesData === "object" && messagesData !== null) {
          // Try to find any array property in the response
          const arrayProp = Object.values(messagesData).find(v => Array.isArray(v));
          if (arrayProp) {
            rawMessages = arrayProp as any[];
          } else {
            console.log(`Unexpected findMessages response for ${phone}:`, JSON.stringify(messagesData).slice(0, 300));
            rawMessages = [];
          }
        } else {
          rawMessages = [];
        }

        if (rawMessages.length === 0) continue;

        // Transform messages to our format
        const formattedMessages = rawMessages
          .filter((msg: any) => msg && (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage || msg.message?.audioMessage || msg.message?.documentMessage))
          .map((msg: any) => {
            const isFromMe = msg.key?.fromMe === true;
            let content: string;
            let messageType: string = "text";

            if (msg.message?.audioMessage) {
              messageType = "audio";
              content = "[Áudio]";
            } else if (msg.message?.imageMessage) {
              messageType = "image";
              content = msg.message.imageMessage.caption || "[Imagem]";
            } else if (msg.message?.documentMessage) {
              messageType = "document";
              content = msg.message.documentMessage.caption || `[Documento: ${msg.message.documentMessage.fileName || "arquivo"}]`;
            } else {
              content = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                "[Mídia]";
            }

            // Use the original timestamp from the message
            const timestamp = msg.messageTimestamp
              ? new Date(typeof msg.messageTimestamp === "number"
                  ? msg.messageTimestamp * 1000
                  : parseInt(msg.messageTimestamp) * 1000
                ).toISOString()
              : new Date().toISOString();

            return {
              id: msg.key?.id || crypto.randomUUID(),
              timestamp,
              from_me: isFromMe,
              content,
              type: messageType,
              sent_by: "human",
            };
          })
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (formattedMessages.length === 0) continue;

        const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;
        const lastMessageAt = formattedMessages[formattedMessages.length - 1].timestamp;

        // Upsert conversation (don't overwrite if already exists with messages)
        const { data: existing } = await supabase
          .from("whatsapp_conversations")
          .select("id, messages")
          .eq("user_id", userId)
          .eq("phone", phone)
          .maybeSingle();

        if (existing && existing.messages && (existing.messages as any[]).length > 0) {
          // Already has messages, skip to avoid duplicates
          console.log(`Skipping ${phone} - already has ${(existing.messages as any[]).length} messages`);
          continue;
        }

        const { error: upsertError } = await supabase
          .from("whatsapp_conversations")
          .upsert({
            user_id: userId,
            phone,
            contact_name: contactName,
            messages: formattedMessages,
            last_message_at: lastMessageAt,
            total_messages: formattedMessages.length,
            ai_active: false, // Don't auto-activate AI for synced conversations
          }, { onConflict: "user_id,phone" });

        if (upsertError) {
          console.error(`Error upserting conversation for ${phone}:`, upsertError);
          continue;
        }

        syncedCount++;
        console.log(`Synced ${phone}: ${formattedMessages.length} messages`);
      } catch (chatError) {
        console.error(`Error processing chat ${phone}:`, chatError);
        continue;
      }
    }

    // Also sync contacts
    for (const chat of chats) {
      const remoteJid = chat.id || chat.remoteJid || chat.jid;
      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) continue;

      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      if (!phone || phone.length < 8) continue;

      const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;

      await supabase
        .from("contacts")
        .upsert({
          user_id: userId,
          phone,
          name: contactName,
        }, { onConflict: "user_id,phone", ignoreDuplicates: true })
        .then(() => {});
    }

    console.log(`Sync complete: ${syncedCount} conversations synced`);

    return new Response(JSON.stringify({ success: true, synced: syncedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
