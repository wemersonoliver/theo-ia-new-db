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
      name: "update_support_prompt",
      description:
        "Atualiza as Instruções Adicionais do Administrador (custom_prompt) da IA de Suporte (system_ai_config). Use quando o admin pedir para aplicar/salvar/atualizar o prompt.",
      parameters: {
        type: "object",
        properties: {
          new_prompt: {
            type: "string",
            description: "O novo conteúdo COMPLETO das Instruções Adicionais do Administrador.",
          },
        },
        required: ["new_prompt"],
      },
    },
  ],
};

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
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * 2000 + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    return response;
  }
  throw new Error("Gemini API rate limit exceeded after retries.");
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (authError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, userMessage, testConversation } = await req.json();

    const { data: sysConfig } = await supabaseAdmin
      .from("system_ai_config")
      .select("custom_prompt, agent_name, id")
      .limit(1)
      .maybeSingle();

    const currentPrompt = sysConfig?.custom_prompt || "(nenhum prompt adicional configurado)";

    let testConversationText = "";
    if (testConversation && testConversation.length > 0) {
      testConversationText = testConversation
        .map((m: any) => `${m.role === "user" ? "CLIENTE" : "AGENTE"}: ${m.content}`)
        .join("\n\n");
    }

    const systemPrompt = `Você é um especialista em engenharia de prompts para a IA de Suporte da Theo IA.\n\nSeu papel é ajudar o ADMINISTRADOR a analisar e melhorar as Instruções Adicionais do Administrador (custom_prompt) da IA de Suporte, observando a simulação de atendimento ao lado.\n\nA IA de Suporte já possui um SYSTEM_PROMPT base completo (com as regras de formato, navegação do sistema, funcionalidades, etc). O custom_prompt é APENAS conteúdo extra que será concatenado ao prompt base.\n\n## INSTRUÇÕES ADICIONAIS ATUAIS:\n---\n${currentPrompt}\n---\n\n${testConversationText ? `## SIMULAÇÃO DE ATENDIMENTO ATUAL:\n---\n${testConversationText}\n---\n\nUse essa conversa como referência principal para identificar problemas e sugerir ajustes.` : "(Nenhuma simulação iniciada ainda — peça ao admin para testar ao lado)"}\n\n## SUAS CAPACIDADES\n- Analisar a simulação e identificar problemas\n- Sugerir melhorias pontuais nas instruções adicionais\n- Quando o admin aprovar, usar a ferramenta update_support_prompt para salvar imediatamente\n\n## REGRAS DE FORMATO — OBRIGATÓRIO\n- Respostas CURTAS e DIRETAS: máximo 3-4 linhas\n- Use bullets curtos quando listar\n- NÃO repita o prompt inteiro — só o trecho relevante\n- Mudanças simples? Aplique direto sem explicar muito\n\n## REGRAS GERAIS\n- Português brasileiro\n- Ao usar update_support_prompt, envie o conteúdo COMPLETO das instruções adicionais (não apenas o diff)\n- Use APENAS function calling nativo, NUNCA sintaxe Python`;

    const geminiContents: any[] = [];
    for (const msg of messages || []) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    if (geminiContents.length === 0) {
      geminiContents.push(
        { role: "user", parts: [{ text: "Olá, quero ajustar o prompt da IA de Suporte." }] },
        {
          role: "model",
          parts: [{
            text: "Olá! Sou seu consultor de prompts da IA de Suporte. Posso analisar a simulação ao lado, sugerir melhorias e atualizar as instruções adicionais quando você aprovar. Como posso ajudar?",
          }],
        },
      );
    }

    if (userMessage) {
      geminiContents.push({ role: "user", parts: [{ text: userMessage }] });
    }

    const geminiPayload: any = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      tools: [updatePromptTool],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };

    let aiReply = "";
    let promptUpdated = false;
    let newPromptValue = "";
    let functionCallsProcessed = 0;
    const maxFunctionCalls = 5;

    while (functionCallsProcessed < maxFunctionCalls) {
      const geminiRes = await fetchGeminiWithRetry(geminiApiKey, geminiPayload);
      const geminiData = await geminiRes.json();
      const candidate = geminiData.candidates?.[0];
      const content = candidate?.content;
      const finishReason = candidate?.finishReason;

      if (finishReason === "MALFORMED_FUNCTION_CALL") {
        const finishMessage = candidate?.finishMessage || "";
        const promptMatch = finishMessage.match(/new_prompt\s*=\s*(?:'''|"""|'|")([\s\S]*?)(?:'''|"""|'|")?\s*\)?\s*\)?$/);
        if (promptMatch?.[1] && promptMatch[1].length > 20) {
          const extractedPrompt = promptMatch[1].replace(/\\n/g, "\n").trim();
          const upsertPayload: any = sysConfig?.id
            ? { id: sysConfig.id, custom_prompt: extractedPrompt }
            : { custom_prompt: extractedPrompt };
          const { error: updateError } = await supabaseAdmin
            .from("system_ai_config")
            .upsert(upsertPayload);
          if (!updateError) {
            promptUpdated = true;
            newPromptValue = extractedPrompt;
            aiReply = "✅ Instruções da IA de Suporte atualizadas! Já estão ativas.";
          } else {
            aiReply = "Identifiquei as mudanças, mas houve um erro ao salvar. Pode tentar novamente?";
          }
          break;
        }
        geminiPayload.contents.push({
          role: "user",
          parts: [{ text: "Use a ferramenta update_support_prompt corretamente. Não use Python." }],
        });
        functionCallsProcessed++;
        continue;
      }

      if (!content?.parts) break;

      const functionCall = content.parts.find((p: any) => p.functionCall);
      if (functionCall) {
        const fc = functionCall.functionCall;
        if (fc.name === "update_support_prompt" && fc.args?.new_prompt) {
          const upsertPayload: any = sysConfig?.id
            ? { id: sysConfig.id, custom_prompt: fc.args.new_prompt }
            : { custom_prompt: fc.args.new_prompt };
          const { error: updateError } = await supabaseAdmin
            .from("system_ai_config")
            .upsert(upsertPayload);

          let functionResult: any;
          if (updateError) {
            functionResult = { success: false, error: updateError.message };
          } else {
            promptUpdated = true;
            newPromptValue = fc.args.new_prompt;
            functionResult = { success: true, message: "Instruções atualizadas no banco!" };
          }

          geminiPayload.contents.push(content);
          geminiPayload.contents.push({
            role: "user",
            parts: [{ functionResponse: { name: fc.name, response: functionResult } }],
          });
          functionCallsProcessed++;
          continue;
        }
      }

      const textParts = content.parts.filter((p: any) => p.text !== undefined);
      if (textParts.length > 0) {
        aiReply = textParts.map((p: any) => p.text).join("");
      } else {
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

    if (!aiReply) aiReply = "Desculpe, não consegui processar. Pode tentar novamente?";

    return new Response(
      JSON.stringify({
        message: aiReply,
        promptUpdated,
        newPrompt: promptUpdated ? newPromptValue : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("support-prompt-generator-ai error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});