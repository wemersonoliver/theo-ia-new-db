import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const pattern = /(check_available_slots|create_appointment|cancel_appointment|list_appointments|confirm_appointment|update_appointment_tags)\s*\(\s*([^)]*)\)/i;
  
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
    }
  ]
};

// Retry with exponential backoff for Gemini API rate limits
async function fetchGeminiWithRetry(apiKey: string, payload: any, maxRetries = 3): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
      throw new Error(`Gemini API error: ${response.status}`);
    }
    return response;
  }
  throw new Error("Gemini API rate limit exceeded after retries");
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

    if (session?.status === "handed_off") {
      console.log("Conversation handed off, skipping AI");
      return new Response(JSON.stringify({ skipped: true, reason: "Handed off" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check message limit
    const messagesCount = session?.messages_without_human || 0;
    if (messagesCount >= (aiConfig.max_messages_without_human || 10)) {
      if (aiConfig.handoff_message) {
        await sendWhatsAppMessage(supabase, userId, phone, aiConfig.handoff_message);
        await saveAIMessage(supabase, userId, phone, aiConfig.handoff_message, "ai");
      }
      
      await supabase
        .from("whatsapp_ai_sessions")
        .upsert({
          user_id: userId,
          phone,
          status: "handed_off",
          handed_off_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,phone" });

      // Notify registered contacts about handoff
      await notifyHandoff(supabase, userId, phone, contactName);

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
      .select("messages")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    const allMessages = conversation?.messages || [];
    const contextSummary = (allMessages as any[]).find((m: any) => m.type === "context_summary");
    const recentMessages = (allMessages as any[]).filter((m: any) => m.type !== "context_summary").slice(-10);

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

    // Get knowledge base documents
    const { data: documents } = await supabase
      .from("knowledge_base_documents")
      .select("content_text")
      .eq("user_id", userId)
      .eq("status", "ready");

    const knowledgeBase = documents?.map(d => d.content_text).filter(Boolean).join("\n\n---\n\n") || "";

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

    // Get today's date for context
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayFormatted = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

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

    // Build system prompt with scheduling capabilities
    const systemPrompt = `Você é ${aiConfig.agent_name || "um assistente virtual"} de atendimento via WhatsApp.

${aiConfig.custom_prompt || "Seja cordial, profissional e prestativo."}

${knowledgeBase ? `Use a seguinte base de conhecimento para responder:\n\n${knowledgeBase.slice(0, 6000)}` : ""}

${productsCatalog}

${pendingConfirmationContext}

${aiConfig.business_latitude && aiConfig.business_longitude ? `LOCALIZAÇÃO DO NEGÓCIO:
Você tem a ferramenta send_location para enviar a localização do negócio como um pin no mapa do WhatsApp.
- Endereço: ${aiConfig.business_address || "Não informado"}
- Nome do local: ${aiConfig.business_location_name || "Não informado"}
- Quando o cliente perguntar "onde fica?", "qual o endereço?", "como chego aí?", "me manda a localização", "localização", envie o texto com o endereço E chame send_location para enviar o pin no mapa.
- SEMPRE use send_location quando o cliente pedir localização ou endereço, além de responder com o endereço por texto.` : ""}

IMPORTANTE - AGENDAMENTOS:
Você tem acesso a ferramentas para gerenciar agendamentos. Quando o cliente:
- Perguntar sobre disponibilidade ou horários: Use check_available_slots
- Quiser marcar/agendar algo: Primeiro verifique disponibilidade, depois use create_appointment
- Quiser cancelar um agendamento: Use cancel_appointment
- Quiser ver seus agendamentos: Use list_appointments
- Confirmar presença (responder "sim", "confirmo", "confirmado", "vou sim", etc.): Use confirm_appointment
- O sistema envia lembretes automáticos. Quando o cliente responder confirmando, use confirm_appointment imediatamente.
- Quando o cliente responder que não pode ir, ofereça reagendamento: cancele o atual e inicie novo agendamento.

Hoje é ${todayFormatted} (${todayStr}).
Ao mencionar datas, converta para o formato YYYY-MM-DD para as funções.
Exemplos: "amanhã" = dia seguinte, "segunda" = próxima segunda-feira.

REGRAS CRÍTICAS - NUNCA VIOLE:
- NUNCA escreva código Python, JavaScript ou qualquer linguagem de programação
- NUNCA use print(), default_api, ou sintaxe de função no texto
- NUNCA envie comandos técnicos para o cliente
- Use APENAS as ferramentas (tools) disponibilizadas pelo sistema através de function calling
- Responda SEMPRE em linguagem natural e conversacional
- Quando precisar verificar disponibilidade ou criar agendamento, use as tools, NÃO escreva código
- OBRIGATÓRIO: Para criar um agendamento, você DEVE chamar a ferramenta create_appointment. NUNCA diga que o agendamento foi criado ou confirmado sem antes ter chamado create_appointment e recebido uma resposta de sucesso.
- OBRIGATÓRIO: NUNCA simule ou finja ter criado um agendamento. O agendamento SÓ existe quando a ferramenta create_appointment retorna success: true.
- Se o cliente confirmou todos os dados (data, horário, serviço, nome), chame create_appointment IMEDIATAMENTE. Não peça mais confirmações desnecessárias.
- OBRIGATÓRIO: Sempre que o cliente informar o nome durante a conversa, guarde-o e passe no campo client_name ao chamar create_appointment. Se o cliente não informou o nome, pergunte antes de criar o agendamento.

ANÁLISE DE IMAGENS E DOCUMENTOS:
- Quando o cliente enviar uma imagem ou documento, você receberá o conteúdo visual diretamente.
- Analise o conteúdo da imagem/documento e responda de forma contextualizada.
- Se for um documento (PDF, etc), extraia as informações relevantes e responda baseado nelas.
- Se for uma imagem com texto, leia e interprete o texto.
- Se for uma foto, descreva e responda de acordo com o contexto da conversa.

Regras adicionais:
- Responda de forma natural e conversacional
- Seja objetivo e direto
- Use emojis com moderação
- Se não souber a resposta, diga que vai verificar com a equipe
- Nunca invente informações
- Responda sempre em português brasileiro
- Ao agendar, sempre confirme data, horário e serviço antes de finalizar
- FORMATAÇÃO HUMANIZADA: Separe sua resposta em parágrafos curtos (2-3 frases cada). Use quebras de linha duplas entre os parágrafos. Evite respostas em um único bloco longo. Cada parágrafo deve abordar um ponto diferente. Isso é fundamental para parecer natural no WhatsApp.`;

    // Build conversation messages
    const conversationMessages = recentMessages.map((msg: any) => ({
      role: msg.from_me ? "model" : "user",
      parts: [{ text: msg.content }],
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
    const geminiPayload = {
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Entendido. Vou seguir essas instruções e usar as ferramentas de agendamento quando necessário." }] },
        ...conversationMessages,
      ],
      tools: [schedulingTools],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    let aiReply = "";
    let functionCallsProcessed = 0;
    let createAppointmentCalled = false;
    const maxFunctionCalls = 3;

    while (functionCallsProcessed < maxFunctionCalls) {
      const aiResponse = await fetchGeminiWithRetry(geminiApiKey, geminiPayload);

      const aiData = await aiResponse.json();
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
      console.error("No AI reply generated");
      return new Response(JSON.stringify({ error: "No AI response" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

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

    // Send each part with typing simulation delay
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // Delay proporcional ao tamanho da mensagem anterior (simula digitação ~40 chars/sec)
        const typingDelay = Math.min(Math.max(parts[i].length * 25, 1000), 4000);
        await delay(typingDelay + Math.random() * 800);
      }
      await sendWhatsAppMessage(supabase, userId, phone, parts[i]);
    }

    // Save full response to conversation
    await saveAIMessage(supabase, userId, phone, aiReply, "ai");

    // Update session
    await supabase
      .from("whatsapp_ai_sessions")
      .upsert({
        user_id: userId,
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
    
    // Limita a no máximo 5 mensagens
    return merged.slice(0, 5);
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
      
      return chunks.slice(0, 5);
    }
  }

  return [text];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWhatsAppMessage(supabase: any, userId: string, phone: string, message: string) {
  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return;
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      console.error("Instance not found");
      return;
    }

    const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Evolution send error:", responseText);
    }
  } catch (error) {
    console.error("Send message error:", error);
  }
}

async function saveAIMessage(supabase: any, userId: string, phone: string, content: string, sentBy: string) {
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id, messages")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  const newMessage = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    from_me: true,
    content,
    type: "text",
    sent_by: sentBy,
  };

  if (conversation) {
    const existingMessages = conversation.messages || [];
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

    const { data: notifContacts } = await supabase
      .from("notification_contacts")
      .select("phone, name")
      .eq("user_id", userId)
      .eq("notify_handoffs", true);

    if (!notifContacts || notifContacts.length === 0) return;

    const message = `🔔 *Transferência de Atendimento*\n\nUm cliente precisa de atendimento humano.\n\n👤 *Nome:* ${displayName}\n📱 *Telefone:* ${clientPhone}\n⏰ *Horário:* ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    // Try system WhatsApp instance first, fall back to user's instance
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) return;

    let instanceName: string | null = null;

    // Check system instance
    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (sysInstance && sysInstance.status === "connected") {
      instanceName = sysInstance.instance_name;
    } else {
      // Fallback to user's instance
      const { data: userInstance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .maybeSingle();
      instanceName = userInstance?.instance_name || null;
    }

    if (!instanceName) return;

    for (const contact of notifContacts) {
      await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: contact.phone, text: message }),
      });
    }

    console.log(`Handoff notification sent to ${notifContacts.length} contacts via ${sysInstance?.status === "connected" ? "system" : "user"} instance`);
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
