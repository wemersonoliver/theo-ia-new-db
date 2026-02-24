import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    }
  ]
};

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

    // Get AI config
    const { data: aiConfig } = await supabase
      .from("whatsapp_ai_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Get knowledge base
    const { data: documents } = await supabase
      .from("knowledge_base_documents")
      .select("content_text")
      .eq("user_id", userId)
      .eq("status", "ready");

    const knowledgeBase = documents?.map((d) => d.content_text).filter(Boolean).join("\n\n---\n\n") || "";

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayFormatted = today.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });

    // Build the SAME system prompt as whatsapp-ai-agent
    const systemPrompt = `Você é ${aiConfig?.agent_name || "um assistente virtual"} de atendimento via WhatsApp.

${aiConfig?.custom_prompt || "Seja cordial, profissional e prestativo."}

${knowledgeBase ? `Use a seguinte base de conhecimento para responder:\n\n${knowledgeBase.slice(0, 6000)}` : ""}

IMPORTANTE - AGENDAMENTOS:
Você tem acesso a ferramentas para gerenciar agendamentos. Quando o cliente:
- Perguntar sobre disponibilidade ou horários: Use check_available_slots
- Quiser marcar/agendar algo: Primeiro verifique disponibilidade, depois use create_appointment
- Quiser cancelar um agendamento: Use cancel_appointment
- Quiser ver seus agendamentos: Use list_appointments
- Confirmar presença: Use confirm_appointment

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

Regras adicionais:
- Responda de forma natural e conversacional
- Seja objetivo e direto
- Use emojis com moderação
- Se não souber a resposta, diga que vai verificar com a equipe
- Nunca invente informações
- Responda sempre em português brasileiro
- Ao agendar, sempre confirme data, horário e serviço antes de finalizar
- FORMATAÇÃO HUMANIZADA: Separe sua resposta em parágrafos curtos (2-3 frases cada). Use quebras de linha duplas entre os parágrafos.

CONTEXTO: Esta é uma SIMULAÇÃO DE TESTE. Responda como se fosse um atendimento real via WhatsApp. O usuário está testando a qualidade das respostas.`;

    // Build conversation for Gemini
    const geminiContents: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Vou seguir essas instruções e usar as ferramentas de agendamento quando necessário." }] },
    ];

    // Add history
    for (const msg of (messages || [])) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Add new user message
    if (userMessage) {
      geminiContents.push({ role: "user", parts: [{ text: userMessage }] });
    }

    const geminiPayload: any = {
      contents: geminiContents,
      tools: [schedulingTools],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };

    let aiReply = "";
    let functionCallsProcessed = 0;
    const maxFunctionCalls = 3;

    while (functionCallsProcessed < maxFunctionCalls) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini error:", errText);
        throw new Error(`Gemini API error: ${geminiRes.status}`);
      }

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

        // Execute the function using manage-appointment (real execution for testing)
        const functionResult = await executeFunction(supabaseUrl, fc.name, {
          ...fc.args,
          userId,
          phone: "test-simulation",
          contactName: "Simulação de Teste",
        });

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
