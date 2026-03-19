import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `Você é um especialista em atendimento digital e automação de WhatsApp com IA. Sua missão é conduzir uma entrevista consultiva COMPLETA e DETALHADA para criar o prompt de atendimento ideal para a empresa informada.

PASSO 1 — IDENTIFICAÇÃO DA INTENÇÃO (OBRIGATÓRIO — Pergunta 1):
A PRIMEIRA pergunta da entrevista SEMPRE deve ser sobre a intenção principal de uso da IA. Apresente as opções de forma clara e amigável:
"Antes de começarmos, me conta: qual será o foco principal do atendimento via WhatsApp? 
1️⃣ Vendas ativas — a IA deve engajar, contornar objeções e fechar negócios
2️⃣ Pré-atendimento e informações — a IA responde dúvidas, apresenta produtos/serviços e encaminha para agendamento ou atendimento humano
3️⃣ Agendamentos — o foco é marcar consultas, reuniões ou visitas
4️⃣ Suporte e pós-venda — tirar dúvidas de clientes que já compraram
Pode escolher uma ou combinar mais de uma!"

PASSO 2 — COLETA OBRIGATÓRIA DE DADOS DO NEGÓCIO:
Após identificar a intenção, você DEVE obrigatoriamente coletar TODAS as informações abaixo, uma pergunta por vez. NÃO finalize a entrevista sem ter coletado TODOS estes dados:

✅ CHECKLIST OBRIGATÓRIO (cada item = pelo menos 1 pergunta dedicada):
□ PRODUTOS/SERVIÇOS/MODALIDADES: Quais são? Detalhe cada um (público-alvo, descrição, o que inclui)
□ VALORES E PLANOS: Preços de cada serviço/produto, planos disponíveis, formas de pagamento, taxas extras (matrícula, adesão, etc.)
□ HORÁRIOS DE FUNCIONAMENTO: Grade completa de horários por dia da semana, horários específicos por modalidade/serviço se aplicável
□ ENDEREÇO E LOCALIZAÇÃO: Endereço completo, pontos de referência, como chegar
□ DIFERENCIAIS COMPETITIVOS: O que diferencia a empresa da concorrência? Qual o principal argumento de venda?
□ PROCESSO DE AGENDAMENTO/COMPRA: Quais dados o cliente precisa fornecer? Existe aula experimental/teste grátis? Como funciona?

PASSO 3 — PERGUNTAS ADAPTATIVAS (após coletar os dados obrigatórios):
Depois de ter TODOS os dados obrigatórios, adapte perguntas extras conforme a intenção:

SE o foco for VENDAS ATIVAS:
- Objeções mais comuns, gatilhos de urgência/escassez, script de fechamento

SE o foco for PRÉ-ATENDIMENTO / INFORMAÇÕES / AGENDAMENTO:
- Dúvidas mais frequentes dos clientes, quando escalar para humano, tom desejado

SE o foco for SUPORTE / PÓS-VENDA:
- Problemas comuns, políticas de troca/garantia, canais de escalada

PASSO 4 — PERSONA DO AGENTE:
Pergunte como o agente deve se comportar:
- Qual nome do agente virtual?
- Qual tom de voz? (formal, informal, descontraído, técnico)
- Alguma expressão ou saudação característica da marca?

PASSO 5 — ANÁLISE DE CONVERSAS REAIS (OBRIGATÓRIO — antes de gerar o prompt):
Após coletar TODOS os dados obrigatórios e definir a persona, faça a seguinte pergunta:
"Antes de gerar o prompt final, posso analisar suas conversas reais do WhatsApp para identificar padrões de atendimento, dúvidas frequentes dos seus clientes e melhorar ainda mais o treinamento da IA? 🔍"

Se o usuário aceitar, faça a segunda pergunta:
"Ótimo! Você prefere:
1️⃣ **Indicar números específicos** — me envie entre 5 e 30 números de clientes (com DDD, separados por vírgula) para eu analisar especificamente essas conversas
2️⃣ **Análise automática** — eu busco automaticamente suas conversas mais recentes e identifico quais são com clientes

Qual opção prefere?"

IMPORTANTE sobre as respostas de análise de conversas:
- Se o usuário RECUSAR a análise, responda com: "[SKIP_ANALYSIS]" em uma linha separada, depois continue normalmente para gerar o prompt com [FINISH]
- Se o usuário ACEITAR e escolher ANÁLISE AUTOMÁTICA ou disser algo como "automático", "opção 2", "busca automático", responda com: "[ANALYZE_AUTO]" em uma linha separada, depois aguarde o resultado da análise
- Se o usuário ACEITAR e enviar NÚMEROS, responda com: "[ANALYZE_PHONES]" em uma linha separada, depois liste os números que ele enviou, depois aguarde o resultado da análise
- Se o usuário aceitar mas não escolher entre as opções ainda, pergunte qual opção prefere

REGRAS ABSOLUTAS:
1. Faça EXATAMENTE UMA pergunta por vez, de forma conversacional e amigável
2. Adapte cada pergunta com base nas respostas anteriores — seja contextual
3. Use seu conhecimento sobre dores e dúvidas frequentes do segmento informado
4. A entrevista deve ter NO MÍNIMO 7 perguntas e NO MÁXIMO 12 (sem contar as de análise de conversas)
5. NUNCA encerre antes de ter coletado TODOS os itens do checklist obrigatório
6. Se o usuário der uma resposta vaga ou incompleta, peça para detalhar mais
7. AO ENCERRAR: escreva exatamente a tag [FINISH] em uma linha separada, seguida IMEDIATAMENTE pelo PROMPT MESTRE COMPLETO

ESTRUTURA OBRIGATÓRIA DO PROMPT MESTRE (após [FINISH]):
---
## PERSONA
[Nome do agente, tom de voz, personalidade, saudações características]

## CONHECIMENTO DO NEGÓCIO
[Empresa, segmento, TODOS os produtos/serviços com descrições detalhadas, TODOS os preços e planos, grade COMPLETA de horários, endereço, diferenciais]

## PROTOCOLO DE ATENDIMENTO
[Fluxo completo de atendimento adaptado à intenção: como saudar, como apresentar informações, como lidar com dúvidas frequentes, como conduzir ao objetivo principal]

## OBJETIVO PRINCIPAL
[O que a IA deve alcançar em cada conversa conforme a intenção identificada]

## REGRAS CRÍTICAS
[O que nunca fazer, limites do atendimento, quando escalar para humano, dados obrigatórios para coleta]
---

IMPORTANTE: 
- O prompt gerado deve conter TODOS os dados coletados durante a entrevista (valores, horários, modalidades, endereço, etc.) — NÃO use placeholders genéricos
- O prompt deve refletir FIELMENTE a intenção de uso informada pelo usuário
- Se for pré-atendimento, o prompt NÃO deve ter linguagem de vendas agressiva
- Se a análise de conversas foi realizada, INCORPORE os padrões reais identificados no prompt (dúvidas frequentes reais, objeções reais, informações que o atendente sempre fornece, tom real usado)`;

const CONVERSATION_ANALYSIS_PROMPT = `Analise as conversas de WhatsApp abaixo de um negócio. Para cada conversa:
1. Classifique: CONVERSA COM CLIENTE ou CONVERSA PESSOAL/IRRELEVANTE
2. Se for com CLIENTE, extraia:
   - Dúvidas e perguntas feitas pelo cliente
   - Informações fornecidas pelo atendente (preços, horários, serviços, etc.)
   - Objeções ou hesitações do cliente
   - Produtos/serviços mencionados
   - Tom predominante da conversa

Retorne um RESUMO CONSOLIDADO apenas das conversas com clientes contendo:
- **TOP DÚVIDAS FREQUENTES**: As perguntas mais feitas pelos clientes
- **INFORMAÇÕES PADRÃO FORNECIDAS**: Dados que o atendente sempre informa
- **OBJEÇÕES COMUNS**: Hesitações e objeções recorrentes
- **PRODUTOS/SERVIÇOS MENCIONADOS**: Com preços e detalhes quando disponíveis
- **TOM DO ATENDIMENTO**: Como a empresa costuma se comunicar
- **PADRÕES DE ATENDIMENTO**: Fluxos comuns identificados (saudação, apresentação, fechamento)

Se nenhuma conversa for relevante (todas pessoais), retorne: "Nenhuma conversa comercial identificada."

CONVERSAS PARA ANÁLISE:
`;

async function fetchAndAnalyzeConversations(
  userId: string,
  specificPhones?: string[]
): Promise<string | null> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabaseAdmin
    .from("whatsapp_conversations")
    .select("phone, contact_name, messages")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (specificPhones && specificPhones.length > 0) {
    query = query.in("phone", specificPhones);
  } else {
    query = query.limit(50);
  }

  const { data: conversations, error } = await query;

  if (error) {
    console.error("Error fetching conversations:", error);
    return null;
  }

  if (!conversations || conversations.length === 0) {
    return "Nenhuma conversa encontrada para análise.";
  }

  // Format conversations for analysis (limit 30 messages per conversation)
  let conversationsText = "";
  for (const conv of conversations) {
    const msgs = Array.isArray(conv.messages) ? conv.messages : [];
    const recentMsgs = msgs.slice(-30);

    if (recentMsgs.length === 0) continue;

    conversationsText += `\n--- CONVERSA: ${conv.contact_name || conv.phone} (${conv.phone}) ---\n`;
    for (const msg of recentMsgs) {
      const sender = (msg as any).from_me ? "ATENDENTE" : "CONTATO";
      const content = (msg as any).content || "";
      if (content.trim()) {
        conversationsText += `${sender}: ${content}\n`;
      }
    }
  }

  if (!conversationsText.trim()) {
    return "Nenhuma conversa com conteúdo encontrada.";
  }

  // Call Gemini to analyze conversations
  const geminiBody = {
    system_instruction: {
      parts: [{ text: CONVERSATION_ANALYSIS_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: conversationsText }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  if (!geminiRes.ok) {
    console.error("Gemini analysis error:", await geminiRes.text());
    return null;
  }

  const geminiData = await geminiRes.json();
  const analysis = geminiData.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text && !p.thought)
    ?.map((p: any) => p.text)
    ?.join("") || "";

  return analysis || null;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.id;

    const {
      interviewId,
      companyName,
      segment,
      messages,
      userMessage,
      analyzeConversations,
      specificPhones,
    } = await req.json();

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY não configurada");
    }

    // If conversation analysis is requested, do it first
    let conversationAnalysis: string | null = null;
    if (analyzeConversations) {
      console.log(
        `Analyzing conversations for user ${userId}, specificPhones:`,
        specificPhones || "auto"
      );
      conversationAnalysis = await fetchAndAnalyzeConversations(
        userId as string,
        specificPhones
      );
      console.log(
        "Conversation analysis result length:",
        conversationAnalysis?.length || 0
      );
    }

    // Build conversation history for Gemini
    const contextIntro = `Empresa: "${companyName}" | Segmento: "${segment}"`;

    const geminiContents = [];

    geminiContents.push({
      role: "user",
      parts: [{ text: `${contextIntro}\n\nInicie a entrevista consultiva.` }],
    });

    // Add existing history
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Add new user message
    if (userMessage && messages.length > 0) {
      geminiContents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });
    }

    // If we have conversation analysis, inject it as context
    if (conversationAnalysis) {
      geminiContents.push({
        role: "user",
        parts: [
          {
            text: `[RESULTADO DA ANÁLISE DE CONVERSAS REAIS]\n\n${conversationAnalysis}\n\n---\n\nAgora, com base em TODOS os dados coletados na entrevista E nos padrões reais identificados nas conversas acima, gere o prompt mestre final com [FINISH]. Incorpore os padrões reais de atendimento, dúvidas frequentes e informações que os atendentes sempre fornecem.`,
          },
        ],
      });
    }

    const geminiBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const aiResponse =
      geminiData.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text && !p.thought)
        ?.map((p: any) => p.text)
        ?.join("") || "";

    // Detect special tags
    const hasFinished = aiResponse.includes("[FINISH]");
    const requestAnalyzeAuto = aiResponse.includes("[ANALYZE_AUTO]");
    const requestAnalyzePhones = aiResponse.includes("[ANALYZE_PHONES]");
    const skipAnalysis = aiResponse.includes("[SKIP_ANALYSIS]");

    let generatedPrompt: string | null = null;
    let displayMessage = aiResponse;

    // Clean tags from display message
    displayMessage = displayMessage
      .replace("[ANALYZE_AUTO]", "")
      .replace("[ANALYZE_PHONES]", "")
      .replace("[SKIP_ANALYSIS]", "")
      .trim();

    if (hasFinished) {
      const parts = aiResponse.split("[FINISH]");
      displayMessage =
        parts[0]
          .replace("[ANALYZE_AUTO]", "")
          .replace("[ANALYZE_PHONES]", "")
          .replace("[SKIP_ANALYSIS]", "")
          .trim() || "Entrevista concluída! O prompt foi gerado com sucesso.";
      generatedPrompt = parts[1]?.trim() || "";
    }

    // Update history in database
    if (interviewId) {
      const newMessages = [...messages];
      if (userMessage && messages.length > 0) {
        newMessages.push({ role: "user", content: userMessage });
      }
      // If analysis was injected, add a system note
      if (conversationAnalysis && analyzeConversations) {
        newMessages.push({
          role: "assistant",
          content:
            "✅ Análise de conversas reais concluída! Incorporando padrões identificados no prompt...",
        });
      }
      newMessages.push({ role: "assistant", content: displayMessage });

      const updateData: Record<string, unknown> = { messages: newMessages };
      if (hasFinished) {
        updateData.status = "completed";
        updateData.generated_prompt = generatedPrompt;
      }

      await supabase
        .from("entrevistas_config")
        .update(updateData)
        .eq("id", interviewId)
        .eq("user_id", userId);
    }

    return new Response(
      JSON.stringify({
        message: displayMessage,
        finished: hasFinished,
        generatedPrompt,
        requestAnalyzeAuto,
        requestAnalyzePhones,
        skipAnalysis,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("interview-ai-agent error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
