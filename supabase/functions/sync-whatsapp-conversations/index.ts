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

    const { userId, instanceName, limit: bodyLimit, offset: bodyOffset, daysBack } = await req.json();
    const BATCH_LIMIT = typeof bodyLimit === "number" && bodyLimit > 0 ? Math.min(bodyLimit, 100) : 40;
    const OFFSET = typeof bodyOffset === "number" && bodyOffset >= 0 ? bodyOffset : 0;
    const CONCURRENCY = 5;
    const DAYS_BACK = typeof daysBack === "number" && daysBack > 0 ? daysBack : 5;
    const cutoffMs = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
    const cutoffSec = Math.floor(cutoffMs / 1000);

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

    // Filtra individuais e ordena por updatedAt/lastMessage desc
    const individualChats = (chats as any[])
      .filter((c) => {
        const jid = c.remoteJid || c.jid || c.id;
        return jid && !jid.includes("@g.us") && !jid.includes("@broadcast");
      })
      .filter((c) => {
        const t = Number(c.updatedAt || c.lastMessageTimestamp || c.conversationTimestamp || 0);
        // Aceita timestamp em segundos ou ms
        if (!t) return true; // sem timestamp, mantém para checagem via mensagens
        const tMs = t > 1e12 ? t : t * 1000;
        return tMs >= cutoffMs;
      })
      .sort((a, b) => {
        const ta = Number(a.updatedAt || a.lastMessageTimestamp || a.conversationTimestamp || 0);
        const tb = Number(b.updatedAt || b.lastMessageTimestamp || b.conversationTimestamp || 0);
        return tb - ta;
      });

    const totalChats = individualChats.length;
    const slice = individualChats.slice(OFFSET, OFFSET + BATCH_LIMIT);
    console.log(`Processing ${slice.length} chats (offset=${OFFSET}, total=${totalChats})`);

    // Pré-checa quais já existem para pular
    const phones = slice.map((c) => {
      const jid = c.remoteJid || c.jid || c.id;
      return (jid as string).replace("@s.whatsapp.net", "").replace("@lid", "");
    }).filter((p) => p && p.length >= 8);

    const { data: existingRows } = await supabase
      .from("whatsapp_conversations")
      .select("phone, messages, ai_active, contact_name")
      .eq("user_id", userId)
      .in("phone", phones);

    const existingMap = new Map<string, any>((existingRows || []).map((r: any) => [r.phone, r]));

    let syncedCount = 0;
    let skippedCount = 0;

    async function processChat(chat: any) {
      const remoteJid = chat.remoteJid || chat.jid || chat.id;
      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      if (!phone || phone.length < 8) return;
      const existing = existingMap.get(phone);

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
          return;
        }

        const messagesData = await messagesResponse.json();
        console.log(`[debug ${phone}] findMessages keys=${Object.keys(messagesData || {}).join(",")} sample=${JSON.stringify(messagesData).slice(0,400)}`);

        // Handle different response formats from Evolution API
        let rawMessages: any[];
        if (Array.isArray(messagesData)) {
          rawMessages = messagesData;
        } else if (messagesData?.messages?.records && Array.isArray(messagesData.messages.records)) {
          rawMessages = messagesData.messages.records;
        } else if (messagesData?.messages && Array.isArray(messagesData.messages)) {
          rawMessages = messagesData.messages;
        } else if (messagesData?.records && Array.isArray(messagesData.records)) {
          rawMessages = messagesData.records;
        } else {
          console.log(`No messages found for ${phone}`);
          rawMessages = [];
        }

        if (rawMessages.length === 0) return;

        // Transform messages to our format
        const formattedMessages = rawMessages
          .filter((msg: any) => msg && msg.key && msg.message)
          .filter((msg: any) => {
            const ts = Number(msg.messageTimestamp || 0);
            if (!ts) return false;
            return ts >= cutoffSec;
          })
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
            } else if (msg.message?.videoMessage) {
              messageType = "video";
              content = msg.message.videoMessage.caption || "[Vídeo]";
            } else if (msg.message?.documentMessage) {
              messageType = "document";
              content = msg.message.documentMessage.caption || `[Documento: ${msg.message.documentMessage.fileName || "arquivo"}]`;
            } else if (msg.message?.stickerMessage) {
              messageType = "image";
              content = "[Sticker]";
            } else {
              content = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.templateMessage?.hydratedTemplate?.hydratedContentText ||
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

        if (formattedMessages.length === 0) return;

        const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;

        // Mescla com mensagens existentes (deduplica por id)
        let mergedMessages = formattedMessages;
        if (existing && Array.isArray(existing.messages) && existing.messages.length > 0) {
          const seenIds = new Set<string>();
          const all = [...(existing.messages as any[]), ...formattedMessages];
          mergedMessages = all
            .filter((m: any) => {
              const id = m.id || `${m.timestamp}-${m.from_me}`;
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          // Se não houver mensagens novas, pula
          const newCount = mergedMessages.length - (existing.messages as any[]).length;
          if (newCount <= 0) { skippedCount++; return; }
        }

        const lastMessageAt = mergedMessages[mergedMessages.length - 1].timestamp;

        const { error: upsertError } = await supabase
          .from("whatsapp_conversations")
          .upsert({
            user_id: userId,
            phone,
            contact_name: existing?.contact_name || contactName,
            messages: mergedMessages,
            last_message_at: lastMessageAt,
            total_messages: mergedMessages.length,
            ai_active: existing?.ai_active ?? false,
          }, { onConflict: "user_id,phone" });

        if (upsertError) {
          console.error(`Error upserting conversation for ${phone}:`, upsertError);
          return;
        }

        syncedCount++;
        console.log(`Synced ${phone}: ${formattedMessages.length} messages`);
      } catch (chatError) {
        console.error(`Error processing chat ${phone}:`, chatError);
      }
    }

    // Processa em lotes paralelos
    for (let i = 0; i < slice.length; i += CONCURRENCY) {
      const batch = slice.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processChat));
    }

    // Sync contatos do batch atual (paralelo, fire-and-forget seguro)
    await Promise.all(slice.map(async (chat) => {
      const remoteJid = chat.remoteJid || chat.jid || chat.id;
      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      if (!phone || phone.length < 8) return;
      const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;
      await supabase
        .from("contacts")
        .upsert({ user_id: userId, phone, name: contactName }, { onConflict: "user_id,phone", ignoreDuplicates: true });
    }));

    const nextOffset = OFFSET + slice.length;
    const hasMore = nextOffset < totalChats;
    console.log(`Sync batch complete: ${syncedCount} synced, ${skippedCount} skipped. hasMore=${hasMore}`);

    return new Response(JSON.stringify({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      processed: slice.length,
      total: totalChats,
      nextOffset,
      hasMore,
    }), {
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
