import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const updatePromptTool = {
  function_declarations: [
    {
      name: "update_agent_prompt",
      description:
        "Atualiza o prompt/instruções personalizadas do agente de IA diretamente no banco de dados. Use quando o usuário pedir para aplicar, salvar ou atualizar o prompt com base nas análises feitas.",
      parameters: {
        type: "object",
        properties: {
          new_prompt: {
            type: "string",
            description: "O novo prompt completo que será salvo como instruções do agente de IA.",
          },
        },
        required: ["new_prompt"],
      },
    },
  ],
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
    const { messages, userMessage, testConversation } = await req.json();

    // Get current AI config (prompt)
    const { data: aiConfig } = await supabase
      .from("whatsapp_ai_config")
      .select("custom_prompt, agent_name")
      .eq("user_id", userId)
      .maybeSingle();

    const currentPrompt = aiConfig?.custom_prompt || "(nenhum prompt configurado)";

    // Format the test conversation for context
    let testConversationText = "";
    if (testConversation && testConversation.length > 0) {
      testConversationText = testConversation
        .map((m: any) => `${m.role === "user" ? "CLIENTE" : "AGENTE IA"}: ${m.content}`)
        .join("\n\n");
    }

    const systemPrompt = `Você é um especialista em engenharia de prompts para agentes de atendimento via WhatsApp.

Seu papel é ajudar o usuário a analisar e melhorar o prompt do agente de IA dele, observando a conversa de teste que está acontecendo ao lado.

## PROMPT ATUAL DO AGENTE:
---
${currentPrompt}
---

${testConversationText ? `## CONVERSA DE TESTE EM ANDAMENTO (simulação de atendimento):
---
${testConversationText}
---` : "(Nenhuma conversa de teste iniciada ainda)"}

## SUAS CAPACIDADES:
- Analisar a conversa de teste e identificar problemas no atendimento da IA
- Sugerir melhorias no prompt
- Quando o usuário concordar com as sugestões, usar a ferramenta update_agent_prompt para atualizar o prompt diretamente
- Explicar por que certas mudanças melhoram o atendimento

## REGRAS:
- Responda sempre em português brasileiro
- Seja objetivo e prático nas sugestões
- Quando sugerir mudanças, mostre exatamente o que seria alterado
- Ao usar update_agent_prompt, envie o prompt COMPLETO (não apenas as partes alteradas)
- Sempre pergunte ao usuário se ele quer aplicar as mudanças antes de atualizar
- Se o usuário pedir para atualizar/aplicar/salvar, use a ferramenta update_agent_prompt imediatamente
- Formate respostas com clareza usando parágrafos curtos`;

    const geminiContents: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      {
        role: "model",
        parts: [
          {
            text: "Entendido! Sou seu consultor de prompts. Posso analisar a conversa de teste ao lado, sugerir melhorias e atualizar o prompt diretamente quando você aprovar. Como posso ajudar?",
          },
        ],
      },
    ];

    // Add message history
    for (const msg of messages || []) {
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
      tools: [updatePromptTool],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    };

    let aiReply = "";
    let promptUpdated = false;
    let newPromptValue = "";
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

      if (!content?.parts) break;

      const functionCall = content.parts.find((p: any) => p.functionCall);

      if (functionCall) {
        const fc = functionCall.functionCall;
        console.log("Prompt generator - Function call:", fc.name, JSON.stringify(fc.args).slice(0, 200));

        if (fc.name === "update_agent_prompt" && fc.args?.new_prompt) {
          // Update the prompt in the database
          const { error: updateError } = await supabase
            .from("whatsapp_ai_config")
            .update({ custom_prompt: fc.args.new_prompt })
            .eq("user_id", userId);

          let functionResult: any;
          if (updateError) {
            console.error("Error updating prompt:", updateError);
            functionResult = { success: false, error: updateError.message };
          } else {
            promptUpdated = true;
            newPromptValue = fc.args.new_prompt;
            functionResult = {
              success: true,
              message: "Prompt atualizado com sucesso no banco de dados!",
            };
          }

          geminiPayload.contents.push(content);
          geminiPayload.contents.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: fc.name,
                  response: functionResult,
                },
              },
            ],
          });

          functionCallsProcessed++;
          continue;
        }
      }

      // Text response
      const textPart = content.parts.find((p: any) => p.text);
      if (textPart) {
        aiReply = textPart.text;
      }
      break;
    }

    if (!aiReply) {
      aiReply = "Desculpe, não consegui processar. Pode tentar novamente?";
    }

    return new Response(
      JSON.stringify({
        message: aiReply,
        promptUpdated,
        newPrompt: promptUpdated ? newPromptValue : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("prompt-generator-ai error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
