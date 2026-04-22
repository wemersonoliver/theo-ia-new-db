import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { persistEvolutionMedia } from "../_media.ts";
import { resolveAccountId } from "../_account.ts";
import { normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractPairingCode(payload: Record<string, any> | null | undefined): string | null {
  const raw = payload?.pairingCode || payload?.qrcode?.pairingCode || payload?.code?.pairingCode || null;
  if (typeof raw !== "string") return null;

  if (raw.includes("@") || raw.includes(",")) {
    return null;
  }

  const normalized = raw.replace(/[^A-Za-z0-9]/g, "").trim().toUpperCase();
  if (normalized.length < 6 || normalized.length > 12) {
    return null;
  }

  return normalized;
}

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

    // Find the instance owner (user instance or system instance)
    const { data: instanceData } = await supabase
      .from("whatsapp_instances")
      .select("user_id, id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    // Check if it's the system notification instance
    const { data: sysInstanceData } = await supabase
      .from("system_whatsapp_instance")
      .select("id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!instanceData && !sysInstanceData) {
      console.log("Instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Handle system instance events
    if (sysInstanceData) {
      if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
        const qrCode = data?.qrcode?.base64 || data?.base64;
        await supabase.from("system_whatsapp_instance").update({
          status: "qr_ready",
          qr_code_base64: qrCode,
          updated_at: new Date().toISOString(),
        }).eq("id", sysInstanceData.id);
        console.log("System QR Code updated");
      }

      if (event === "connection.update" || event === "CONNECTION_UPDATE") {
        const state = data?.state || data?.status;
        if (state === "open" || state === "connected") {
          const phoneNumber = data?.pushName ? null : data?.wid?.split("@")[0];
          const profileName = data?.pushName || null;
          await supabase.from("system_whatsapp_instance").update({
            status: "connected",
            qr_code_base64: null,
            phone_number: phoneNumber,
            profile_name: profileName,
            updated_at: new Date().toISOString(),
          }).eq("id", sysInstanceData.id);
          console.log("System WhatsApp connected");
        } else if (state === "close" || state === "disconnected") {
          await supabase.from("system_whatsapp_instance").update({
            status: "disconnected",
            qr_code_base64: null,
            updated_at: new Date().toISOString(),
          }).eq("id", sysInstanceData.id);
          console.log("System WhatsApp disconnected");
        }
      }

    // Handle incoming messages for system instance (support)
      if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
        const messages = data?.messages || [data];
        
        for (const msg of messages) {
          if (!msg) continue;
          const remoteJid = msg.key?.remoteJid;
          if (!remoteJid || remoteJid.includes("@g.us")) continue;

          const rawPhone = remoteJid.replace("@s.whatsapp.net", "");
          const phone = normalizeBrazilianPhone(rawPhone);
          const isFromMe = msg.key?.fromMe === true;
          const contactName = msg.pushName || null;
          const messageKey = msg.key;

          // Detect message type
          const isAudioMessage = !!msg.message?.audioMessage;
          const isImageMessage = !!msg.message?.imageMessage;
          const isDocumentMessage = !!msg.message?.documentMessage;
          const isStickerMessage = !!msg.message?.stickerMessage;
          const isVideoMessage = !!msg.message?.videoMessage;

          let content: string;
          let messageType: "text" | "audio" | "image" | "video" | "document" = "text";
          let persistedMedia: { url: string; mime: string; filename: string } | null = null;
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

          if (isAudioMessage) {
            messageType = "audio";
            // Persist audio to storage (parallel-ish to transcription)
            try {
              persistedMedia = await persistEvolutionMedia({
                supabase, evolutionUrl, evolutionKey, instanceName,
                messageKey, scope: "system", phone,
                messageId: msg.key?.id || crypto.randomUUID(),
                fallbackExt: "ogg",
                knownMime: msg.message?.audioMessage?.mimetype || null,
              });
            } catch (e) { console.error("System persist audio error:", e); }
            try {
              console.log("Transcribing system audio for:", phone);
              const transcribeResponse = await fetch(
                `${supabaseUrl}/functions/v1/transcribe-audio`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ messageKey, instanceName }),
                }
              );
              if (transcribeResponse.ok) {
                const transcribeData = await transcribeResponse.json();
                content = transcribeData.text || "[Áudio não transcrito]";
                console.log("System audio transcribed:", content.slice(0, 100));
              } else {
                console.error("System transcription failed:", await transcribeResponse.text());
                content = "[Áudio não transcrito]";
              }
            } catch (error) {
              console.error("System transcription error:", error);
              content = "[Áudio não transcrito]";
            }
          } else if (isVideoMessage) {
            messageType = "video";
            const caption = msg.message?.videoMessage?.caption || "";
            try {
              persistedMedia = await persistEvolutionMedia({
                supabase, evolutionUrl, evolutionKey, instanceName,
                messageKey, scope: "system", phone,
                messageId: msg.key?.id || crypto.randomUUID(),
                fallbackExt: "mp4",
                knownMime: msg.message?.videoMessage?.mimetype || null,
              });
            } catch (e) { console.error("System persist video error:", e); }
            content = caption ? `[Vídeo] ${caption}` : "[Vídeo]";
          } else if (isImageMessage || isDocumentMessage || isStickerMessage) {
            messageType = isImageMessage || isStickerMessage ? "image" : "document";
            const mediaType = isStickerMessage ? "sticker" : (isImageMessage ? "image" : "document");
            const caption = msg.message?.imageMessage?.caption || msg.message?.documentMessage?.caption || "";
            const docFilename = msg.message?.documentMessage?.fileName || null;
            try {
              persistedMedia = await persistEvolutionMedia({
                supabase, evolutionUrl, evolutionKey, instanceName,
                messageKey, scope: "system", phone,
                messageId: msg.key?.id || crypto.randomUUID(),
                fallbackExt: isDocumentMessage ? "bin" : (isStickerMessage ? "webp" : "jpg"),
                filename: docFilename,
                knownMime: msg.message?.imageMessage?.mimetype || msg.message?.documentMessage?.mimetype || msg.message?.stickerMessage?.mimetype || null,
              });
            } catch (e) { console.error("System persist media error:", e); }
            try {
              console.log("Processing system OCR for:", phone, mediaType);
              const ocrResponse = await fetch(
                `${supabaseUrl}/functions/v1/process-image-ocr`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ messageKey, instanceName, mediaType }),
                }
              );
              if (ocrResponse.ok) {
                const ocrData = await ocrResponse.json();
                const ocrText = ocrData.text || "";
                const label = mediaType === "document" ? "Documento" : "Imagem";
                if (caption && ocrText) {
                  content = `[${label}] ${caption}\n\nConteúdo extraído:\n${ocrText}`;
                } else if (ocrText) {
                  content = `[${label}] Conteúdo extraído:\n${ocrText}`;
                } else if (caption) {
                  content = `[${label}] ${caption}`;
                } else {
                  content = `[${label} sem texto identificável]`;
                }
              } else {
                content = caption ? `[Imagem] ${caption}` : "[Mídia não processada]";
              }
            } catch (error) {
              console.error("System OCR error:", error);
              content = "[Mídia não processada]";
            }
          } else if (msg.message?.conversation) {
            content = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
          } else {
            content = "[Mídia]";
          }

          const newMessage: any = {
            id: msg.key?.id || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            from_me: isFromMe,
            content,
            type: messageType,
            sent_by: isFromMe ? "human" : "human",
          };
          if (persistedMedia) {
            newMessage.media_url = persistedMedia.url;
            newMessage.media_mime = persistedMedia.mime;
            newMessage.media_filename = persistedMedia.filename;
          }

          // Get or create system conversation
          const { data: conv } = await supabase
            .from("system_whatsapp_conversations")
            .select("id, messages, ai_active")
            .eq("phone", phone)
            .maybeSingle();

          if (conv) {
            const existingMessages = conv.messages || [];
            const updatedMessages = [...existingMessages, newMessage];
            
            const updateData: any = {
              messages: updatedMessages,
              last_message_at: new Date().toISOString(),
              total_messages: updatedMessages.length,
              updated_at: new Date().toISOString(),
            };
            if (contactName && !isFromMe) updateData.contact_name = contactName;
            if (isFromMe) updateData.ai_active = false;

            await supabase
              .from("system_whatsapp_conversations")
              .update(updateData)
              .eq("id", conv.id);

            // Trigger support AI if not from me and AI is active
            if (!isFromMe && conv.ai_active) {
              triggerSupportAI(phone, content).catch(err => 
                console.error("Error triggering support AI:", err)
              );
            }
          } else {
            await supabase
              .from("system_whatsapp_conversations")
              .insert({
                phone,
                contact_name: contactName,
                messages: [newMessage],
                last_message_at: new Date().toISOString(),
                total_messages: 1,
                ai_active: !isFromMe,
              });

            if (!isFromMe) {
              triggerSupportAI(phone, content).catch(err =>
                console.error("Error triggering support AI:", err)
              );
            }
          }

          console.log("System message saved:", phone, isFromMe ? "(outgoing)" : "(incoming)");
        }
      }

      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = instanceData.user_id;
    const accountId = await resolveAccountId(supabase, userId);

    // Handle different events
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrCode = data?.qrcode?.base64 || data?.base64;
      const pairingCode = extractPairingCode(data);
      const updatePayload: Record<string, unknown> = {
        status: "qr_ready",
        updated_at: new Date().toISOString(),
      };

      if (qrCode) updatePayload.qr_code_base64 = qrCode;
      if (pairingCode) updatePayload.pairing_code = pairingCode;
      
      await supabase
        .from("whatsapp_instances")
        .update(updatePayload)
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
            pairing_code: null,
            phone_number: phoneNumber,
            profile_name: profileName,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log("WhatsApp connected for user:", userId);

        // Trigger conversation sync in background (fire-and-forget)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/sync-whatsapp-conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ userId, instanceName }),
        }).catch(err => {
          console.error("Error triggering conversation sync:", err);
        });
        console.log("Conversation sync triggered for user:", userId);
      } else if (state === "close" || state === "disconnected") {
        await supabase
          .from("whatsapp_instances")
          .update({
            status: "disconnected",
            qr_code_base64: null,
            pairing_code: null,
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

        const rawPhone = remoteJid.replace("@s.whatsapp.net", "");
        const phone = normalizeBrazilianPhone(rawPhone);
        
        // Detect message type
        const isAudioMessage = !!msg.message?.audioMessage;
        const isImageMessage = !!msg.message?.imageMessage;
        const isDocumentMessage = !!msg.message?.documentMessage;
        const isStickerMessage = !!msg.message?.stickerMessage;
        const isVideoMessage = !!msg.message?.videoMessage;
        const messageKey = msg.key;
        
        let content: string;
        let messageType: "text" | "audio" | "image" | "video" | "document" = "text";
        let persistedMedia: { url: string; mime: string; filename: string } | null = null;
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
        
        if (isAudioMessage) {
          // Transcribe audio
          messageType = "audio";
          try {
            persistedMedia = await persistEvolutionMedia({
              supabase, evolutionUrl, evolutionKey, instanceName,
              messageKey, scope: userId, phone,
              messageId: msg.key?.id || crypto.randomUUID(),
              fallbackExt: "ogg",
              knownMime: msg.message?.audioMessage?.mimetype || null,
            });
          } catch (e) { console.error("Persist audio error:", e); }
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
          const docFilename = msg.message?.documentMessage?.fileName || null;
          try {
            persistedMedia = await persistEvolutionMedia({
              supabase, evolutionUrl, evolutionKey, instanceName,
              messageKey, scope: userId, phone,
              messageId: msg.key?.id || crypto.randomUUID(),
              fallbackExt: isDocumentMessage ? "bin" : (isStickerMessage ? "webp" : "jpg"),
              filename: docFilename,
              knownMime: msg.message?.imageMessage?.mimetype || msg.message?.documentMessage?.mimetype || msg.message?.stickerMessage?.mimetype || null,
            });
          } catch (e) { console.error("Persist media error:", e); }

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
        } else if (isVideoMessage) {
          messageType = "video";
          const caption = msg.message?.videoMessage?.caption || "";
          try {
            persistedMedia = await persistEvolutionMedia({
              supabase, evolutionUrl, evolutionKey, instanceName,
              messageKey, scope: userId, phone,
              messageId: msg.key?.id || crypto.randomUUID(),
              fallbackExt: "mp4",
              knownMime: msg.message?.videoMessage?.mimetype || null,
            });
          } catch (e) { console.error("Persist video error:", e); }
          content = caption ? `[Vídeo] ${caption}` : "[Vídeo]";
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
          const outgoingMessage: any = {
            id: msg.key?.id || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            from_me: true,
            content,
            type: messageType,
            sent_by: "human",
          };
          if (persistedMedia) {
            outgoingMessage.media_url = persistedMedia.url;
            outgoingMessage.media_mime = persistedMedia.mime;
            outgoingMessage.media_filename = persistedMedia.filename;
          }

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

            // Move CRM deal to "Atendimento humano" when human responds
            try {
              await moveCRMDealToHumanStage(supabase, userId, accountId, phone);
            } catch (e) {
              console.error("Error moving CRM deal to human stage:", e);
            }

            console.log("Outgoing message saved, AI disabled:", phone);
          }
          continue; // Don't trigger AI for outgoing messages
        }

        const ensuredContact = await ensureContactForConversation(
          supabase,
          userId,
          accountId,
          phone,
          contactName,
        );

        // Check if there's an active follow-up and mark as engaged
        if (!isFromMe) {
          const { data: activeFollowup } = await supabase
            .from("followup_tracking")
            .select("id, current_step")
            .eq("user_id", userId)
            .eq("phone", phone)
            .eq("status", "pending")
            .maybeSingle();

          if (activeFollowup) {
            const isMorningStep = activeFollowup.current_step % 2 === 1;
            await supabase
              .from("followup_tracking")
              .update({
                status: "engaged",
                engagement_data: {
                  engaged_at_step: activeFollowup.current_step,
                  engaged_at_turn: isMorningStep ? "morning" : "afternoon",
                  engaged_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", activeFollowup.id);

            console.log("Follow-up engaged by client response:", phone, "at step", activeFollowup.current_step);
          }
        }

        // Handle incoming messages
        const isMediaMessage = isImageMessage || isDocumentMessage || isStickerMessage;
        const newMessage: any = {
          id: msg.key?.id || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: false,
          content,
          type: messageType,
          sent_by: "human",
        };
        // Store media key so AI agent can fetch the original media for vision analysis
        if (isMediaMessage && messageKey) {
          newMessage.media_key = messageKey;
          newMessage.media_type = isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker";
        }
        if (persistedMedia) {
          newMessage.media_url = persistedMedia.url;
          newMessage.media_mime = persistedMedia.mime;
          newMessage.media_filename = persistedMedia.filename;
        }

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

          if (ensuredContact?.id) {
            await linkOpenCRMDealToContact(
              supabase,
              userId,
              accountId,
              phone,
              ensuredContact.id,
              contactName,
            );
          }

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
              const mediaInfo = (isImageMessage || isDocumentMessage || isStickerMessage) ? { messageKey, instanceName, mediaType: isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker" } : undefined;
              await triggerAIResponse(supabase, userId, accountId, phone, content, aiConfig?.response_delay_seconds, mediaInfo);
            }
          } else if (conversation.ai_active) {
            // AI already active, trigger response with delay
            const mediaInfo = (isImageMessage || isDocumentMessage || isStickerMessage) ? { messageKey, instanceName, mediaType: isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker" } : undefined;
            await triggerAIResponse(supabase, userId, accountId, phone, content, aiConfig?.response_delay_seconds, mediaInfo);
          }
        } else {
          // New conversation - check if should activate AI
          const shouldActivateAI = checkKeywordActivation();

          await supabase
            .from("whatsapp_conversations")
            .insert({
              user_id: userId,
              account_id: accountId,
              phone,
              contact_name: contactName,
              messages: [newMessage],
              last_message_at: new Date().toISOString(),
              total_messages: 1,
              ai_active: shouldActivateAI,
            });

          // Fire-and-forget: fetch WhatsApp profile picture for this new contact
          try {
            const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-whatsapp-profile-pictures`;
            fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ phone, instanceName }),
            }).catch((err) => console.error("Profile picture sync failed:", err));
          } catch (e) {
            console.error("Failed to trigger profile picture sync:", e);
          }

          // Create CRM deal in "Atendimento IA" stage for new conversations
          try {
            await createCRMDealForNewConversation(
              supabase,
              userId,
              accountId,
              phone,
              contactName,
              ensuredContact?.id ?? null,
            );
          } catch (e) {
            console.error("Error creating CRM deal:", e);
          }

          if (shouldActivateAI) {
            console.log("AI activated for new conversation:", phone);
            const mediaInfo = (isImageMessage || isDocumentMessage || isStickerMessage) ? { messageKey, instanceName, mediaType: isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker" } : undefined;
            await triggerAIResponse(supabase, userId, accountId, phone, content, aiConfig?.response_delay_seconds, mediaInfo);
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

async function triggerAIResponse(supabase: any, userId: string, accountId: string | null, phone: string, messageContent: string, delaySeconds?: number, mediaInfo?: { messageKey: any; instanceName: string; mediaType: string }) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // If delay is configured, use the debounce system
    const delay = delaySeconds ?? 35;
    
    if (delay > 0) {
      const scheduledAt = new Date(Date.now() + delay * 1000).toISOString();
      
      // Upsert pending response - this resets the timer on each new message
      const { error: upsertError } = await supabase
        .from("whatsapp_pending_responses")
        .upsert({
          user_id: userId,
          account_id: accountId,
          phone,
          scheduled_at: scheduledAt,
          processed: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,phone" });
      
      if (upsertError) {
        console.error("Error upserting pending response:", upsertError);
      }
      
      console.log(`AI response scheduled for ${phone} in ${delay}s`);
      
      // Call process-pending-ai immediately (it will sleep internally until scheduled_at)
      // Use fire-and-forget fetch (don't await) so the webhook responds quickly
      fetch(`${supabaseUrl}/functions/v1/process-pending-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ userId, phone, delayMs: delay * 1000 }),
      }).catch(err => {
        console.error("Error calling process-pending-ai:", err);
      });
      
      return;
    }
    
    // No delay configured, call AI immediately (fallback)
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ userId, phone, messageContent, mediaInfo }),
    });
  } catch (error) {
    console.error("Error triggering AI:", error);
  }
}

async function triggerSupportAI(phone: string, messageContent: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`Scheduling support AI for ${phone} (debounce)`);

  // Get delay from system_ai_config
  const { data: aiConfig } = await supabase
    .from("system_ai_config")
    .select("response_delay_seconds")
    .limit(1)
    .maybeSingle();

  const delaySeconds = aiConfig?.response_delay_seconds ?? 35;
  const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  // Upsert pending response (resets timer on each new message)
  await supabase
    .from("system_pending_responses")
    .upsert(
      { phone, scheduled_at: scheduledAt, processed: false, updated_at: new Date().toISOString() },
      { onConflict: "phone" }
    );

  // Fire-and-forget the delayed processor
  fetch(`${supabaseUrl}/functions/v1/process-pending-support-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ phone, delayMs: delaySeconds * 1000 }),
  }).catch(err => console.error("Error calling process-pending-support-ai:", err));
}

const DEFAULT_CRM_STAGES = [
  { name: "Atendimento IA", position: 0, color: "#6366f1" },
  { name: "Atendimento humano", position: 1, color: "#8b5cf6" },
  { name: "Agendamento Realizado", position: 2, color: "#f59e0b" },
  { name: "Agendamento Confirmado", position: 3, color: "#f97316" },
  { name: "Compareceu", position: 4, color: "#22c55e" },
  { name: "Venda realizada", position: 5, color: "#6366f1" },
];

async function ensureCRMPipeline(supabase: any, userId: string, accountId: string | null): Promise<{ pipelineId: string; stages: any[] }> {
  const { data: pipelines } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  let pipelineId: string;

  if (pipelines && pipelines.length > 0) {
    pipelineId = pipelines[0].id;
  } else {
    const { data: newPipeline } = await supabase
      .from("crm_pipelines")
      .insert({ user_id: userId, account_id: accountId, name: "Vendas" })
      .select("id")
      .single();

    if (!newPipeline) throw new Error("Failed to create pipeline");
    pipelineId = newPipeline.id;

    const stages = DEFAULT_CRM_STAGES.map((s) => ({
      ...s,
      pipeline_id: pipelineId,
      user_id: userId,
      account_id: accountId,
    }));
    await supabase.from("crm_stages").insert(stages);
  }

  const { data: stagesData } = await supabase
    .from("crm_stages")
    .select("id, name, position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  return { pipelineId, stages: stagesData || [] };
}

async function ensureContactForConversation(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  contactName: string | null,
) {
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id, name, account_id")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (existingContact) {
    const updates: Record<string, any> = {};
    if (!existingContact.name && contactName) updates.name = contactName;
    if (!existingContact.account_id && accountId) updates.account_id = accountId;

    if (Object.keys(updates).length === 0) {
      return existingContact;
    }

    const { data: updatedContact } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", existingContact.id)
      .select("id, name, account_id")
      .single();

    return updatedContact || existingContact;
  }

  const { data: createdContact } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      account_id: accountId,
      assigned_to: userId,
      phone,
      name: contactName || null,
      tags: ["whatsapp"],
    })
    .select("id, name, account_id")
    .single();

  return createdContact;
}

async function linkOpenCRMDealToContact(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  contactId: string,
  contactName: string | null,
) {
  const { stages } = await ensureCRMPipeline(supabase, userId, accountId);
  const stageIds = stages.map((stage: any) => stage.id);
  if (stageIds.length === 0) return;

  const titleCandidates = [contactName, phone].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index);
  if (titleCandidates.length === 0) return;

  const { data: orphanDeals } = await supabase
    .from("crm_deals")
    .select("id")
    .eq("user_id", userId)
    .in("stage_id", stageIds)
    .in("title", titleCandidates)
    .is("contact_id", null)
    .is("won_at", null)
    .is("lost_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const orphanDeal = orphanDeals?.[0];
  if (!orphanDeal) return;

  const updates: Record<string, any> = { contact_id: contactId, updated_at: new Date().toISOString() };
  if (contactName) updates.title = contactName;

  await supabase
    .from("crm_deals")
    .update(updates)
    .eq("id", orphanDeal.id);
}

async function createCRMDealForNewConversation(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  contactName: string | null,
  contactId: string | null,
) {
  const { stages } = await ensureCRMPipeline(supabase, userId, accountId);
  
  const aiStage = stages.find((s: any) => s.name === "Atendimento IA") || stages[0];
  if (!aiStage) return;

  const contact = contactId ? { id: contactId } : null;

  if (contact) {
    const stageIds = stages.map((s: any) => s.id);
    const { data: existingDeals } = await supabase
      .from("crm_deals")
      .select("id")
      .eq("user_id", userId)
      .eq("contact_id", contact.id)
      .in("stage_id", stageIds)
      .is("won_at", null)
      .is("lost_at", null)
      .limit(1);

    if (existingDeals && existingDeals.length > 0) {
      console.log("CRM deal already exists for contact:", phone);
      return;
    }
  }

  const { count } = await supabase
    .from("crm_deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", aiStage.id)
    .eq("user_id", userId);

  const dealData: any = {
    user_id: userId,
    account_id: accountId,
    stage_id: aiStage.id,
    title: contactName || phone,
    position: count || 0,
    priority: "medium",
    tags: ["whatsapp"],
  };

  if (contact) {
    dealData.contact_id = contact.id;
  }

  await supabase.from("crm_deals").insert(dealData);
  console.log("CRM deal created for new conversation:", phone);
}

async function moveCRMDealToHumanStage(supabase: any, userId: string, accountId: string | null, phone: string) {
  const { stages } = await ensureCRMPipeline(supabase, userId, accountId);
  
  const aiStage = stages.find((s: any) => s.name === "Atendimento IA") || stages[0];
  const humanStage = stages.find((s: any) => s.name === "Atendimento humano") || stages[1];
  if (!aiStage || !humanStage) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (!contact) return;

  const { data: deals } = await supabase
    .from("crm_deals")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_id", contact.id)
    .eq("stage_id", aiStage.id)
    .is("won_at", null)
    .is("lost_at", null)
    .limit(1);

  if (deals && deals.length > 0) {
    await supabase
      .from("crm_deals")
      .update({ stage_id: humanStage.id, updated_at: new Date().toISOString() })
      .eq("id", deals[0].id);
    console.log("CRM deal moved to Atendimento humano:", phone);
  }
}
