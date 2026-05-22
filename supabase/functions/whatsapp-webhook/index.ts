import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { persistEvolutionMedia } from "../_media.ts";
import { resolveAccountId } from "../_account.ts";
import { normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeTriggerText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function tryStartAttendanceFlow(
  supabase: any,
  phone: string,
  content: string,
  isNewConversation: boolean,
): Promise<{ matched: boolean; pauseAi: boolean }> {
  try {
    if (!content) return { matched: false, pauseAi: false };
    const normalized = normalizeTriggerText(content);
    if (!normalized) return { matched: false, pauseAi: false };

    const { data: flows } = await supabase
      .from("attendance_flows")
      .select("id, trigger_text, trigger_match_mode, pause_support_ai, only_first_contact")
      .eq("is_active", true);

    if (!flows || flows.length === 0) return { matched: false, pauseAi: false };

    let matched: any = null;
    for (const f of flows) {
      const trig = normalizeTriggerText(f.trigger_text || "");
      if (!trig) continue;
      if (f.only_first_contact && !isNewConversation) continue;
      if (f.trigger_match_mode === "contains") {
        if (normalized.includes(trig)) { matched = f; break; }
      } else {
        if (normalized === trig) { matched = f; break; }
      }
    }

    if (!matched) return { matched: false, pauseAi: false };

    // Garante que não há outro run ativo para esse phone+flow
    const { data: existing } = await supabase
      .from("attendance_flow_runs")
      .select("id")
      .eq("flow_id", matched.id)
      .eq("phone", phone)
      .eq("status", "running")
      .maybeSingle();

    if (!existing) {
      await supabase.from("attendance_flow_runs").insert({
        flow_id: matched.id,
        phone,
        current_step: 0,
        status: "running",
        next_run_at: new Date().toISOString(),
        trigger_message: content,
      });
    }

    // Dispatch fire-and-forget
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${url}/functions/v1/attendance-flow-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: "{}",
    }).catch(() => {});

    return { matched: true, pauseAi: matched.pause_support_ai !== false };
  } catch (e) {
    console.error("tryStartAttendanceFlow error:", e);
    return { matched: false, pauseAi: false };
  }
}

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
      .select("user_id, id, status, instance_name, ai_enabled, followup_enabled, initial_sync_completed_at")
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
          const ownerJid = data?.wuid || data?.wid || data?.ownerJid || null;
          const phoneNumber = ownerJid ? String(ownerJid).split("@")[0] : null;
          const profileName = data?.profileName || data?.pushName || null;
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

          // Unwrap ephemeral / viewOnce / documentWithCaption wrappers from Evolution
          const innerMsg =
            msg.message?.ephemeralMessage?.message ||
            msg.message?.viewOnceMessage?.message ||
            msg.message?.viewOnceMessageV2?.message ||
            msg.message?.viewOnceMessageV2Extension?.message ||
            msg.message?.documentWithCaptionMessage?.message ||
            msg.message;
          if (innerMsg && innerMsg !== msg.message) {
            msg.message = { ...msg.message, ...innerMsg };
          }

          // Detect message type
          const isAudioMessage = !!msg.message?.audioMessage;
          const isImageMessage = !!msg.message?.imageMessage;
          const isDocumentMessage = !!msg.message?.documentMessage;
          const isStickerMessage = !!msg.message?.stickerMessage;
          const isVideoMessage = !!msg.message?.videoMessage;

          let content: string;
          let aiContent: string | null = null;
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
                const transcript = (transcribeData.text || "").trim();
                content = "[Áudio]";
                aiContent = transcript ? `[Áudio transcrito] ${transcript}` : null;
                console.log("System audio transcribed:", transcript.slice(0, 100));
              } else {
                console.error("System transcription failed:", await transcribeResponse.text());
                content = "[Áudio]";
              }
            } catch (error) {
              console.error("System transcription error:", error);
              content = "[Áudio]";
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
            content = "[Vídeo]";
            if (caption) aiContent = `[Vídeo - legenda] ${caption}`;
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
            const labelUI = mediaType === "document" ? "Documento" : (mediaType === "sticker" ? "Figurinha" : "Imagem");
            content = `[${labelUI}]`;
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
                const parts: string[] = [];
                if (caption) parts.push(`Legenda: ${caption}`);
                if (ocrText) parts.push(`Conteúdo extraído:\n${ocrText}`);
                if (parts.length) {
                  aiContent = `[${labelUI} - análise]\n${parts.join("\n\n")}`;
                }
              } else {
                if (caption) aiContent = `[${labelUI} - legenda] ${caption}`;
              }
            } catch (error) {
              console.error("System OCR error:", error);
              if (caption) aiContent = `[${labelUI} - legenda] ${caption}`;
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
          if (aiContent) newMessage.ai_content = aiContent;
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

            // Tenta disparar fluxo de atendimento (campanha) antes da IA de Suporte
            if (!isFromMe) {
              const flowResult = await tryStartAttendanceFlow(supabase, phone, content, false);
              if (flowResult.matched) {
                if (flowResult.pauseAi) {
                  await supabase.from("system_whatsapp_conversations")
                    .update({ ai_active: false })
                    .eq("id", conv.id);
                }
              } else if (conv.ai_active) {
                triggerSupportAI(phone, content).catch(err =>
                  console.error("Error triggering support AI:", err)
                );
              }
            }

            // Mark follow-up tracking as engaged when lead replies
            if (!isFromMe) {
              supabase
                .rpc("system_cancel_followup_sequence", { p_phone: phone, p_reason: "engaged" })
                .then(({ error }) => {
                  if (error) console.error("Error cancelling system follow-up sequence:", error);
                });
              // Pausa notificações de trial quando o lead responde (IA assume)
              supabase
                .rpc("pause_trial_notification_by_phone", { p_phone: phone })
                .then(({ error }) => {
                  if (error) console.error("Error pausing trial notification:", error);
                });
            }

            // Human took over (outgoing human msg) → cancel sequence + AI off
            if (isFromMe) {
              supabase
                .rpc("system_cancel_followup_sequence", { p_phone: phone, p_reason: "handoff" })
                .then(({ error }) => {
                  if (error) console.error("Error cancelling system follow-up sequence (handoff):", error);
                });
            }
          } else {
            const { data: insertedConv } = await supabase
              .from("system_whatsapp_conversations")
              .insert({
                phone,
                contact_name: contactName,
                messages: [newMessage],
                last_message_at: new Date().toISOString(),
                total_messages: 1,
                ai_active: !isFromMe,
              })
              .select("id")
              .maybeSingle();

            if (!isFromMe) {
              const flowResult = await tryStartAttendanceFlow(supabase, phone, content, true);
              if (flowResult.matched) {
                if (flowResult.pauseAi && insertedConv?.id) {
                  await supabase.from("system_whatsapp_conversations")
                    .update({ ai_active: false })
                    .eq("id", insertedConv.id);
                }
              } else {
                triggerSupportAI(phone, content).catch(err =>
                  console.error("Error triggering support AI:", err)
                );
              }
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
        const ownerJid = data?.wuid || data?.wid || data?.ownerJid || null;
        const phoneNumber = ownerJid ? String(ownerJid).split("@")[0] : null;
        const profileName = data?.profileName || data?.pushName || null;

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

        // Importação inicial: só dispara uma vez por instância (primeira conexão / recriação).
        // Reconexões posteriores NÃO reimportam histórico nem mexem na IA das conversas existentes.
        if (!instanceData.initial_sync_completed_at) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const instanceRowId = instanceData.id;

          (async () => {
            try {
              let offset = 0;
              let pages = 0;
              const MAX_PAGES = 10; // teto de segurança (~400 chats)
              while (pages < MAX_PAGES) {
                const resp = await fetch(`${supabaseUrl}/functions/v1/sync-whatsapp-conversations`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    userId,
                    instanceName,
                    daysBack: 7,
                    forceDisableAI: true,
                    offset,
                  }),
                });
                if (!resp.ok) {
                  console.error("Initial sync page failed:", await resp.text());
                  break;
                }
                const json = await resp.json();
                pages++;
                if (!json?.hasMore) break;
                offset = json.nextOffset;
              }

              await supabase
                .from("whatsapp_instances")
                .update({ initial_sync_completed_at: new Date().toISOString() })
                .eq("id", instanceRowId);

              console.log(`Initial sync completed for user ${userId} (${pages} page(s))`);
            } catch (err) {
              console.error("Error during initial sync loop:", err);
            }
          })();

          console.log("Initial conversation sync started for user:", userId);
        } else {
          console.log("Reconnection detected — skipping initial sync for user:", userId);
        }
      } else if (state === "close" || state === "disconnected") {
        const previousStatus = instanceData.status;
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

        // Notify user only on real connection drops (was previously connected)
        if (previousStatus === "connected") {
          notifyUserDisconnected(supabase, userId).catch((err) =>
            console.error("Error sending disconnection notification:", err)
          );
        }
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

        // Unwrap ephemeral / viewOnce / documentWithCaption wrappers
        const innerMsg2 =
          msg.message?.ephemeralMessage?.message ||
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.viewOnceMessageV2Extension?.message ||
          msg.message?.documentWithCaptionMessage?.message ||
          msg.message;
        if (innerMsg2 && innerMsg2 !== msg.message) {
          msg.message = { ...msg.message, ...innerMsg2 };
        }

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
        let aiContent: string | null = null;
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
                  instanceName,
                  userId,
                  phone,
                }),
              }
            );

            if (transcribeResponse.ok) {
              const transcribeData = await transcribeResponse.json();
              const transcript = (transcribeData.text || "").trim();
              content = "[Áudio]";
              aiContent = transcript ? `[Áudio transcrito] ${transcript}` : null;
              console.log("Audio transcribed:", transcript.slice(0, 100));
            } else {
              const errorText = await transcribeResponse.text();
              console.error("Transcription failed:", errorText);
              content = "[Áudio]";
            }
          } catch (error) {
            console.error("Transcription error:", error);
            content = "[Áudio]";
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

          const labelUI = mediaType === "document" ? "Documento" : (mediaType === "sticker" ? "Figurinha" : "Imagem");
          content = `[${labelUI}]`;
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
                  mediaType,
                  userId,
                  phone,
                }),
              }
            );

            if (ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              const ocrText = ocrData.text || "";
              const parts: string[] = [];
              if (caption) parts.push(`Legenda: ${caption}`);
              if (ocrText) parts.push(`Conteúdo extraído:\n${ocrText}`);
              if (parts.length) {
                aiContent = `[${labelUI} - análise]\n${parts.join("\n\n")}`;
              }
              console.log("OCR processed:", (aiContent || "").slice(0, 100));
            } else {
              const errorText = await ocrResponse.text();
              console.error("OCR failed:", errorText);
              if (caption) aiContent = `[${labelUI} - legenda] ${caption}`;
            }
          } catch (error) {
            console.error("OCR error:", error);
            if (caption) aiContent = `[${labelUI} - legenda] ${caption}`;
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
          content = "[Vídeo]";
          if (caption) aiContent = `[Vídeo - legenda] ${caption}`;
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
          .select("id, messages, ai_active, outcome, assigned_to, instance_id")
          .eq("user_id", userId)
          .eq("phone", phone)
          .maybeSingle();

        // Handle outgoing messages (sent by human via WhatsApp)
        if (isFromMe) {
          const outgoingId = msg.key?.id || null;
          // Dedup: se a mensagem já foi gravada pelo whatsapp-ai-agent
          // com o mesmo id da Evolution, este é apenas o eco do envio.
          // NÃO duplica no histórico, NÃO desativa a IA, NÃO cancela follow-up.
          if (outgoingId && conversation) {
            const existing = (conversation.messages || []) as any[];
            const already = existing.find((m) => m?.id === outgoingId);
            if (already) {
              console.log(`[webhook] echo de mensagem da IA (id=${outgoingId}) — pulando duplicata`);
              continue;
            }
          }

          const outgoingMessage: any = {
            id: outgoingId || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            from_me: true,
            content,
            type: messageType,
            sent_by: "human",
          };
          if (aiContent) outgoingMessage.ai_content = aiContent;
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

            // Humano assumiu → cancela toda a sequência de follow-up
            try {
              await supabase.rpc("cancel_followup_sequence", {
                p_user_id: userId,
                p_phone: phone,
                p_reason: "handoff",
              });
            } catch (e) {
              console.error("Error cancelling followup sequence (handoff):", e);
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
          // Cliente respondeu → cancela sequência inteira (engaged)
          const { error: cancelErr } = await supabase.rpc("cancel_followup_sequence", {
            p_user_id: userId,
            p_phone: phone,
            p_reason: "engaged",
          });
          if (cancelErr) console.error("Error cancelling followup sequence:", cancelErr);

          // Cancela também follow-ups pendentes de vídeo de produto Igreen
          try {
            await supabase
              .from("igreen_product_video_followups")
              .update({ cancelled_at: new Date().toISOString(), cancel_reason: "client_replied" })
              .eq("account_id", accountId)
              .eq("phone", phone)
              .is("sent_at", null)
              .is("cancelled_at", null);
          } catch (e) {
            console.error("Error cancelling igreen video followup:", e);
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
        if (aiContent) newMessage.ai_content = aiContent;
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

          // Se a conversa foi finalizada anteriormente (won/lost/abandoned)
          // e o cliente voltou a falar, REABRE o atendimento como uma nova jornada:
          // limpa outcome, reativa IA, libera assigned_to e cria um novo deal
          // (a roleta vai redistribuir quando ocorrer handoff).
          const wasFinalized = !!conversation.outcome;
          const conversationUpdate: Record<string, any> = {
            messages: updatedMessages,
            contact_name: contactName || undefined,
            last_message_at: new Date().toISOString(),
            total_messages: updatedMessages.length,
            updated_at: new Date().toISOString(),
          };
          // Garante o vínculo com a instância correta (departamento) quando ausente
          if (!conversation.instance_id) {
            conversationUpdate.instance_id = instanceData.id;
          }
          if (wasFinalized) {
            conversationUpdate.outcome = null;
            conversationUpdate.outcome_reason = null;
            conversationUpdate.outcome_value_cents = null;
            conversationUpdate.closed_at = null;
            conversationUpdate.closed_by = null;
            conversationUpdate.assigned_to = null;
            conversationUpdate.ai_active = true;
          }

          await supabase
            .from("whatsapp_conversations")
            .update(conversationUpdate)
            .eq("id", conversation.id);

          if (wasFinalized) {
            try {
              await createCRMDealForNewConversation(
                supabase,
                userId,
                accountId,
                phone,
                contactName,
                ensuredContact?.id ?? null,
              );
              console.log("Conversation reopened — new CRM deal created:", phone);
            } catch (e) {
              console.error("Error creating CRM deal on reopen:", e);
            }
          }

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
          if (wasFinalized) {
            // Conversa reaberta: dispara IA imediatamente para seguir o fluxo (handoff → roleta)
            const mediaInfo = (isImageMessage || isDocumentMessage || isStickerMessage) ? { messageKey, instanceName, mediaType: isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker" } : undefined;
            if (instanceData.ai_enabled !== false) {
              await triggerAIResponse(supabase, userId, accountId, phone, content, aiConfig?.response_delay_seconds, mediaInfo);
            }
          } else if (!conversation.ai_active && aiConfig?.keyword_activation_enabled && instanceData.ai_enabled !== false) {
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
          } else if (conversation.ai_active && instanceData.ai_enabled !== false) {
            // AI already active, trigger response with delay
            const mediaInfo = (isImageMessage || isDocumentMessage || isStickerMessage) ? { messageKey, instanceName, mediaType: isImageMessage ? "image" : isDocumentMessage ? "document" : "sticker" } : undefined;
            await triggerAIResponse(supabase, userId, accountId, phone, content, aiConfig?.response_delay_seconds, mediaInfo);
          }
        } else {
          // New conversation - check if should activate AI
          const instanceAIEnabled = instanceData.ai_enabled !== false;
          const shouldActivateAI = instanceAIEnabled && checkKeywordActivation();

          await supabase
            .from("whatsapp_conversations")
            .insert({
              user_id: userId,
              account_id: accountId,
              instance_id: instanceData.id,
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

async function notifyUserDisconnected(supabase: any, userId: string) {
  try {
    // Fetch profile to get user's WhatsApp/phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.phone) {
      console.log("notifyUserDisconnected: user has no phone registered", userId);
      return;
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      console.log("notifyUserDisconnected: Evolution API not configured");
      return;
    }

    // Use system instance to send the alert
    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (!sysInstance || sysInstance.status !== "connected") {
      console.log("notifyUserDisconnected: system instance not connected");
      return;
    }

    // Normalize phone (10-11 digits → add 55 prefix)
    const digits = String(profile.phone).replace(/\D/g, "");
    let normalized = digits;
    if (digits.length === 10 || digits.length === 11) {
      normalized = `55${digits}`;
    }

    const firstName = (profile.full_name || "").split(" ")[0] || "";
    const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";

    const message =
      `⚠️ *Atenção: WhatsApp desconectado*\n\n` +
      `${greeting} Detectamos que o seu WhatsApp conectado ao *Theo IA* foi desconectado.\n\n` +
      `Enquanto não reconectar, a IA *não vai responder* aos seus clientes e novas mensagens não serão recebidas.\n\n` +
      `🔗 Reconecte agora em: https://theoia.com.br/whatsapp\n\n` +
      `Se precisar de ajuda, é só responder aqui.`;

    const resp = await fetch(`${evolutionUrl}/message/sendText/${sysInstance.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: normalized, text: message }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("notifyUserDisconnected: send failed", resp.status, txt.slice(0, 200));
      return;
    }

    console.log(`Disconnection alert sent to user ${userId} (${normalized})`);
  } catch (error) {
    console.error("notifyUserDisconnected error:", error);
  }
}
