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
- IMPORTANTE: Use APENAS a function calling nativa (functionCall) para chamar update_agent_prompt. NUNCA use sintaxe Python como print() ou default_api
- Formate respostas com clareza usando parágrafos curtos`;

    const geminiContents: any[] = [];

    // Add message history
    for (const msg of messages || []) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // If no history, add initial greeting
    if (geminiContents.length === 0) {
      geminiContents.push(
        { role: "user", parts: [{ text: "Olá, quero ajustar meu prompt." }] },
        {
          role: "model",
          parts: [
            {
              text: "Olá! Sou seu consultor de prompts. Estou com acesso ao prompt atual do seu agente e posso analisar a conversa de teste ao lado, sugerir melhorias e atualizar o prompt diretamente quando você aprovar. Como posso ajudar?",
            },
          ],
        },
      );
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
    const maxFunctionCalls = 5;

    while (functionCallsProcessed < maxFunctionCalls) {
      const geminiRes = await fetchGeminiWithRetry(geminiApiKey, geminiPayload);

      const geminiData = await geminiRes.json();
      console.log("Gemini response candidates:", JSON.stringify(geminiData.candidates?.map((c: any) => ({
        finishReason: c.finishReason,
        partsTypes: c.content?.parts?.map((p: any) => Object.keys(p))
      }))));
      
      const candidate = geminiData.candidates?.[0];
      const content = candidate?.content;
      const finishReason = candidate?.finishReason;

      // Handle MALFORMED_FUNCTION_CALL - Gemini tried to call the function with wrong syntax
      if (finishReason === "MALFORMED_FUNCTION_CALL") {
        const finishMessage = candidate?.finishMessage || "";
        console.warn("Malformed function call detected, extracting prompt from message...");
        
        // Try to extract the new_prompt value from the malformed call text
        const promptMatch = finishMessage.match(/new_prompt\s*=\s*(?:'''|"""|'|")([\s\S]*?)(?:'''|"""|'|")?\s*\)?\s*\)?$/);
        if (promptMatch?.[1] && promptMatch[1].length > 50) {
          const extractedPrompt = promptMatch[1].replace(/\\n/g, "\n").trim();
          console.log("Extracted prompt from malformed call, length:", extractedPrompt.length);
          
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const adminClient = createClient(supabaseUrl, serviceRoleKey);
          
          const { error: updateError } = await adminClient
            .from("whatsapp_ai_config")
            .upsert(
              { user_id: userId, custom_prompt: extractedPrompt },
              { onConflict: "user_id" }
            );

          if (!updateError) {
            promptUpdated = true;
            newPromptValue = extractedPrompt;
            aiReply = "✅ Prompt atualizado com sucesso! As mudanças já estão ativas no seu agente de IA.";
            console.log("Prompt updated from malformed call for user:", userId);
          } else {
            console.error("Error updating prompt from malformed call:", updateError);
            aiReply = "Identifiquei as mudanças, mas houve um erro ao salvar. Pode tentar novamente?";
          }
          break;
        }
        
        // Could not extract - ask Gemini to retry with proper function calling
        geminiPayload.contents.push({
          role: "user",
          parts: [{ text: "Use a ferramenta update_agent_prompt corretamente para atualizar o prompt. Não use sintaxe Python, use a function calling nativa." }],
        });
        functionCallsProcessed++;
        continue;
      }

      if (!content?.parts) {
        console.error("No content parts in response", JSON.stringify(geminiData).slice(0, 500));
        break;
      }

      const functionCall = content.parts.find((p: any) => p.functionCall);

      if (functionCall) {
        const fc = functionCall.functionCall;
        console.log("Prompt generator - Function call:", fc.name, JSON.stringify(fc.args).slice(0, 200));

        if (fc.name === "update_agent_prompt" && fc.args?.new_prompt) {
          // Use service role client to ensure the update succeeds
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const adminClient = createClient(supabaseUrl, serviceRoleKey);
          
          // Use upsert to handle case where no row exists yet
          const { error: updateError } = await adminClient
            .from("whatsapp_ai_config")
            .upsert(
              { user_id: userId, custom_prompt: fc.args.new_prompt },
              { onConflict: "user_id" }
            );

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
            console.log("Prompt updated successfully for user:", userId);
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

      // Text response - collect text from all parts (skip thinking parts)
      const textParts = content.parts.filter((p: any) => p.text !== undefined);
      if (textParts.length > 0) {
        aiReply = textParts.map((p: any) => p.text).join("");
        console.log("AI reply length:", aiReply.length);
      } else {
        // Model returned only thinking/other parts, no text - continue to get actual response
        console.log("No text parts found, parts types:", content.parts.map((p: any) => Object.keys(p)));
        // Don't break - add the content and ask for a text response
        geminiPayload.contents.push(content);
        geminiPayload.contents.push({
          role: "user",
          parts: [{ text: "Continue com sua resposta em texto." }],
        });
        functionCallsProcessed++;
        continue;
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
