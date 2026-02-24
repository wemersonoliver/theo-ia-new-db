import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

REGRAS ABSOLUTAS:
1. Faça EXATAMENTE UMA pergunta por vez, de forma conversacional e amigável
2. Adapte cada pergunta com base nas respostas anteriores — seja contextual
3. Use seu conhecimento sobre dores e dúvidas frequentes do segmento informado
4. A entrevista deve ter NO MÍNIMO 7 perguntas e NO MÁXIMO 12
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
- Se for pré-atendimento, o prompt NÃO deve ter linguagem de vendas agressiva`;

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

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.claims.sub;

    const { interviewId, companyName, segment, messages, userMessage } = await req.json();

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY não configurada");
    }

    // Monta o histórico de conversa para o Gemini
    const contextIntro = `Empresa: "${companyName}" | Segmento: "${segment}"`;
    
    const geminiContents = [];
    
    // Primeira mensagem do sistema como user turn (Gemini não aceita system role direto em contents)
    geminiContents.push({
      role: "user",
      parts: [{ text: `${contextIntro}\n\nInicie a entrevista consultiva.` }],
    });

    // Adiciona histórico existente
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Adiciona a nova mensagem do usuário (se não for o início)
    if (userMessage && messages.length > 0) {
      geminiContents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });
    }

    const geminiBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
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
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Detecta se a entrevista terminou
    const hasFinished = aiResponse.includes("[FINISH]");
    let generatedPrompt: string | null = null;
    let displayMessage = aiResponse;

    if (hasFinished) {
      const parts = aiResponse.split("[FINISH]");
      displayMessage = parts[0].trim() || "Entrevista concluída! O prompt foi gerado com sucesso.";
      generatedPrompt = parts[1]?.trim() || "";
    }

    // Atualiza o histórico no banco
    if (interviewId) {
      const newMessages = [...messages];
      if (userMessage && messages.length > 0) {
        newMessages.push({ role: "user", content: userMessage });
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
