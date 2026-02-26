import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This is a public webhook - no auth required
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const { event, instance, data } = body;
    const instanceName = instance || body.instanceName;

    if (!instanceName) {
      return new Response(JSON.stringify({ error: "No instance name" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Find the instance owner
    const { data: instanceData } = await supabase
      .from("whatsapp_instances")
      .select("user_id, id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!instanceData) {
      console.log("Instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = instanceData.user_id;

    // Handle different events
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrCode = data?.qrcode?.base64 || data?.base64;
      
      await supabase
        .from("whatsapp_instances")
        .update({
          status: "qr_ready",
          qr_code_base64: qrCode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log("QR Code updated for user:", userId);
    }

    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = data?.state || data?.status;
      
      if (state === "open" || state === "connected") {
        // Get phone info
        const phoneNumber = data?.pushName ? null : data?.wid?.split("@")[0];
        const profileName = data?.pushName || null;

        await supabase
          .from("whatsapp_instances")
          .update({
            status: "connected",
            qr_code_base64: null,
            phone_number: phoneNumber,
            profile_name: profileName,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log("WhatsApp connected for user:", userId);
      } else if (state === "close" || state === "disconnected") {
        await supabase
          .from("whatsapp_instances")
          .update({
            status: "disconnected",
            qr_code_base64: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log("WhatsApp disconnected for user:", userId);
      }
    }

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const messages = data?.messages || [data];
      
      // Fetch AI config for keyword activation and delay
      const { data: aiConfig } = await supabase
        .from("whatsapp_ai_config")
        .select("keyword_activation_enabled, trigger_keywords, active, response_delay_seconds")
        .eq("user_id", userId)
        .maybeSingle();
      
      for (const msg of messages) {
        if (!msg) continue;
        
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid.includes("@g.us")) continue; // Skip groups

        const phone = remoteJid.replace("@s.whatsapp.net", "");
        
        // Detect message type
        const isAudioMessage = !!msg.message?.audioMessage;
        const isImageMessage = !!msg.message?.imageMessage;
        const isDocumentMessage = !!msg.message?.documentMessage;
        const isStickerMessage = !!msg.message?.stickerMessage;
        const messageKey = msg.key;
        
        let content: string;
        let messageType: "text" | "audio" | "image" | "video" | "document" = "text";
        
        if (isAudioMessage) {
          // Transcribe audio
          messageType = "audio";
          try {
            console.log("Transcribing audio message for:", phone);
            const transcribeResponse = await fetch(
              `${supabaseUrl}/functions/v1/transcribe-audio`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ 
                  messageKey, 
                  instanceName 
                }),
              }
            );

            if (transcribeResponse.ok) {
              const transcribeData = await transcribeResponse.json();
              content = transcribeData.text || "[Áudio não transcrito]";
              console.log("Audio transcribed:", content.slice(0, 100));
            } else {
              const errorText = await transcribeResponse.text();
              console.error("Transcription failed:", errorText);
              content = "[Áudio não transcrito]";
            }
          } catch (error) {
            console.error("Transcription error:", error);
            content = "[Áudio não transcrito]";
          }
        } else if (isImageMessage || isDocumentMessage || isStickerMessage) {
          // Process image/document with OCR
          messageType = isImageMessage || isStickerMessage ? "image" : "document";
          const mediaType = isStickerMessage ? "sticker" : (isImageMessage ? "image" : "document");
          const caption = msg.message?.imageMessage?.caption || msg.message?.documentMessage?.caption || "";
          
          try {
            console.log("Processing OCR for:", phone, mediaType);
            const ocrResponse = await fetch(
              `${supabaseUrl}/functions/v1/process-image-ocr`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ 
                  messageKey, 
                  instanceName,
                  mediaType
                }),
              }
            );

            if (ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              const ocrText = ocrData.text || "";
              // Combine caption with OCR text
              if (caption && ocrText) {
                content = `[${mediaType === "document" ? "Documento" : "Imagem"}] ${caption}\n\nConteúdo extraído:\n${ocrText}`;
              } else if (ocrText) {
                content = `[${mediaType === "document" ? "Documento" : "Imagem"}] Conteúdo extraído:\n${ocrText}`;
              } else if (caption) {
                content = `[${mediaType === "document" ? "Documento" : "Imagem"}] ${caption}`;
              } else {
                content = `[${mediaType === "document" ? "Documento" : "Imagem"} sem texto identificável]`;
              }
              console.log("OCR processed:", content.slice(0, 100));
            } else {
              const errorText = await ocrResponse.text();
              console.error("OCR failed:", errorText);
              content = caption ? `[${mediaType === "document" ? "Documento" : "Imagem"}] ${caption}` : `[${mediaType === "document" ? "Documento" : "Imagem"} não processado]`;
            }
          } catch (error) {
            console.error("OCR error:", error);
            content = caption ? `[${mediaType === "document" ? "Documento" : "Imagem"}] ${caption}` : `[${mediaType === "document" ? "Documento" : "Imagem"} não processado]`;
          }
        } else {
          content = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text ||
                   "[Mídia]";
        }
        
        const isFromMe = msg.key?.fromMe === true;
        const contactName = msg.pushName || null;

        // Get or create conversation
        const { data: conversation } = await supabase
          .from("whatsapp_conversations")
          .select("id, messages, ai_active")
          .eq("user_id", userId)
          .eq("phone", phone)
          .maybeSingle();

        // Handle outgoing messages (sent by human via WhatsApp)
        if (isFromMe) {
          const outgoingMessage = {
            id: msg.key?.id || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            from_me: true,
            content,
            type: messageType,
            sent_by: "human",
          };

          if (conversation) {
            const existingMessages = conversation.messages || [];
            const updatedMessages = [...existingMessages, outgoingMessage];

            await supabase
              .from("whatsapp_conversations")
              .update({
                messages: updatedMessages,
                last_message_at: new Date().toISOString(),
                total_messages: updatedMessages.length,
                ai_active: false, // Disable AI when human responds
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);

            console.log("Outgoing message saved, AI disabled:", phone);
          }
          continue; // Don't trigger AI for outgoing messages
        }

        // Handle incoming messages
        const newMessage = {
          id: msg.key?.id || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: false,
          content,
          type: messageType,
          sent_by: "human",
        };

        // Helper function to check if message contains trigger keywords
        const checkKeywordActivation = (): boolean => {
          if (!aiConfig?.keyword_activation_enabled || !aiConfig?.trigger_keywords?.length) {
            return true; // No keyword filter, activate AI normally
          }
          const messageLower = content.toLowerCase();
          return aiConfig.trigger_keywords.some((keyword: string) => 
            messageLower.includes(keyword.toLowerCase())
          );
        };

        if (conversation) {
          const existingMessages = conversation.messages || [];
          const updatedMessages = [...existingMessages, newMessage];

          await supabase
            .from("whatsapp_conversations")
            .update({
              messages: updatedMessages,
              contact_name: contactName || undefined,
              last_message_at: new Date().toISOString(),
              total_messages: updatedMessages.length,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          // Check if AI should be activated (for inactive conversations)
          if (!conversation.ai_active && aiConfig?.keyword_activation_enabled) {
            const hasKeyword = checkKeywordActivation();
            if (hasKeyword) {
              // Reactivate AI for this conversation
              await supabase
                .from("whatsapp_conversations")
                .update({ ai_active: true })
                .eq("id", conversation.id);
              
              console.log("AI reactivated by keyword for:", phone);
              await triggerAIResponse(supabase, userId, phone, content, aiConfig?.response_delay_seconds);
            }
          } else if (conversation.ai_active) {
            // AI already active, trigger response with delay
            await triggerAIResponse(supabase, userId, phone, content, aiConfig?.response_delay_seconds);
          }
        } else {
          // New conversation - check if should activate AI
          const shouldActivateAI = checkKeywordActivation();

          await supabase
            .from("whatsapp_conversations")
            .insert({
              user_id: userId,
              phone,
              contact_name: contactName,
              messages: [newMessage],
              last_message_at: new Date().toISOString(),
              total_messages: 1,
              ai_active: shouldActivateAI,
            });

          if (shouldActivateAI) {
            console.log("AI activated for new conversation:", phone);
            await triggerAIResponse(supabase, userId, phone, content, aiConfig?.response_delay_seconds);
          } else {
            console.log("AI not activated (no keyword match):", phone);
          }
        }

        console.log("Message saved:", phone, content.slice(0, 50));
      }
    }

    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

async function triggerAIResponse(supabase: any, userId: string, phone: string, messageContent: string, delaySeconds?: number) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // If delay is configured, use the debounce system
    const delay = delaySeconds ?? 5;
    
    if (delay > 0) {
      const scheduledAt = new Date(Date.now() + delay * 1000).toISOString();
      
      // Upsert pending response - this resets the timer on each new message
      await supabase
        .from("whatsapp_pending_responses")
        .upsert({
          user_id: userId,
          phone,
          scheduled_at: scheduledAt,
          processed: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,phone" });
      
      console.log(`AI response scheduled for ${phone} in ${delay}s`);
      
      // Schedule the processing after delay
      setTimeout(async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/process-pending-ai`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ userId, phone }),
          });
        } catch (err) {
          console.error("Error calling process-pending-ai:", err);
        }
      }, delay * 1000);
      
      return;
    }
    
    // No delay configured, call AI immediately (fallback)
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ userId, phone, messageContent }),
    });
  } catch (error) {
    console.error("Error triggering AI:", error);
  }
}
