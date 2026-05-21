import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentSystemPrompt } from "../_ai_system_prompt.ts";
import { retrieveRelevantContext } from "../_shared/rag.ts";
import { resolveAccountId } from "../_account.ts";
import { getBrtNowParts, buildIgreenProductsPromptBlock } from "../_igreen_flow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Tool definitions for function calling (same as whatsapp-ai-agent)
const schedulingTools = {
  function_declarations: [
    {
      name: "check_available_slots",
      description: "Verifica horários disponíveis para agendamento em uma data específica.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Data no formato YYYY-MM-DD" }
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
          date: { type: "string", description: "Data no formato YYYY-MM-DD" },
          time: { type: "string", description: "Horário no formato HH:MM" },
          title: { type: "string", description: "Tipo de serviço ou título" },
          description: { type: "string", description: "Detalhes adicionais" }
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
          date: { type: "string", description: "Data no formato YYYY-MM-DD" },
          time: { type: "string", description: "Horário no formato HH:MM" }
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
          date: { type: "string", description: "Data opcional no formato YYYY-MM-DD" }
        },
        required: []
      }
    },
    {
      name: "confirm_appointment",
      description: "Confirma a presença do cliente em um agendamento.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "update_appointment_tags",
      description: "Adiciona ou remove tags de um agendamento.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string", description: "ID do agendamento" },
          tags: { type: "array", items: { type: "string" }, description: "Tags" },
          action: { type: "string", description: "'add' ou 'remove'" }
        },
        required: ["tags"]
      }
    },
    {
      name: "send_product_video",
      description: "Envia o vídeo institucional de um produto Igreen e, opcionalmente, uma intro_message ANTES do vídeo. Agenda follow-up de 2min ('Conseguiu ver, {nome}?'). No simulador o envio do vídeo é mockado, mas a IA deve usar a tool exatamente como em produção. Após chamar a tool, NÃO escreva texto extra fora dela.",
      parameters: {
        type: "object",
        properties: {
          product_key: { type: "string", description: "Chave do produto: 'green', 'telecom' ou 'expansao'." },
          intro_message: { type: "string", description: "Mensagem de texto enviada ANTES do vídeo (use o primeiro nome real do cliente). Opcional." }
        },
        required: ["product_key"]
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
  throw new Error("Gemini API rate limit exceeded after retries. Aguarde alguns segundos e tente novamente.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const { messages, userMessage } = await req.json();

    // Cliente com service role para ler dados consistentes (igual whatsapp-ai-agent)
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // AI config
    const { data: aiConfig } = await serviceClient
      .from("whatsapp_ai_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = await resolveAccountId(serviceClient, userId);

    // Knowledge base rotulada por produto + RAG (idêntico ao whatsapp-ai-agent)
    const { data: documents } = await serviceClient
      .from("knowledge_base_documents")
      .select("content_text, igreen_product_id, file_name")
      .eq("user_id", userId)
      .eq("status", "ready");

    const productMap = new Map<string, string>();
    try {
      if (accountId) {
        const { data: accProducts } = await serviceClient
          .from("igreen_account_products")
          .select("id, name")
          .eq("account_id", accountId);
        (accProducts || []).forEach((p: any) => productMap.set(p.id, p.name));
      }
    } catch (_) { /* opcional */ }

    const docTexts = (documents || [])
      .filter((d: any) => typeof d.content_text === "string" && d.content_text.length > 0)
      .map((d: any) => {
        const productName = d.igreen_product_id ? productMap.get(d.igreen_product_id) : null;
        const header = productName ? `[PRODUTO: ${productName}]` : `[GERAL]`;
        return `${header}\n${d.content_text}`;
      });

    const lastUserMessage = userMessage
      || ([...(messages || [])].reverse().find((m: any) => m.role === "user")?.content ?? "");

    const knowledgeBase = docTexts.length > 0
      ? retrieveRelevantContext(lastUserMessage || "", docTexts, {
          topK: 3,
          maxChars: 2400,
          chunkSize: 800,
        })
      : "";

    // Catálogo de produtos (idêntico ao whatsapp-ai-agent)
    let productsCatalog = "";
    try {
      const { data: userProducts } = await serviceClient
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

    const brt = getBrtNowParts();
    const today = brt.date;
    const todayStr = today.toISOString().split("T")[0];
    const todayFormatted = today.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
    });

    // Igreen products block (mesma lógica do agente real)
    let igreenProductsBlock = "";
    try {
      if (accountId) {
        const { data: igreenProds } = await serviceClient
          .from("igreen_account_products")
          .select("id, key, name, description, enabled, video_url")
          .eq("account_id", accountId)
          .order("position", { ascending: true });
        if (igreenProds && igreenProds.length > 0) {
          igreenProductsBlock = buildIgreenProductsPromptBlock({
            agentName: aiConfig?.agent_name || "seu assistente",
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
      console.error("Error loading igreen products (simulator):", e);
    }

    // EXATAMENTE o mesmo prompt do whatsapp-ai-agent (módulo compartilhado).
    // Contextos dinâmicos de conversa real (cliente retornando, departamentos,
    // agendamentos existentes, confirmações pendentes) ficam vazios no simulador.
    const systemPrompt = buildAgentSystemPrompt({
      aiConfig: aiConfig || {},
      knowledgeBase,
      productsCatalog,
      returningClientContext: "",
      departmentsBlock: "",
      existingAppointmentsContext: "",
      pendingConfirmationContext: "",
      todayStr,
      todayFormatted,
      brtTime: brt.brtTime,
      brtGreeting: brt.greeting,
      igreenProductsBlock,
    });

    // Build conversation for Gemini.
    // IMPORTANTE: usamos systemInstruction (campo nativo) em vez de empilhar o prompt
    // como turno user/model — assim o Gemini mantém a persona em TODOS os turnos
    // e não "esquece" o prompt depois de algumas mensagens (causa de respostas
    // alucinadas com persona aleatória, ex.: "clínica de estética").
    const geminiContents: any[] = [];

    for (const msg of (messages || [])) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    if (userMessage) {
      geminiContents.push({ role: "user", parts: [{ text: userMessage }] });
    }

    const geminiPayload: any = {
      contents: geminiContents,
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      tools: [schedulingTools],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };

    let aiReply = "";
    let functionCallsProcessed = 0;
    const maxFunctionCalls = 3;

    while (functionCallsProcessed < maxFunctionCalls) {
      const geminiRes = await fetchGeminiWithRetry(geminiApiKey, geminiPayload);

      const geminiData = await geminiRes.json();
      const candidate = geminiData.candidates?.[0];
      const content = candidate?.content;

      if (!content?.parts) {
        console.error("Empty AI response");
        break;
      }

      // Check for function calls
      const functionCall = content.parts.find((p: any) => p.functionCall);

      if (functionCall) {
        const fc = functionCall.functionCall;
        console.log("Test - Function call:", fc.name, fc.args);

        // No simulador, send_product_video é apenas mockada (não envia vídeo real)
        let functionResult: any;
        if (fc.name === "send_product_video") {
          const intro = typeof fc.args?.intro_message === "string" ? fc.args.intro_message.trim() : "";
          // No simulador, exibimos a intro_message como mensagem real do assistente
          // (para o usuário ver o texto que iria antes do vídeo em produção).
          if (intro) {
            aiReply = aiReply ? `${aiReply}\n\n${intro}` : intro;
          }
          aiReply = (aiReply ? `${aiReply}\n\n` : "") + `🎥 [Simulação] Vídeo do produto '${fc.args?.product_key || "green"}' enviado. Follow-up automático em 2min ("Conseguiu ver?").`;
          functionResult = {
            success: true,
            simulated: true,
            message: `[SIMULAÇÃO] intro_message${intro ? " enviada" : " ausente"} e vídeo do produto '${fc.args?.product_key || "green"}' enviado. Follow-up agendado para 2 minutos depois. Encerre o turno — não escreva nada agora.`,
          };
          // Encerramos o turno aqui: em produção a IA não escreve mais nada após a tool.
          functionCallsProcessed = maxFunctionCalls;
          break;
        } else {
          functionResult = await executeFunction(supabaseUrl, fc.name, {
            ...fc.args,
            userId,
            phone: "test-simulation",
            contactName: "Simulação de Teste",
          });
        }

        console.log("Test - Function result:", functionResult);

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
          console.log("Test - Detected code in response, attempting to extract function call");

          const extracted = extractFunctionCallFromText(responseText);

          if (extracted) {
            console.log("Test - Extracted function:", extracted.name, extracted.args);

            const functionResult = await executeFunction(supabaseUrl, extracted.name, {
              ...extracted.args,
              userId,
              phone: "test-simulation",
              contactName: "Simulação de Teste",
            });

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
            continue;
          } else {
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

        aiReply = responseText;
      }
      break;
    }

    if (!aiReply) {
      aiReply = "Desculpe, não consegui processar sua solicitação. Pode tentar novamente?";
    }

    return new Response(JSON.stringify({ message: aiReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("test-ai-prompt error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeFunction(supabaseUrl: string, name: string, args: any): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/manage-appointment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        operation: name === "check_available_slots" ? "check_availability" : name,
        userId: args.userId,
        phone: args.phone,
        contactName: args.contactName,
        date: args.date,
        time: args.time,
        title: args.title,
        description: args.description,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Test function execution error:", error);
    return { error: "Erro ao executar função", message: error instanceof Error ? error.message : "Unknown error" };
  }
}
