import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";
import { cleanAIText } from "../_ai_text.ts";
import { getBrazilianPhoneVariant, normalizeBrazilianPhone } from "../_phone.ts";
import { logTextUsage, extractGeminiTokens } from "../_shared/ai-usage.ts";
import { retrieveRelevantContext } from "../_shared/rag.ts";
import { reportApiFailure, reportApiSuccess } from "../_health.ts";
import { buildAgentSystemPrompt } from "../_ai_system_prompt.ts";
import { getBrtNowParts, buildIgreenProductsPromptBlock } from "../_igreen_flow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detecta se a resposta contém código de function call ao invés de texto natural
function containsFunctionCallCode(text: string): boolean {
  const codePatterns = [
    /print\s*\(/i,
    /default_api\./i,
    /check_available_slots\s*\(/i,
    /create_appointment\s*\(/i,
    /cancel_appointment\s*\(/i,
    /reschedule_appointment\s*\(/i,
    /list_appointments\s*\(/i,
    /confirm_appointment\s*\(/i,
    /update_appointment_tags\s*\(/i,
    /\w+_api\.\w+\s*\(/i,
    /```[\s\S]*```/,
  ];
  return codePatterns.some(pattern => pattern.test(text));
}

// Tenta extrair uma chamada de função do texto com código
function extractFunctionCallFromText(text: string): { name: string; args: Record<string, string> } | null {
  const pattern = /(check_available_slots|create_appointment|cancel_appointment|reschedule_appointment|list_appointments|confirm_appointment|update_appointment_tags)\s*\(\s*([^)]*)\)/i;
  
  const match = text.match(pattern);
  if (match) {
    const funcName = match[1];
    const argsStr = match[2];
    const args: Record<string, string> = {};
    
    const argMatches = argsStr.matchAll(/(\w+)\s*=\s*['"]?([^'",)]+)['"]?/g);
    for (const argMatch of argMatches) {
      args[argMatch[1]] = argMatch[2].trim();
    }
    
    return { name: funcName, args };
  }
  return null;
}

// Tool definitions for function calling
const schedulingTools = {
  function_declarations: [
    {
      name: "check_available_slots",
      description: "Verifica horários disponíveis para agendamento em uma data específica. Use quando o cliente perguntar sobre disponibilidade ou quiser agendar.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data para verificar disponibilidade no formato YYYY-MM-DD"
          }
        },
        required: ["date"]
      }
    },
    {
      name: "create_appointment",
      description: "Cria um novo agendamento após confirmar data, horário e serviço com o cliente.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data do agendamento no formato YYYY-MM-DD"
          },
          time: {
            type: "string",
            description: "Horário do agendamento no formato HH:MM"
          },
          title: {
            type: "string",
            description: "Tipo de serviço ou título do agendamento"
          },
          description: {
            type: "string",
            description: "Detalhes adicionais ou observações"
          },
          client_name: {
            type: "string",
            description: "Nome do cliente informado durante a conversa"
          }
        },
        required: ["date", "time", "title"]
      }
    },
    {
      name: "cancel_appointment",
      description: "Cancela um agendamento existente do cliente.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data do agendamento a cancelar no formato YYYY-MM-DD"
          },
          time: {
            type: "string",
            description: "Horário do agendamento a cancelar no formato HH:MM"
          }
        },
        required: ["date", "time"]
      }
    },
    {
      name: "reschedule_appointment",
      description: "Reagenda um agendamento existente do cliente, atualizando o agendamento atual para a nova data e horário. Use quando o cliente pedir para remarcar/reagendar e informar o novo horário.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "ID do agendamento existente a reagendar, se disponível no contexto"
          },
          date: {
            type: "string",
            description: "Nova data do agendamento no formato YYYY-MM-DD"
          },
          time: {
            type: "string",
            description: "Novo horário do agendamento no formato HH:MM"
          },
          title: {
            type: "string",
            description: "Tipo de serviço ou título do agendamento"
          }
        },
        required: ["date", "time"]
      }
    },
    {
      name: "list_appointments",
      description: "Lista os agendamentos do cliente.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data opcional para filtrar agendamentos no formato YYYY-MM-DD"
          }
        },
        required: []
      }
    },
    {
      name: "confirm_appointment",
      description: "Confirma a presença do cliente em um agendamento. Use quando o cliente disser que confirma, que vai comparecer, responder SIM a um lembrete, etc.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "update_appointment_tags",
      description: "Adiciona ou remove tags de um agendamento (ex: realizado, no-show, reagendado).",
      parameters: {
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "ID do agendamento"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags para adicionar ou remover"
          },
          action: {
            type: "string",
            description: "Ação: 'add' para adicionar ou 'remove' para remover tags"
          }
        },
        required: ["tags"]
      }
    },
    {
      name: "send_location",
      description: "Envia a localização do negócio (pin no mapa) para o cliente via WhatsApp. Use quando o cliente perguntar 'onde fica?', 'qual o endereço?', 'como chego aí?', 'me manda a localização', 'localização', 'endereço', etc.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "transfer_to_department",
      description: "Transfere o atendimento para outro departamento (outro número de WhatsApp do mesmo negócio). Use quando o cliente pedir algo fora do escopo deste número (ex.: vendas, suporte, financeiro) e existir um departamento mais adequado disponível. O sistema enviará automaticamente uma mensagem de transição pelo departamento de destino.",
      parameters: {
        type: "object",
        properties: {
          department_slug: {
            type: "string",
            description: "Slug do departamento de destino (ex.: 'vendas', 'suporte', 'financeiro'). Use exatamente o slug listado em DEPARTAMENTOS DISPONÍVEIS."
          },
          reason: {
            type: "string",
            description: "Motivo curto da transferência (ex.: 'Cliente quer falar com vendas')."
          }
        },
        required: ["department_slug"]
      }
    },
    {
      name: "request_human_handoff",
      description: "Transfere o atendimento para um ATENDENTE HUMANO da equipe. Use SEMPRE que o cliente: (a) pedir explicitamente para falar com humano/atendente/responsável, (b) tiver demanda fora do escopo da IA (cancelamento, trancamento, reclamação, problema de pagamento, situação delicada), (c) demonstrar irritação/insatisfação, (d) você não souber resolver após tentar. NUNCA diga que houve 'problema técnico'. Apenas chame esta tool e o sistema notifica a equipe automaticamente.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Motivo curto da transferência (ex.: 'Cliente quer trancar matrícula por motivo de saúde')."
          }
        },
        required: ["reason"]
      }
    },
    {
      name: "send_product_video",
      description: "Envia o vídeo institucional de um produto Igreen (Conexão Green, Conexão Telecom, Conexão Expansão) para o cliente via WhatsApp e agenda automaticamente um follow-up 2 minutos depois ('Conseguiu ver, {nome}?'). Use EXATAMENTE como descrito no fluxo Conexão Green. Após chamar esta tool, NÃO escreva nenhuma mensagem adicional — o sistema cuida do envio e do follow-up.",
      parameters: {
        type: "object",
        properties: {
          product_key: {
            type: "string",
            description: "Chave do produto: 'green' (Conexão Green), 'telecom' (Conexão Telecom) ou 'expansao' (Conexão Expansão)."
          }
        },
        required: ["product_key"]
      }
    }
  ]
};

// Retry with exponential backoff for Gemini API rate limits
async function fetchGeminiWithRetry(apiKey: string, payload: any, maxRetries = 3): Promise<any> {
  // Modelo fixo em gemini-2.5-flash — mais barato e estável que gemini-flash-latest (Gemini 3 Flash),
  // mantendo qualidade suficiente para atendimento WhatsApp.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      reportApiFailure("gemini", e instanceof Error ? e.message : "fetch failed").catch(() => {});
      throw e;
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 2000 + Math.random() * 1000;
      console.log(`Gemini 429 rate limit, retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", errText);
      if (response.status >= 500 || response.status === 401 || response.status === 403) {
        reportApiFailure("gemini", `HTTP ${response.status}: ${errText.slice(0, 200)}`).catch(() => {});
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }
    reportApiSuccess("gemini").catch(() => {});
    return response;
  }
  reportApiFailure("gemini", "Rate limit exceeded after retries").catch(() => {});
  throw new Error("Gemini API rate limit exceeded after retries");
}

// Detecta se o texto do cliente é claramente um pedido de atendimento humano.
function isHumanHandoffRequest(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const patterns = [
    /\bfalar (com )?(uma? )?(atendente|humano|pessoa|alguem|gente|consultor|vendedor|responsavel)\b/,
    /\bquero (falar|conversar) com (alguem|atendente|humano|uma pessoa|gente)\b/,
    /\b(atendente|humano|pessoa real)\b.*\b(por favor|agora|urgente)?\b/,
    /\bme transfere\b/,
    /\btransfere para (um )?(atendente|humano)\b/,
    /\bchama (um )?(atendente|humano|gerente)\b/,
    /\bnao quero (falar|conversar) com (a )?(ia|bot|robo|maquina)\b/,
  ];
  return patterns.some((re) => re.test(t));
}

function normalizeTextForIntent(text: string | null | undefined): string {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isRescheduleIntent(text: string | null | undefined): boolean {
  const t = normalizeTextForIntent(text);
  return /(reagend|remarc|mudar|trocar|alterar)/.test(t);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(base: Date, targetDay: number): Date {
  const current = base.getDay();
  let diff = (targetDay - current + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(base, diff);
}

function parseAppointmentDateTimeFromText(text: string | null | undefined, today: Date): { date: string; time: string } | null {
  const raw = String(text || "");
  const normalized = normalizeTextForIntent(raw);
  const timeMatch = normalized.match(/\b(?:as|às|a|para)?\s*(\d{1,2})(?::|h)(\d{2})?\b/);
  if (!timeMatch) return null;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || "00");
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  let date: Date | null = null;
  const isoMatch = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const brMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (isoMatch) {
    date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
  } else if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]) - 1;
    const yearRaw = brMatch[3] ? Number(brMatch[3]) : today.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    date = new Date(year, month, day);
  } else if (/\bdepois de amanha\b/.test(normalized)) {
    date = addDays(today, 2);
  } else if (/\bamanha\b/.test(normalized)) {
    date = addDays(today, 1);
  } else {
    const weekdays: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      "segunda-feira": 1,
      terca: 2,
      "terca-feira": 2,
      quarta: 3,
      "quarta-feira": 3,
      quinta: 4,
      "quinta-feira": 4,
      sexta: 5,
      "sexta-feira": 5,
      sabado: 6,
    };
    for (const [word, day] of Object.entries(weekdays)) {
      if (new RegExp(`\\b${word}\\b`).test(normalized)) {
        date = nextWeekday(today, day);
        break;
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  return { date: toDateKey(date), time };
}

async function claimHandoffNotification(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const payload = {
    user_id: userId,
    account_id: accountId,
    phone,
    handed_off_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from("whatsapp_ai_sessions")
    .update({ handed_off_at: payload.handed_off_at, updated_at: payload.updated_at })
    .eq("user_id", userId)
    .eq("phone", phone)
    .or(`handed_off_at.is.null,handed_off_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();

  if (updateError) console.error("claimHandoffNotification update error:", updateError);
  if (updated?.id) return true;

  const { error: insertError } = await supabase
    .from("whatsapp_ai_sessions")
    .insert(payload);

  if (!insertError) return true;
  if (insertError.code !== "23505") console.error("claimHandoffNotification insert error:", insertError);
  return false;
}

// Executa o handoff completo (mensagem ao cliente, notificação, roleta, CRM, follow-up).
async function performHandoff(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  contactName: string | null,
  aiConfig: any,
) {
  try {
    const claimed = await claimHandoffNotification(supabase, userId, accountId, phone);
    if (!claimed) {
      console.log("performHandoff skipped: recent handoff already notified for", phone);
      return;
    }

    const handoffMsg = aiConfig?.handoff_message
      || "Entendi! Já estou te transferindo para um atendente da nossa equipe. Em instantes alguém vai te responder por aqui. 🙌";
    try { await sendWhatsAppMessage(supabase, userId, phone, handoffMsg); } catch (e) { console.error("handoff send err:", e); }
    try { await saveAIMessage(supabase, userId, phone, handoffMsg, "ai"); } catch (e) { console.error("handoff save err:", e); }

    try { await notifyHandoff(supabase, userId, phone, contactName); } catch (e) { console.error("notifyHandoff err:", e); }
    try { await applyRouletteOnHandoff(supabase, accountId, userId, phone, contactName); } catch (e) { console.error("roulette err:", e); }
    try { await moveCRMDealToHumanStage(supabase, userId, phone); } catch (e) { console.error("crm move err:", e); }
    try { await supabase.rpc("cancel_followup_sequence", { p_user_id: userId, p_phone: phone, p_reason: "handoff" }); } catch (e) { console.error("cancel followup err:", e); }
  } catch (e) {
    console.error("performHandoff fatal:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY not configured" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, phone, messageContent, contactName, mediaInfo } = await req.json();

    if (!userId || !phone) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const accountId = await resolveAccountId(supabase, userId);

    // Get AI config
    const { data: aiConfig } = await supabase
      .from("whatsapp_ai_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!aiConfig?.active) {
      console.log("AI not active for user:", userId);
      return new Response(JSON.stringify({ skipped: true, reason: "AI not active" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check business hours
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMin] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
    const [endHour, endMin] = (aiConfig.business_hours_end || "18:00").split(":").map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    const businessDays = aiConfig.business_days || [1, 2, 3, 4, 5];

    if (!businessDays.includes(currentDay) || currentTime < startTime || currentTime > endTime) {
      if (aiConfig.out_of_hours_message) {
        await sendWhatsAppMessage(supabase, userId, phone, aiConfig.out_of_hours_message);
        await saveAIMessage(supabase, userId, phone, aiConfig.out_of_hours_message, "ai");
      }
      return new Response(JSON.stringify({ skipped: true, reason: "Outside business hours" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get or create AI session
    const { data: session } = await supabase
      .from("whatsapp_ai_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    // Importante: NÃO bloqueamos a IA aqui mesmo após handoff.
    // A IA deve continuar respondendo até que um humano efetivamente assuma
    // (o que naturalmente desativa via ai_active=false ao enviar mensagem manual).

    // Check message limit
    const messagesCount = session?.messages_without_human || 0;
    // Evita reenviar a mensagem de transferência se já houve handoff recente
    // (dentro dos últimos 60 minutos). O handoff dispara via tool durante a
    // conversa e não deve ser duplicado pelo bloco de limite.
    const recentlyHandedOff = session?.handed_off_at
      ? (Date.now() - new Date(session.handed_off_at).getTime()) < 60 * 60 * 1000
      : false;
    if (messagesCount >= (aiConfig.max_messages_without_human || 10) && !recentlyHandedOff) {
      const claimed = await claimHandoffNotification(supabase, userId, accountId, phone);
      if (!claimed) {
        console.log("Message-limit handoff skipped: recent handoff already notified for", phone);
        return new Response(JSON.stringify({ skipped: true, reason: "Recent handoff already notified" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (aiConfig.handoff_message) {
        await sendWhatsAppMessage(supabase, userId, phone, aiConfig.handoff_message);
        await saveAIMessage(supabase, userId, phone, aiConfig.handoff_message, "ai");
      }

      // Notify registered contacts about handoff
      await notifyHandoff(supabase, userId, phone, contactName);

      // Roleta de Atendimento: sorteia próximo atendente entre os membros da conta
      try {
        await applyRouletteOnHandoff(supabase, accountId, userId, phone, contactName);
      } catch (e) {
        console.error("Error applying roulette on handoff:", e);
      }

      // Move CRM deal to "Atendimento humano"
      try {
        await moveCRMDealToHumanStage(supabase, userId, phone);
      } catch (e) {
        console.error("Error moving CRM deal on handoff:", e);
      }

      return new Response(JSON.stringify({ skipped: true, reason: "Message limit reached" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get conversation history for context
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("messages, instance_id")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    const allMessages = conversation?.messages || [];
    const contextSummary = (allMessages as any[]).find((m: any) => m.type === "context_summary");
    // Otimização de custo: limita o histórico enviado ao Gemini às últimas 10 mensagens
    // e trunca cada mensagem em ~600 chars (≈150 tokens) para evitar mensagens longas
    // (PDFs, listagens) inflarem o input. O resumo de contexto cobre o restante.
    const recentMessages = (allMessages as any[])
      .filter((m: any) => m.type !== "context_summary")
      .slice(-10)
      .map((m: any) => {
        const original = m.ai_content || m.content || "";
        if (typeof original === "string" && original.length > 600) {
          return { ...m, content: original.slice(0, 600) + "…", ai_content: undefined };
        }
        return m;
      });

    // Check if the last incoming message has media for vision analysis
    let mediaBase64: string | null = null;
    let mediaMimeType: string | null = null;
    
    // Try to get media from the explicit mediaInfo parameter first
    if (mediaInfo?.messageKey && mediaInfo?.instanceName) {
      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        
        if (evolutionUrl && evolutionKey) {
          console.log("Fetching media for vision analysis:", mediaInfo.mediaType);
          const mediaResponse = await fetch(
            `${evolutionUrl}/chat/getBase64FromMediaMessage/${mediaInfo.instanceName}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionKey },
              body: JSON.stringify({ message: { key: mediaInfo.messageKey }, convertToMp4: false }),
            }
          );
          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            mediaBase64 = mediaData.base64 || null;
            mediaMimeType = mediaData.mimetype || (mediaInfo.mediaType === "image" ? "image/jpeg" : mediaInfo.mediaType === "document" ? "application/pdf" : "image/webp");
            console.log("Media fetched for vision, size:", mediaBase64?.length || 0);
          }
        }
      } catch (e) {
        console.error("Error fetching media for vision:", e);
      }
    }
    
    // Fallback: check recent messages for media_key if no explicit mediaInfo
    if (!mediaBase64) {
      const lastMediaMsg = [...recentMessages].reverse().find((m: any) => m.media_key && !m.from_me && (m.type === "image" || m.type === "document"));
      if (lastMediaMsg) {
        try {
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
          const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name").eq("user_id", userId).maybeSingle();
          
          if (evolutionUrl && evolutionKey && inst) {
            console.log("Fetching media from conversation history for vision:", lastMediaMsg.media_type);
            const mediaResponse = await fetch(
              `${evolutionUrl}/chat/getBase64FromMediaMessage/${inst.instance_name}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evolutionKey },
                body: JSON.stringify({ message: { key: lastMediaMsg.media_key }, convertToMp4: false }),
              }
            );
            if (mediaResponse.ok) {
              const mediaData = await mediaResponse.json();
              mediaBase64 = mediaData.base64 || null;
              mediaMimeType = mediaData.mimetype || (lastMediaMsg.media_type === "image" ? "image/jpeg" : "application/pdf");
              console.log("Media fetched from history, size:", mediaBase64?.length || 0);
            }
          }
        } catch (e) {
          console.error("Error fetching media from history:", e);
        }
      }
    }

    // Get knowledge base documents — usa RAG por palavras-chave para enviar
    // apenas trechos relevantes à pergunta atual (em vez do documento inteiro).
    // Isso reduz tokens de input em até 90% sem perder qualidade.
    // Cada trecho é prefixado com o produto correspondente (quando houver),
    // para que a IA saiba a qual produto a informação pertence.
    const { data: documents } = await supabase
      .from("knowledge_base_documents")
      .select("content_text, igreen_product_id, file_name")
      .eq("user_id", userId)
      .eq("status", "ready");

    // Mapa de produtos do account (id -> nome) para rotular os trechos
    const productMap = new Map<string, string>();
    try {
      const { data: accProducts } = await supabase
        .from("igreen_account_products")
        .select("id, name, enabled")
        .eq("account_id", accountId);
      (accProducts || []).forEach((p: any) => productMap.set(p.id, p.name));
    } catch (_) { /* opcional */ }

    const docTexts = (documents || [])
      .filter((d: any) => typeof d.content_text === "string" && d.content_text.length > 0)
      .map((d: any) => {
        const productName = d.igreen_product_id ? productMap.get(d.igreen_product_id) : null;
        const header = productName
          ? `[PRODUTO: ${productName}]`
          : `[GERAL]`;
        return `${header}\n${d.content_text}`;
      });

    const knowledgeBase = docTexts.length > 0
      ? retrieveRelevantContext(messageContent || "", docTexts, {
          topK: 3,
          maxChars: 2400,
          chunkSize: 800,
        })
      : "";

    // Get products catalog
    let productsCatalog = "";
    try {
      const { data: userProducts } = await supabase
        .from("products")
        .select("name, description, price_cents, quantity, sku, active")
        .eq("user_id", userId)
        .eq("active", true)
        .order("name")
        .limit(100);

      if (userProducts && userProducts.length > 0) {
        const productsList = userProducts.map((p: any) => {
          const price = (p.price_cents / 100).toFixed(2);
          return `- ${p.name}: R$ ${price}${p.description ? ` | ${p.description}` : ""}${p.quantity > 0 ? ` | Estoque: ${p.quantity}` : " | Sem estoque"}${p.sku ? ` | SKU: ${p.sku}` : ""}`;
        }).join("\n");
        productsCatalog = `\nCATÁLOGO DE PRODUTOS/SERVIÇOS:\n${productsList}\n\nQuando o cliente perguntar sobre produtos, preços ou disponibilidade, use estas informações para responder. Se um produto está sem estoque (quantidade 0), informe que está indisponível no momento.`;
      }
    } catch (e) {
      console.error("Error fetching products:", e);
    }

    // Get today's date for context (em BRT — fuso de Brasília)
    const brt = getBrtNowParts();
    const today = brt.date;
    const todayStr = today.toISOString().split("T")[0];
    const todayFormatted = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

    // Carrega produtos Igreen do account (para listar no prompt + flag de vídeo)
    let igreenProductsBlock = "";
    try {
      if (accountId) {
        const { data: igreenProds } = await supabase
          .from("igreen_account_products")
          .select("id, key, name, description, enabled, video_url")
          .eq("account_id", accountId)
          .order("position", { ascending: true });
        if (igreenProds && igreenProds.length > 0) {
          igreenProductsBlock = buildIgreenProductsPromptBlock({
            agentName: aiConfig.agent_name || "seu assistente",
            greeting: brt.greeting,
            products: (igreenProds as any[]).map(p => ({
              id: p.id,
              key: p.key,
              name: p.name,
              description: p.description,
              enabled: p.enabled,
              has_video: !!p.video_url,
            })),
          });
        }
      }
    } catch (e) {
      console.error("Error loading igreen products:", e);
    }

    // Salvaguarda determinística para reagendamento: quando o cliente já está
    // em fluxo de remarcar e envia nova data/horário, não dependemos do Gemini.
    // Atualizamos o agendamento existente diretamente, evitando "sumir" sem ação.
    const parsedRescheduleTarget = parseAppointmentDateTimeFromText(messageContent, today);
    const recentIndicatesReschedule = isRescheduleIntent(messageContent)
      || recentMessages.slice(-8).some((m: any) => {
        const t = normalizeTextForIntent(m?.content || m?.ai_content || "");
        return isRescheduleIntent(t)
          || /qual seria o novo dia/.test(t)
          || /novo horario/.test(t)
          || /vou cancelar seu agendamento/.test(t);
      });

    if (parsedRescheduleTarget && recentIndicatesReschedule) {
      const { data: aptToReschedule } = await supabase
        .from("appointments")
        .select("id, title, appointment_date, appointment_time")
        .eq("user_id", userId)
        .eq("phone", phone)
        .eq("status", "scheduled")
        .gte("appointment_date", todayStr)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (aptToReschedule) {
        console.log("[RESCHEDULE SAFEGUARD] Executing deterministic reschedule", JSON.stringify({
          appointmentId: aptToReschedule.id,
          target: parsedRescheduleTarget,
        }));

        const rescheduleResult = await executeFunction(supabase, supabaseUrl, "reschedule_appointment", {
          userId,
          phone,
          contactName,
          appointmentId: aptToReschedule.id,
          date: parsedRescheduleTarget.date,
          time: parsedRescheduleTarget.time,
          title: aptToReschedule.title || "Agendamento",
        });

        const reply = rescheduleResult?.success
          ? `Perfeito! Reagendei seu ${aptToReschedule.title || "agendamento"} para ${parsedRescheduleTarget.date} às ${parsedRescheduleTarget.time}. Te esperamos! 💪`
          : String(rescheduleResult?.message || "Não consegui reagendar nesse horário. Pode me passar outra opção?");

        const wid = await sendWhatsAppMessage(supabase, userId, phone, reply);
        await saveAIMessage(supabase, userId, phone, reply, "ai", wid);
        await supabase
          .from("whatsapp_ai_sessions")
          .upsert({
            user_id: userId,
            account_id: accountId,
            phone,
            status: "active",
            messages_without_human: messagesCount + 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,phone" });

        return new Response(JSON.stringify({ success: true, response: reply, rescheduled: !!rescheduleResult?.success }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if this client has upcoming appointments with reminder_sent (pending confirmation)
    let pendingConfirmationContext = "";
    try {
      const { data: pendingAppointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", phone)
        .eq("reminder_sent", true)
        .eq("status", "scheduled")
        .gte("appointment_date", todayStr)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(3);

      if (pendingAppointments && pendingAppointments.length > 0) {
        const aptList = pendingAppointments.map((a: any) => {
          const [h, m] = a.appointment_time.split(":");
          const dateObj = new Date(a.appointment_date + "T00:00:00");
          const dateFormatted = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
          return `- ID: ${a.id} | ${a.title} em ${dateFormatted} às ${h}:${m}`;
        }).join("\n");

        pendingConfirmationContext = `
CONTEXTO IMPORTANTE - CONFIRMAÇÃO DE AGENDAMENTO:
Este cliente recebeu um lembrete automático sobre o(s) seguinte(s) agendamento(s) pendente(s) de confirmação:
${aptList}

REGRAS DE CONFIRMAÇÃO:
1. Se o cliente confirmar a presença (ex: "sim", "confirmo", "vou sim", "confirmado", "ok", "pode ser", "estarei lá"), use a ferramenta confirm_appointment IMEDIATAMENTE.
2. Se o cliente disser que NÃO pode ir (ex: "não posso", "não vou conseguir", "preciso remarcar", "cancela", "reagenda"), faça o seguinte:
   a. Pergunte se deseja CANCELAR ou REAGENDAR
   b. Se quiser cancelar: use cancel_appointment com a data e hora do agendamento
   c. Se quiser reagendar: primeiro cancele o agendamento atual, depois inicie o fluxo de reagendamento (pergunte nova data/horário, verifique disponibilidade, crie novo agendamento)
3. NÃO faça perguntas desnecessárias. Se o cliente claramente confirma ou nega, aja imediatamente.
4. Seja empático e natural na resposta.
`;
      }
    } catch (e) {
      console.error("Error checking pending confirmations:", e);
    }

    // Load ALL upcoming scheduled appointments for this client so the AI
    // knows agendamentos já existentes e NÃO ofereça de novo.
    let existingAppointmentsContext = "";
    try {
      const { data: upcomingAppointments } = await supabase
        .from("appointments")
        .select("id, title, appointment_date, appointment_time, status")
        .eq("user_id", userId)
        .eq("phone", phone)
        .eq("status", "scheduled")
        .gte("appointment_date", todayStr)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(5);

      if (upcomingAppointments && upcomingAppointments.length > 0) {
        const list = upcomingAppointments.map((a: any) => {
          const [h, m] = a.appointment_time.split(":");
          const dateObj = new Date(a.appointment_date + "T00:00:00");
          const dateFormatted = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
          return `- ${a.title} em ${dateFormatted} às ${h}:${m} (ID: ${a.id})`;
        }).join("\n");

        existingAppointmentsContext = `
AGENDAMENTOS JÁ EXISTENTES DESTE CLIENTE:
${list}

REGRA CRÍTICA: Este cliente JÁ POSSUI o(s) agendamento(s) acima. NÃO ofereça novamente "agendar semana experimental", "marcar visita", "agendar avaliação" ou qualquer outro tipo de agendamento que já esteja na lista. Se o cliente perguntar algo geral (ex: "diferenciais", "preço", "como funciona"), responda a dúvida e, se quiser engajar, faça referência ao agendamento existente (ex: "Já te espero ${"${dateFormatted}"} às ${"${h}:${m}"}!" ou "Qualquer coisa antes da sua semana experimental, é só me chamar."). Só ofereça novo agendamento se o cliente pedir explicitamente para remarcar/agendar outro horário.
`;
      }
    } catch (e) {
      console.error("Error loading existing appointments:", e);
    }

    // Build returning client context
    let returningClientContext = "";
    if (contextSummary && contactName) {
      returningClientContext = `
CONTEXTO IMPORTANTE - CLIENTE RETORNANDO:
Este cliente já foi atendido anteriormente. ${contextSummary.content}
INSTRUÇÃO: Cumprimente o cliente pelo nome "${contactName}" de forma calorosa, demonstrando que se lembra dele. Diga algo como "Olá ${contactName}, que bom tê-lo(a) aqui novamente! Em que posso ajudá-lo(a) hoje?". Use o resumo acima para contextualizar o atendimento se relevante.
`;
    } else if (contextSummary) {
      returningClientContext = `
CONTEXTO IMPORTANTE - CLIENTE RETORNANDO:
Este cliente já foi atendido anteriormente. ${contextSummary.content}
INSTRUÇÃO: Cumprimente o cliente de forma calorosa, demonstrando que se lembra dele. Use o resumo acima para contextualizar se relevante.
`;
    }

    // Departamentos disponíveis no account (multi-instância)
    let departmentsBlock = "";
    try {
      if (accountId) {
        const { data: depts } = await supabase
          .from("whatsapp_instances")
          .select("id, display_name, department_slug, status, ai_enabled")
          .eq("account_id", accountId);
        const list = (depts || []).filter((d: any) => d.department_slug && d.status === "connected");
        const currentSlug = list.find((d: any) => d.id === (conversation as any)?.instance_id)?.department_slug;
        const others = list.filter((d: any) => d.department_slug !== currentSlug);
        if (others.length > 0) {
          departmentsBlock = `\nDEPARTAMENTOS DISPONÍVEIS PARA TRANSFERÊNCIA:\n` +
            others.map((d: any) =>
              `- ${d.display_name || d.department_slug} (slug: ${d.department_slug})${d.ai_enabled === false ? " — atendido por humano" : " — atendido por IA"}`
            ).join("\n") +
            `\n\nUse a ferramenta transfer_to_department APENAS quando o cliente claramente precisa de outro setor. Departamento atual: ${currentSlug || "principal"}.\n`;
        }
      }
    } catch (e) {
      console.error("Error loading departments:", e);
    }

    // Build system prompt (compartilhado com test-ai-prompt via _ai_system_prompt.ts)
    const systemPrompt = buildAgentSystemPrompt({
      aiConfig,
      knowledgeBase,
      productsCatalog,
      returningClientContext,
      departmentsBlock,
      existingAppointmentsContext,
      pendingConfirmationContext,
      todayStr,
      todayFormatted,
      brtTime: brt.brtTime,
      brtGreeting: brt.greeting,
      igreenProductsBlock,
    });

    // Build conversation messages
    const conversationMessages = recentMessages.map((msg: any) => ({
      role: msg.from_me ? "model" : "user",
      parts: [{ text: msg.ai_content || msg.content }],
    }));

    // Add current message (with media if available)
    const currentMessageParts: any[] = [];
    if (mediaBase64 && mediaMimeType) {
      // Include the actual image/document for Gemini Vision analysis
      currentMessageParts.push({
        inline_data: {
          mime_type: mediaMimeType,
          data: mediaBase64,
        },
      });
      currentMessageParts.push({ text: messageContent || "Analise esta imagem/documento e responda de acordo com o contexto da conversa." });
    } else {
      currentMessageParts.push({ text: messageContent });
    }
    conversationMessages.push({ role: "user", parts: currentMessageParts });

    // Call Gemini with function calling
    const geminiPayload: any = {
      contents: [
        ...conversationMessages,
      ],
      // systemInstruction nativo do Gemini: mantém a persona/regras em TODOS os
      // turnos com prioridade alta. Empilhar o prompt como turno user/model fazia
      // o modelo "esquecer" a persona em conversas longas e alucinar nichos
      // aleatórios (ex.: "clínica de estética").
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      tools: [schedulingTools],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    let aiReply = "";
    let handoffHandled = false;
    let functionCallsProcessed = 0;
    let createAppointmentCalled = false;
    const maxFunctionCalls = 3;

    while (functionCallsProcessed < maxFunctionCalls) {
      const aiResponse = await fetchGeminiWithRetry(geminiApiKey, geminiPayload);

      const aiData = await aiResponse.json();
      // Registra custo de IA por usuário (texto Gemini)
      try {
        const t = extractGeminiTokens(aiData);
        if (t.input || t.output) {
          await logTextUsage(supabase, {
            userId,
            source: "whatsapp-ai-agent",
            tokensInput: t.input,
            tokensOutput: t.output,
            referenceId: phone,
          });
        }
      } catch (_) { /* noop */ }
      const candidate = aiData.candidates?.[0];
      const content = candidate?.content;

      if (!content?.parts) {
        console.error("Empty AI response");
        break;
      }

      // Check for function calls
      const functionCall = content.parts.find((p: any) => p.functionCall);
      
      if (functionCall) {
        const fc = functionCall.functionCall;
        console.log("Function call:", fc.name, JSON.stringify(fc.args));
        
        if (fc.name === "create_appointment") {
          createAppointmentCalled = true;
        }
        
        // Handle send_location separately
        if (fc.name === "send_location") {
          const locationResult = await executeSendLocation(supabase, userId, phone, aiConfig);
          
          geminiPayload.contents.push(content);
          geminiPayload.contents.push({
            role: "user",
            parts: [{
              functionResponse: {
                name: fc.name,
                response: locationResult,
              }
            }]
          });
          functionCallsProcessed++;
          continue;
        }

        // Handle send_product_video (envia vídeo institucional + agenda follow-up 2min)
        if (fc.name === "send_product_video") {
          const productKey = String(fc.args?.product_key || "green").toLowerCase();
          const videoResult = await executeSendProductVideo(
            supabase,
            userId,
            accountId,
            phone,
            contactName,
            productKey,
          );
          geminiPayload.contents.push(content);
          geminiPayload.contents.push({
            role: "user",
            parts: [{ functionResponse: { name: fc.name, response: videoResult } }],
          });
          // Após enviar o vídeo, encerramos o turno: o follow-up de 2min é
          // automático e a IA NÃO deve mandar texto extra agora.
          if ((videoResult as any)?.success) {
            aiReply = "";
            functionCallsProcessed = maxFunctionCalls;
            break;
          }
          functionCallsProcessed++;
          continue;
        }

        // Handle request_human_handoff (transfere para humano da equipe)
        if (fc.name === "request_human_handoff") {
          const handoffReason = String(fc.args?.reason || "Solicitação de atendimento humano");
          console.log("[HANDOFF] Tool request_human_handoff acionada:", handoffReason);

          const claimed = await claimHandoffNotification(supabase, userId, accountId, phone);
          if (!claimed) {
            console.log("[HANDOFF] Ignorado: notificação já enviada recentemente para", phone);
            handoffHandled = true;
            aiReply = "";
            functionCallsProcessed = maxFunctionCalls;
            break;
          }

          // 2. IA continua ativa (ai_active permanece true) até um humano
          //    efetivamente assumir e enviar mensagem manual.

          // 3. Mensagem de transição ao cliente (se configurada)
          const handoffMsg = aiConfig.handoff_message
            || "Entendi! Já estou te transferindo para um atendente da nossa equipe. Em instantes alguém vai te responder por aqui. 🙌";
          await sendWhatsAppMessage(supabase, userId, phone, handoffMsg);
          await saveAIMessage(supabase, userId, phone, handoffMsg, "ai");

          // 4. Notifica equipe
          try { await notifyHandoff(supabase, userId, phone, contactName); } catch (e) { console.error("notifyHandoff err:", e); }
          try { await applyRouletteOnHandoff(supabase, accountId, userId, phone, contactName); } catch (e) { console.error("roulette err:", e); }
          try { await moveCRMDealToHumanStage(supabase, userId, phone); } catch (e) { console.error("crm move err:", e); }
          try { await supabase.rpc("cancel_followup_sequence", { p_user_id: userId, p_phone: phone, p_reason: "handoff" }); } catch (e) { console.error("cancel followup err:", e); }

          handoffHandled = true;
          aiReply = "";
          functionCallsProcessed = maxFunctionCalls;
          break;
        }

        // Handle transfer_to_department
        if (fc.name === "transfer_to_department") {
          const transferResult = await executeTransferToDepartment(
            supabase,
            userId,
            accountId,
            phone,
            String(fc.args?.department_slug || ""),
            String(fc.args?.reason || ""),
          );
          geminiPayload.contents.push(content);
          geminiPayload.contents.push({
            role: "user",
            parts: [{ functionResponse: { name: fc.name, response: transferResult } }],
          });
          // Encerra o loop: o departamento de destino assumiu o atendimento
          if ((transferResult as any)?.success) {
            aiReply = "";
            functionCallsProcessed = maxFunctionCalls;
            break;
          }
          functionCallsProcessed++;
          continue;
        }
        
        // Execute the function
        const functionResult = await executeFunction(supabase, supabaseUrl, fc.name, {
          ...fc.args,
          userId,
          phone,
          contactName,
        });

        console.log("Function result:", JSON.stringify(functionResult));

        // Add function call and result to context
        geminiPayload.contents.push(content);
        geminiPayload.contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: fc.name,
              response: functionResult,
            }
          }]
        });

        functionCallsProcessed++;
        continue;
      }

      // No function call, get text response
      const textPart = content.parts.find((p: any) => p.text);
      if (textPart) {
        const responseText = textPart.text;
        
        // Detectar se a resposta contém código de function call
        if (containsFunctionCallCode(responseText)) {
          console.log("Detected code in response, attempting to extract function call");
          
          const extracted = extractFunctionCallFromText(responseText);
          
          if (extracted) {
            // Executar a função extraída
            console.log("Extracted function:", extracted.name, extracted.args);
            
            const functionResult = await executeFunction(supabase, supabaseUrl, extracted.name, {
              ...extracted.args,
              userId,
              phone,
              contactName,
            });

            console.log("Extracted function result:", functionResult);

            // Adicionar ao contexto e continuar
            geminiPayload.contents.push({
              role: "model",
              parts: [{ functionCall: { name: extracted.name, args: extracted.args } }]
            });
            geminiPayload.contents.push({
              role: "user",
              parts: [{
                functionResponse: {
                  name: extracted.name,
                  response: functionResult,
                }
              }]
            });

            functionCallsProcessed++;
            continue; // Continuar loop para obter resposta natural
          } else {
            // Não conseguiu extrair, pedir nova resposta
            console.log("Could not extract function, requesting natural language response");
            geminiPayload.contents.push({
              role: "user",
              parts: [{ 
                text: "Responda APENAS em linguagem natural para o cliente. NÃO use código, funções print(), ou sintaxe de programação. Use as ferramentas disponibilizadas pelo sistema." 
              }]
            });
            functionCallsProcessed++;
            continue;
          }
        }
        
        // Resposta normal, usar
        aiReply = responseText;
      }
      break;
    }

    if (!aiReply) {
      if (handoffHandled) {
        return new Response(JSON.stringify({ handoff: true, handled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("No AI reply generated");
      // Fallback: se o cliente claramente pediu um humano, faz o handoff manualmente
      // mesmo que o Gemini tenha falhado em chamar a tool.
      if (isHumanHandoffRequest(messageContent)) {
        console.log("[HANDOFF FALLBACK] Detectado pedido de atendimento humano por palavra-chave");
        await performHandoff(supabase, userId, accountId, phone, contactName, aiConfig);
        return new Response(JSON.stringify({ handoff: true, fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No AI response" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    aiReply = cleanAIText(aiReply);

    // Safeguard: detect if AI claims appointment was created without calling the tool
    const claimsAppointmentCreated = /agendamento\s*(confirmado|criado|marcado|realizado|feito)/i.test(aiReply) 
      || /confirmad[oa].*agendamento/i.test(aiReply)
      || /marcad[oa]\s+para/i.test(aiReply);
    
    if (claimsAppointmentCreated && !createAppointmentCalled) {
      console.warn("[SAFEGUARD] AI claims appointment was created but create_appointment was never called. Forcing function call.");
      
      // Try to extract date/time from the AI reply or conversation
      const dateMatch = aiReply.match(/(\d{4}-\d{2}-\d{2})/);
      const timeMatch = aiReply.match(/(\d{1,2}:\d{2})/);
      
      if (dateMatch && timeMatch) {
        const forceResult = await executeFunction(supabase, supabaseUrl, "create_appointment", {
          userId,
          phone,
          contactName,
          date: dateMatch[1],
          time: timeMatch[1],
          title: "Agendamento",
        });
        console.log("[SAFEGUARD] Force create result:", JSON.stringify(forceResult));
      }
    }

    // Split response into parts for more human-like delivery
    const parts = splitMessage(aiReply);

    // Send each part with typing simulation delay AND persist each one with the
    // real WhatsApp message id returned by Evolution. The webhook will then
    // dedupe by id when the fromMe=true echo arrives — no more duplicate
    // messages in the conversation history and the AI no longer "disables
    // itself" right after replying.
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // Delay proporcional ao tamanho da mensagem anterior (simula digitação ~40 chars/sec)
        const typingDelay = Math.min(Math.max(parts[i].length * 25, 1000), 4000);
        await delay(typingDelay + Math.random() * 800);
      }
      const wid = await sendWhatsAppMessage(supabase, userId, phone, parts[i]);
      await saveAIMessage(supabase, userId, phone, parts[i], "ai", wid);
    }

    // Update session
    await supabase
      .from("whatsapp_ai_sessions")
      .upsert({
        user_id: userId,
        account_id: accountId,
        phone,
        status: "active",
        messages_without_human: messagesCount + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,phone" });

    console.log("AI response sent to:", phone);

    return new Response(JSON.stringify({ success: true, response: aiReply }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("AI Agent error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

async function executeSendLocation(supabase: any, userId: string, phone: string, aiConfig: any): Promise<any> {
  if (!aiConfig.business_latitude || !aiConfig.business_longitude) {
    return { success: false, error: "Localização do negócio não configurada." };
  }

  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return { success: false, error: "API de envio não configurada." };
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      return { success: false, error: "Instância WhatsApp não encontrada." };
    }

    const response = await fetch(`${evolutionUrl}/message/sendLocation/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        locationMessage: {
          name: aiConfig.business_location_name || "Nosso endereço",
          address: aiConfig.business_address || "",
          latitude: aiConfig.business_latitude,
          longitude: aiConfig.business_longitude,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Evolution sendLocation error:", errText);
      return { success: false, error: "Erro ao enviar localização." };
    }

    await response.text();
    
    // Save location message to conversation
    await saveAIMessage(supabase, userId, phone, `📍 Localização enviada: ${aiConfig.business_location_name || aiConfig.business_address}`, "ai");
    
    console.log("Location sent to:", phone);
    return { success: true, message: "Localização enviada com sucesso para o cliente." };
  } catch (error) {
    console.error("Send location error:", error);
    return { success: false, error: "Erro ao enviar localização." };
  }
}

async function executeFunction(supabase: any, supabaseUrl: string, name: string, args: any): Promise<any> {
  const operation = name === "check_available_slots" ? "check_availability" : name;
  console.log(`[executeFunction] Calling manage-appointment: operation=${operation}, args=`, JSON.stringify(args));
  
  // Use client_name from function args (provided by AI) if available, fallback to contactName from webhook
  const resolvedContactName = args.client_name || args.contactName || null;
  
  try {
    const payload = {
      operation,
      userId: args.userId,
      phone: args.phone,
      contactName: resolvedContactName,
      appointmentId: args.appointmentId,
      date: args.date,
      time: args.time,
      title: args.title,
      description: args.description,
    };
    
    console.log(`[executeFunction] Payload:`, JSON.stringify(payload));
    
    const response = await fetch(`${supabaseUrl}/functions/v1/manage-appointment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log(`[executeFunction] Result (status=${response.status}):`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("[executeFunction] Error:", error);
    return { error: "Erro ao executar função", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

function splitMessage(text: string): string[] {
  // Mensagens curtas não precisam ser divididas
  if (text.length < 150) return [text];

  // 1. Tenta dividir por parágrafos (dupla quebra de linha)
  let parts = text.split(/\n\n+/).filter(p => p.trim());
  
  if (parts.length > 1) {
    // Agrupa partes muito pequenas com a próxima para não enviar mensagens de 1 linha
    const merged: string[] = [];
    let buffer = "";
    
    for (const part of parts) {
      if (buffer && (buffer.length + part.length) < 250) {
        buffer += "\n\n" + part;
      } else {
        if (buffer) merged.push(buffer);
        buffer = part;
      }
    }
    if (buffer) merged.push(buffer);
    
    // Limita a no máximo 2 mensagens (regra de brevidade)
    return merged.slice(0, 2);
  }

  // 2. Se não tem parágrafos, tenta dividir por sentenças em mensagens longas
  if (text.length > 300) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    
    if (sentences.length > 1) {
      const chunks: string[] = [];
      let current = "";
      
      for (const sentence of sentences) {
        if (current && (current.length + sentence.length) > 280) {
          chunks.push(current.trim());
          current = sentence;
        } else {
          current += (current ? " " : "") + sentence;
        }
      }
      if (current) chunks.push(current.trim());
      
      return chunks.slice(0, 2);
    }
  }

  return [text];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractDigitsFromRemoteJid(remoteJid: string | null | undefined): string {
  return (remoteJid || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@lid$/i, "")
    .replace(/\D/g, "");
}

async function executeTransferToDepartment(
  supabase: any,
  userId: string,
  accountId: string | null,
  phone: string,
  departmentSlug: string,
  reason: string,
) {
  try {
    const slug = (departmentSlug || "").trim().toLowerCase();
    if (!slug || !accountId) {
      return { success: false, error: "Departamento inválido" };
    }

    const { data: dest } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, display_name, status, ai_enabled, transfer_message, phone_number")
      .eq("account_id", accountId)
      .eq("department_slug", slug)
      .maybeSingle();

    if (!dest) {
      return { success: false, error: `Departamento "${slug}" não encontrado` };
    }
    if (dest.status !== "connected") {
      return { success: false, error: `Departamento "${dest.display_name || slug}" não está conectado` };
    }

    // Atualiza a conversa para apontar à nova instância e ajusta IA
    const aiActive = dest.ai_enabled !== false;
    await supabase
      .from("whatsapp_conversations")
      .update({
        instance_id: dest.id,
        ai_active: aiActive,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("phone", phone);

    // Reseta sessão IA para o novo departamento começar limpo
    await supabase
      .from("whatsapp_ai_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("phone", phone);

    // Mensagem padrão se a instância destino não tiver definida
    const message =
      (dest.transfer_message && String(dest.transfer_message).trim()) ||
      `Olá! A partir de agora seu atendimento continuará por aqui (${dest.display_name || slug}). Em breve responderemos.`;

    // Envia pelo Evolution usando a instância de destino
    try {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      if (evolutionUrl && evolutionKey) {
        const candidates = [phone];
        const variant = getBrazilianPhoneVariant(phone);
        if (variant && variant !== phone) candidates.push(variant);
        for (const number of candidates) {
          const r = await fetch(`${evolutionUrl}/message/sendText/${dest.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({ number, text: message }),
          });
          if (r.ok) break;
        }
      }
    } catch (e) {
      console.error("Transfer message send error:", e);
    }

    // Persiste a mensagem no histórico da conversa
    try {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id, messages, total_messages")
        .eq("user_id", userId)
        .eq("phone", phone)
        .maybeSingle();
      if (conv) {
        const newMsg = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: true,
          content: message,
          type: "text",
          sent_by: "ai",
        };
        const updated = [...((conv as any).messages || []), newMsg];
        await supabase
          .from("whatsapp_conversations")
          .update({
            messages: updated,
            total_messages: updated.length,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", (conv as any).id);
      }
    } catch (e) {
      console.error("Persist transfer message error:", e);
    }

    return {
      success: true,
      department: dest.display_name || slug,
      ai_enabled: aiActive,
      reason: reason || null,
    };
  } catch (error) {
    console.error("executeTransferToDepartment error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro" };
  }
}

async function resolvePreferredChatNumber(instanceName: string, normalizedPhone: string, evolutionUrl: string, evolutionKey: string) {
  try {
    const variant = getBrazilianPhoneVariant(normalizedPhone);
    const candidateSet = new Set([normalizedPhone, variant].filter(Boolean) as string[]);

    const chatsResponse = await fetch(`${evolutionUrl}/chat/findChats/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({}),
    });

    if (!chatsResponse.ok) {
      console.warn("Could not fetch chats to resolve preferred number:", await chatsResponse.text());
      return null;
    }

    const chats = await chatsResponse.json();
    if (!Array.isArray(chats)) return null;

    for (const chat of chats) {
      const remoteJid = chat?.id || chat?.remoteJid || chat?.jid;
      const digits = extractDigitsFromRemoteJid(remoteJid);
      if (!digits) continue;

      if (candidateSet.has(digits) || normalizeBrazilianPhone(digits) === normalizedPhone) {
        return digits;
      }
    }
  } catch (error) {
    console.warn("Failed resolving preferred chat number:", error);
  }

  return null;
}

async function sendWhatsAppMessage(
  supabase: any,
  userId: string,
  phone: string,
  message: string,
): Promise<string | null> {
  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return null;
    }

    // Tenta usar a instância vinculada à conversa (departamento)
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("instance_id")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    let instance: { instance_name: string } | null = null;
    if ((conv as any)?.instance_id) {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("id", (conv as any).instance_id)
        .maybeSingle();
      instance = data as any;
    }
    if (!instance) {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, is_primary")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      instance = data as any;
    }

    if (!instance) {
      console.error("Instance not found");
      return null;
    }

    const resolvedChatNumber = await resolvePreferredChatNumber(instance.instance_name, phone, evolutionUrl, evolutionKey);

    // Prioriza o número real do chat na Evolution e depois cai para os formatos
    // normalizados/variantes para números brasileiros legados.
    const tryNumbers = [resolvedChatNumber, phone];
    const variant = getBrazilianPhoneVariant(phone);
    if (variant && variant !== phone) tryNumbers.push(variant);

    const uniqueTryNumbers = [...new Set(tryNumbers.filter(Boolean) as string[])];

    let lastErrorBody = "";
    for (const candidate of uniqueTryNumbers) {
      const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: candidate,
          text: message,
        }),
      });

      const responseText = await response.text();
      if (response.ok) {
        console.log(`Message sent via ${candidate} (instance: ${instance.instance_name})`);
        // Evolution returns the WhatsApp message id in key.id — capture it so we
        // can persist the message under that id and let the webhook dedupe by id.
        try {
          const parsed = JSON.parse(responseText);
          const wid =
            parsed?.key?.id ||
            parsed?.messageId ||
            parsed?.message?.key?.id ||
            null;
          return typeof wid === "string" ? wid : null;
        } catch {
          return null;
        }
      }

      lastErrorBody = responseText;
      const isInvalidNumber =
        response.status === 400 ||
        response.status === 404 ||
        /not.?exists|invalid.?number|number.?does.?not|not.?in.?whatsapp|jid/i.test(responseText);

      if (!isInvalidNumber) {
        console.error(`Evolution send error (${candidate}):`, responseText);
        return null;
      }
      console.warn(`Number ${candidate} rejected by Evolution, trying variant...`);
    }
    console.error("Evolution send failed for all variants:", lastErrorBody);
    return null;
  } catch (error) {
    console.error("Send message error:", error);
    return null;
  }
}

async function saveAIMessage(
  supabase: any,
  userId: string,
  phone: string,
  content: string,
  sentBy: string,
  messageId?: string | null,
) {
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id, messages")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  const newMessage = {
    id: messageId || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    from_me: true,
    content,
    type: "text",
    sent_by: sentBy,
  };

  if (conversation) {
    const existingMessages = conversation.messages || [];
    // Dedup: se a mensagem já existe (saved by webhook race), não duplica.
    if (messageId && existingMessages.some((m: any) => m?.id === messageId)) {
      return;
    }
    const updatedMessages = [...existingMessages, newMessage];

    await supabase
      .from("whatsapp_conversations")
      .update({
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
        total_messages: updatedMessages.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }
}

async function notifyHandoff(supabase: any, userId: string, clientPhone: string, clientName: string | null) {
  try {
    let displayName = clientName || null;
    if (!displayName) {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("contact_name")
        .eq("user_id", userId)
        .eq("phone", clientPhone)
        .maybeSingle();
      displayName = conv?.contact_name || "Desconhecido";
    }

    // Buscar últimas mensagens para gerar resumo da conversa
    let conversationSummary = "";
    try {
      const { data: convData } = await supabase
        .from("whatsapp_conversations")
        .select("messages")
        .eq("user_id", userId)
        .eq("phone", clientPhone)
        .maybeSingle();
      const msgs: any[] = Array.isArray(convData?.messages) ? convData!.messages : [];
      const lastMsgs = msgs.slice(-12);
      if (lastMsgs.length > 0) {
        const transcript = lastMsgs
          .map((m: any) => {
            const who = m.sender === "ai" || m.role === "assistant" || m.from_me ? "Atendente" : "Cliente";
            const text = String(m.content || m.text || m.message || "").trim();
            return text ? `${who}: ${text}` : "";
          })
          .filter(Boolean)
          .join("\n");
        const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (apiKey && transcript) {
          try {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{
                    role: "user",
                    parts: [{
                      text: `Resuma em 1 a 2 frases curtas (máx 240 caracteres) o que o CLIENTE precisa nesta conversa de WhatsApp. Seja direto, sem saudações, sem listas. Idioma: pt-BR.\n\nConversa:\n${transcript}`,
                    }],
                  }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 120 },
                }),
              },
            );
            if (r.ok) {
              const j = await r.json();
              const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("").trim();
              if (txt) conversationSummary = txt.replace(/\s+/g, " ").trim();
            }
          } catch (e) {
            console.error("Handoff summary gemini err:", e);
          }
        }
        // Fallback: usa última mensagem do cliente
        if (!conversationSummary) {
          const lastClient = [...lastMsgs].reverse().find((m: any) =>
            !(m.sender === "ai" || m.role === "assistant" || m.from_me)
          );
          const t = String(lastClient?.content || lastClient?.text || lastClient?.message || "").trim();
          if (t) conversationSummary = t.length > 240 ? t.slice(0, 237) + "..." : t;
        }
      }
    } catch (e) {
      console.error("Handoff summary build err:", e);
    }

    // Try by account_id first (works for accounts with team), fall back to user_id
    const accId = await resolveAccountId(supabase, userId);
    let notifContacts: any[] | null = null;
    if (accId) {
      const { data } = await supabase
        .from("notification_contacts")
        .select("phone, name")
        .eq("account_id", accId)
        .eq("notify_handoffs", true);
      notifContacts = data || null;
    }
    if (!notifContacts || notifContacts.length === 0) {
      const { data } = await supabase
        .from("notification_contacts")
        .select("phone, name")
        .eq("user_id", userId)
        .eq("notify_handoffs", true);
      notifContacts = data || null;
    }

    // Normaliza qualquer número BR para o formato com DDI 55 (chave única do Map),
    // evitando duplicar envios quando o mesmo número está cadastrado com e sem 55.
    const normalizeBR = (raw: string): string => {
      const d = String(raw || "").replace(/\D/g, "");
      if (!d) return "";
      if ((d.length === 10 || d.length === 11) ) return "55" + d;
      return d;
    };

    // Sempre incluir o telefone do dono da conta (cadastrado no profile)
    // como destinatário da notificação de handoff.
    const recipients = new Map<string, string>(); // phone -> name
    for (const c of notifContacts || []) {
      const key = normalizeBR(c.phone);
      if (key && !recipients.has(key)) recipients.set(key, c.name || "");
    }

    // Resolver o owner da account para pegar o telefone cadastrado
    let ownerUserId = userId;
    if (accId) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("owner_user_id")
        .eq("id", accId)
        .maybeSingle();
      if (acc?.owner_user_id) ownerUserId = acc.owner_user_id;
    }
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    const ownerKey = normalizeBR(ownerProfile?.phone || "");
    if (ownerKey && !recipients.has(ownerKey)) {
      recipients.set(ownerKey, ownerProfile?.full_name || "Dono da conta");
    }

    if (recipients.size === 0) return;

    const horario = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const summaryBlock = conversationSummary
      ? `\n📝 *Resumo:* ${conversationSummary}`
      : "";
    const message = `🔔 *Transferência de Atendimento*\n\nUm cliente precisa de atendimento humano.\n\n👤 *Nome:* ${displayName}\n📱 *Telefone:* ${clientPhone}\n⏰ *Horário:* ${horario}${summaryBlock}`;

    // Enviar SEMPRE pela instância de suporte (system) diretamente via Evolution API
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured for handoff notification");
      return;
    }

    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (!sysInstance || sysInstance.status !== "connected") {
      console.error("System WhatsApp instance not connected — cannot send handoff notification");
      return;
    }

    const instanceName = sysInstance.instance_name;
    let sent = 0;
    for (const [phoneNum] of recipients) {
      const target = phoneNum; // já normalizado com 55
      try {
        const resp = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: target, text: message }),
        });
        if (resp.ok) sent++;
        else console.error(`Handoff notify failed for ${target}: ${resp.status} ${await resp.text()}`);
      } catch (err) {
        console.error(`Handoff notify error for ${target}:`, err);
      }
    }

    console.log(`Handoff notification sent to ${sent}/${recipients.size} recipients via system instance`);
  } catch (error) {
    console.error("Error sending handoff notifications:", error);
  }
}

async function moveCRMDealToHumanStage(supabase: any, userId: string, phone: string) {
  // Get user's first pipeline
  const { data: pipelines } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!pipelines || pipelines.length === 0) return;

  const { data: stages } = await supabase
    .from("crm_stages")
    .select("id, name")
    .eq("pipeline_id", pipelines[0].id)
    .order("position", { ascending: true });

  if (!stages || stages.length < 2) return;

  const aiStage = stages.find((s: any) => s.name === "Atendimento IA") || stages[0];
  const humanStage = stages.find((s: any) => s.name === "Atendimento humano") || stages[1];

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
    console.log("CRM deal moved to Atendimento humano on handoff:", phone);
  }
}

async function applyRouletteOnHandoff(
  supabase: any,
  accountId: string | null,
  userId: string,
  phone: string,
  contactName: string | null,
) {
  if (!accountId) {
    console.log("Roulette skipped: no account_id");
    return;
  }

  // Verifica se a conta tem múltiplos membros ativos (roleta só faz sentido em multi-user)
  const { data: members } = await supabase
    .from("account_members")
    .select("user_id")
    .eq("account_id", accountId)
    .eq("status", "active");

  if (!members || members.length < 2) {
    console.log("Roulette skipped: single-user account");
    return;
  }

  // Verifica se a roleta está ativa
  const { data: cfg } = await supabase
    .from("roulette_config")
    .select("enabled, accept_timeout_minutes, require_online")
    .eq("account_id", accountId)
    .maybeSingle();

  if (!cfg?.enabled) {
    console.log("Roulette skipped: disabled");
    return;
  }

  // Sorteia próximo atendente
  const { data: nextUserId, error } = await supabase.rpc("roulette_pick_next", {
    _account_id: accountId,
    _exclude_user_ids: [],
    _only_online: cfg?.require_online ?? null,
  });

  if (error || !nextUserId) {
    console.error("Roulette: failed to pick next user (sem online?)", error);
    // Notifica owner se ninguém disponível
    try {
      const { data: acc } = await supabase
        .from("accounts")
        .select("owner_user_id")
        .eq("id", accountId)
        .maybeSingle();
      if (acc?.owner_user_id) {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", acc.owner_user_id)
          .maybeSingle();
        const digits = String(prof?.phone || "").replace(/\D/g, "");
        const number = digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
        const { data: sysInst } = await supabase
          .from("system_whatsapp_instance")
          .select("instance_name, status")
          .limit(1)
          .maybeSingle();
        if (number && evolutionUrl && evolutionKey && sysInst?.status === "connected") {
          await fetch(`${evolutionUrl}/message/sendText/${sysInst.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({
              number,
              text: `⚠️ *Roleta sem atendente*\n\nNenhum membro está disponível${cfg?.require_online ? " (online)" : ""} para atender ${contactName || phone}.`,
            }),
          });
        }
      }
    } catch (e) {
      console.error("Roulette: owner notify error", e);
    }
    return;
  }

  // Atribui a conversa, contato e deal CRM ao usuário sorteado
  await supabase
    .from("whatsapp_conversations")
    .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("phone", phone);

  await supabase
    .from("contacts")
    .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("phone", phone);

  // Atualiza deal CRM ativo (se houver) com o assigned_to
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (contact?.id) {
    await supabase
      .from("crm_deals")
      .update({ assigned_to: nextUserId, updated_at: new Date().toISOString() })
      .eq("contact_id", contact.id)
      .is("won_at", null)
      .is("lost_at", null);
  }

  console.log(`Roulette: contact ${phone} assigned to user ${nextUserId}`);

  // Cria assignment para controle de timeout
  const timeoutMin = cfg?.accept_timeout_minutes ?? 5;
  try {
    // Cancela qualquer pendente anterior para o mesmo phone na conta
    await supabase
      .from("roulette_assignments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("account_id", accountId)
      .eq("phone", phone)
      .eq("status", "pending");

    await supabase.from("roulette_assignments").insert({
      account_id: accountId,
      owner_user_id: userId,
      user_id: nextUserId,
      phone,
      contact_name: contactName,
      status: "pending",
      attempts: 1,
      skipped_user_ids: [],
      expires_at: new Date(Date.now() + timeoutMin * 60_000).toISOString(),
    });
  } catch (e) {
    console.error("Roulette: failed to create assignment", e);
  }

  // Notifica o atendente sorteado via WhatsApp do sistema
  try {
    const { data: assigneeProfile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", nextUserId)
      .maybeSingle();

    const assigneeDigits = String(assigneeProfile?.phone || "").replace(/\D/g, "");
    if (!assigneeDigits) return;

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) return;

    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (!sysInstance || sysInstance.status !== "connected") return;

    let target = assigneeDigits;
    if (target.length === 10 || target.length === 11) target = "55" + target;

    const msg = `🎯 *Roleta de Atendimento*\n\nVocê foi designado para atender:\n\n👤 *Cliente:* ${contactName || "Desconhecido"}\n📱 *Telefone:* ${phone}\n⏰ *Horário:* ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n⏱️ *Inicie em até ${timeoutMin} min*, ou a vez será passada ao próximo da fila.`;

    await fetch(`${evolutionUrl}/message/sendText/${sysInstance.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: target, text: msg }),
    });
  } catch (err) {
    console.error("Roulette assignee notify error:", err);
  }
}
