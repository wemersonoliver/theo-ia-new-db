import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanAIText } from "../_ai_text.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ITEMS_PER_RUN = 5;

function sanitizeContactName(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const name = rawName.trim();
  if (name.length < 3) return null;
  if (/^\d+$/.test(name)) return null;
  const letterCount = (name.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letterCount < 3) return null;
  const lower = name.toLowerCase();
  const blacklist = ["user", "usuario", "usuário", "cliente", "client", "whatsapp", "wpp", "anp", "test", "teste", "lead", "contato", "contact"];
  if (blacklist.includes(lower)) return null;
  if (/^[^A-Za-zÀ-ÿ]+$/.test(name)) return null;
  const firstWord = name.split(/\s+/)[0];
  if (firstWord.length < 3) return null;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

const HOOK_LIBRARY: Record<string, { name: string; instruction: string; example: string }> = {
  confirmacao_de_leitura: {
    name: "Confirmação de Leitura",
    instruction: "O cliente recebeu material/link/proposta concreta. Pergunte de forma leve se conseguiu olhar/avaliar — referenciando EXATAMENTE o que foi enviado.",
    example: "Conseguiu dar uma olhadinha no material que te mandei? Posso esclarecer alguma dúvida.",
  },
  rotulo_voss: {
    name: "Rótulo (Chris Voss)",
    instruction: "Nomeie a possível objeção/sentimento sem cobrar. Use 'parece que...', 'imagino que...'. Reduz resistência.",
    example: "Parece que algo te fez pausar essa decisão... posso ajudar a clarear alguma dúvida?",
  },
  pergunta_calibrada: {
    name: "Pergunta Calibrada (Chris Voss)",
    instruction: "Pergunta com 'como' ou 'o que' que faz refletir sobre o resultado desejado.",
    example: "Como seria pra você se conseguíssemos automatizar [problema] essa semana?",
  },
  coerencia_cialdini: {
    name: "Coerência (Cialdini)",
    instruction: "Relembre algo que o cliente JÁ DISSE querer/precisar. Cite literalmente.",
    example: "Você comentou que precisava resolver [X] — isso ainda faz sentido pra você?",
  },
  prova_social: {
    name: "Prova Social (Cialdini)",
    instruction: "Mencione resultado de outros clientes parecidos (sem nomes).",
    example: "Outros clientes do mesmo perfil que o seu conseguiram [resultado] em poucos dias — vale a pena tentar?",
  },
  reciprocidade: {
    name: "Reciprocidade (Cialdini)",
    instruction: "Ofereça algo de valor sem pedir nada em troca: dica, material, demo.",
    example: "Separei uma dica rápida que pode te ajudar com [tema] — quer que eu te mande?",
  },
  escassez: {
    name: "Escassez Real",
    instruction: "USE APENAS NOS DIAS 5-6. Crie urgência REAL com prazo/condição que de fato muda.",
    example: "Essa condição vale até [prazo], depois entra a tabela cheia. Quer que eu garanta pra você?",
  },
  pergunta_de_saida: {
    name: "Pergunta de Saída",
    instruction: "USE APENAS NO ÚLTIMO DIA. Encerramento elegante que dá ao cliente a opção de fechar a porta com dignidade.",
    example: "Faz sentido a gente pausar por aqui, ou ainda quer seguir adiante?",
  },
  dor_lead_perdido: {
    name: "Dor: Lead que some sem comprar",
    instruction: "Bata na dor de perder leads que param de responder. Mostre que o Theo IA faz EXATAMENTE o que você está fazendo agora: recuperar quem sumiu. Conecte com aumento de faturamento. Termine convidando pro teste grátis de 15 dias.",
    example: "Imagina seu WhatsApp recuperando sozinho aquele cliente que sumiu — exatamente como eu estou fazendo com você agora. 90% dos negócios não fazem isso e perdem faturamento todo mês. Bora ativar seu teste grátis de 15 dias?",
  },
  dor_atendimento_24_7: {
    name: "Dor: Vendas perdidas fora do horário",
    instruction: "Ataque a dor de perder venda à noite, fim de semana, feriado. Mostre que o Theo responde em segundos, 24h. Convide pro teste grátis.",
    example: "Quantas vendas você acha que perde de noite ou no fim de semana porque ninguém responde? O Theo atende em segundos, 24h. Quer testar 15 dias grátis no seu WhatsApp?",
  },
  dor_resposta_demorada: {
    name: "Dor: Lead quente que esfria",
    instruction: "Mostre que cliente quente espera no máximo 2-5 minutos antes de ir pro concorrente. Posicione o Theo como a resposta instantânea que salva a venda.",
    example: "Cliente quente espera 2 minutos. Depois disso, ele já tá no concorrente. Quer ver o Theo respondendo no seu WhatsApp em segundos?",
  },
  solucao_agendamento: {
    name: "Solução: Agendamento automático",
    instruction: "Mostre que o Theo agenda reuniões/atendimentos sozinho dentro do WhatsApp, sem o dono abrir agenda. Foque na economia de tempo.",
    example: "E se o próprio WhatsApp já agendasse a reunião com o cliente, sem você abrir agenda? É exatamente o que o Theo faz. Quer ver funcionando no seu número?",
  },
  solucao_qualificacao: {
    name: "Solução: Qualificação automática + handoff",
    instruction: "Mostre que o Theo conversa com todos os leads, qualifica, e só te chama quando o cara tá pronto pra fechar. Você só entra na conversa que importa.",
    example: "O Theo qualifica os leads sozinho e te chama só quando tá pronto pra fechar. Você só entra na conversa que importa. Quer testar 15 dias grátis?",
  },
};

function isGenericGreeting(msg: string): boolean {
  const cleaned = msg.toLowerCase().trim().replace(/[!.?,]/g, "").replace(/\s+/g, " ");
  const patterns = [
    /^(olá|oi|ola|opa|e[ai])\s+(tudo bem|tudo certo|td bem|td certo|como (você |voce )?(vai|está|esta|tá|ta))\s*$/,
    /^(olá|oi|ola|opa)\s+\w{1,15}\s+(tudo bem|td bem|tudo certo)\s*$/,
    /^(olá|oi|ola)\s*$/,
  ];
  return patterns.some((rx) => rx.test(cleaned));
}

interface ConversationAnalysis {
  offered_item: string;
  pending_object: string;
  lead_temperature: "frio" | "morno" | "quente";
  last_open_point: string;
  name_is_valid: boolean;
  sanitized_name: string | null;
  recommended_hook: string;
  scenario: "curiosidade_inicial" | "conversa_interrompida" | "nunca_respondeu";
  reasoning: string;
}

async function analyzeConversation(
  geminiKey: string,
  contextText: string,
  rawContactName: string | null,
  silencePattern: string,
  lastClientSnippet: string,
  currentDay: number,
  maxDays: number,
  clientMessageCount: number,
): Promise<ConversationAnalysis | null> {
  const sanitized = sanitizeContactName(rawContactName);

  const analysisPrompt = `Você é um analista de vendas. Analise a conversa abaixo e extraia informações estruturadas para gerar uma mensagem de follow-up de alta conversão.

CONVERSA:
${contextText || "(sem histórico relevante)"}

METADADOS:
- Nome bruto do contato: "${rawContactName || "(vazio)"}"
- Nome sanitizado: "${sanitized || "(inválido)"}"
- Padrão de silêncio: ${silencePattern}
- Última mensagem do cliente: "${lastClientSnippet || "(nunca respondeu)"}"
- Total de mensagens enviadas pelo cliente: ${clientMessageCount}
- Dia atual: ${currentDay} de ${maxDays}

CLASSIFICAÇÃO DE CENÁRIO (campo scenario):
- "nunca_respondeu": cliente nunca enviou mensagem nenhuma (clientMessageCount = 0)
- "curiosidade_inicial": cliente enviou 1-3 mensagens curtas demonstrando interesse genérico ("quero saber mais", "como funciona", "tem teste?", "qual valor?") e sumiu antes de aprofundar contexto/objeção
- "conversa_interrompida": cliente enviou 4+ mensagens OU mensagens com contexto específico (problemas reais do negócio, objeções concretas, perguntas técnicas, comparações) e parou em algum ponto identificável da negociação

Retorne via tool call um JSON estruturado. Seja FACTUAL — extraia informações REAIS da conversa, não invente.`;

  const tool = {
    function_declarations: [{
      name: "registrar_analise",
      description: "Registra a análise estruturada da conversa.",
      parameters: {
        type: "object",
        properties: {
          offered_item: { type: "string" },
          pending_object: { type: "string" },
          lead_temperature: { type: "string", enum: ["frio", "morno", "quente"] },
          last_open_point: { type: "string" },
          name_is_valid: { type: "boolean" },
          sanitized_name: { type: "string" },
          recommended_hook: {
            type: "string",
            enum: ["confirmacao_de_leitura", "rotulo_voss", "pergunta_calibrada", "coerencia_cialdini", "prova_social", "reciprocidade", "escassez", "pergunta_de_saida", "dor_lead_perdido", "dor_atendimento_24_7", "dor_resposta_demorada", "solucao_agendamento", "solucao_qualificacao"],
          },
          scenario: {
            type: "string",
            enum: ["curiosidade_inicial", "conversa_interrompida", "nunca_respondeu"],
          },
          reasoning: { type: "string" },
        },
        required: ["offered_item", "pending_object", "lead_temperature", "last_open_point", "name_is_valid", "sanitized_name", "recommended_hook", "scenario", "reasoning"],
      },
    }],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
        tools: [tool],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_analise"] } },
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
      }),
    },
  );

  if (!response.ok) {
    console.error("Gemini analysis failed:", response.status, await response.text());
    return null;
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
  if (!fnCall?.args) return null;
  const args = fnCall.args;
  return {
    offered_item: args.offered_item || "nenhum item específico",
    pending_object: args.pending_object || "retomar a conversa",
    lead_temperature: args.lead_temperature || "frio",
    last_open_point: args.last_open_point || "",
    name_is_valid: args.name_is_valid === true,
    sanitized_name: args.name_is_valid ? (args.sanitized_name || sanitized) : null,
    recommended_hook: args.recommended_hook || "pergunta_calibrada",
    scenario: args.scenario || (clientMessageCount === 0 ? "nunca_respondeu" : clientMessageCount <= 3 ? "curiosidade_inicial" : "conversa_interrompida"),
    reasoning: args.reasoning || "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Carrega config singleton
    const { data: config } = await supabase
      .from("system_followup_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ processed: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega instância de WhatsApp do sistema
    const { data: instance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .limit(1)
      .maybeSingle();

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ processed: 0, reason: "whatsapp not connected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega config de IA do sistema (para nome do agente)
    const { data: aiConfig } = await supabase
      .from("system_ai_config")
      .select("agent_name")
      .limit(1)
      .maybeSingle();

    const agentName = aiConfig?.agent_name || "Theo";

    const { data: pendingItems } = await supabase
      .from("system_followup_tracking")
      .select("*")
      .eq("status", "pending")
      .lte("next_scheduled_at", new Date().toISOString())
      .order("next_scheduled_at", { ascending: true })
      .limit(MAX_ITEMS_PER_RUN);

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const maxDays = config.max_days || 6;
    const bargainingTools = config.bargaining_tools || "";

    for (const item of pendingItems) {
      try {
        // Re-check status
        const { data: freshItem } = await supabase
          .from("system_followup_tracking")
          .select("status")
          .eq("id", item.id)
          .single();

        if (!freshItem || freshItem.status !== "pending") continue;

        // 3h interval
        if (item.last_sent_at) {
          const lastSent = new Date(item.last_sent_at).getTime();
          if (Date.now() - lastSent < 3 * 60 * 60 * 1000) continue;
        }

        const { data: conversation } = await supabase
          .from("system_whatsapp_conversations")
          .select("messages, contact_name, ai_active")
          .eq("phone", item.phone)
          .maybeSingle();

        if (!conversation) {
          await supabase.from("system_followup_tracking").update({ status: "declined" }).eq("id", item.id);
          continue;
        }

        if (config.exclude_handoff && conversation.ai_active === false) {
          await supabase.from("system_followup_tracking").update({ status: "declined" }).eq("id", item.id);
          continue;
        }

        const currentDay = Math.ceil(item.current_step / 2);
        const isMorning = item.current_step % 2 === 1;

        if (currentDay > maxDays) {
          await supabase.from("system_followup_tracking").update({ status: "exhausted" }).eq("id", item.id);
          continue;
        }

        const messages = (conversation.messages as any[]) || [];
        const lastMessages = messages.slice(-10);
        const contextText = lastMessages
          .map((m: any) => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
          .join("\n");

        const clientHasEverReplied = messages.some((m: any) => !m.from_me);
        const lastClientMsg = [...messages].reverse().find((m: any) => !m.from_me);
        const lastClientSnippet = lastClientMsg?.content?.slice(0, 120) || "";
        const silencePattern = clientHasEverReplied ? "DROPPED_OFF" : "NEVER_REPLIED";
        const clientMessageCount = messages.filter((m: any) => !m.from_me).length;

        const rawContactName = conversation.contact_name || null;

        const analysis = await analyzeConversation(
          geminiKey,
          contextText,
          rawContactName,
          silencePattern,
          lastClientSnippet,
          currentDay,
          maxDays,
          clientMessageCount,
        );

        if (!analysis) continue;

        // Hooks usados anteriormente neste lead (anti-repetição)
        const engagementData = (item.engagement_data as any) || {};
        const usedHooks: string[] = Array.isArray(engagementData.used_hooks) ? engagementData.used_hooks : [];
        const lastHook: string | null = engagementData.last_hook || null;

        // Pools por cenário
        const POOL_CURIOSIDADE = ["dor_lead_perdido", "dor_atendimento_24_7", "dor_resposta_demorada", "solucao_agendamento", "solucao_qualificacao"];
        const POOL_INTERROMPIDA = ["coerencia_cialdini", "rotulo_voss", "pergunta_calibrada", "confirmacao_de_leitura", "prova_social"];
        const POOL_NUNCA = ["dor_lead_perdido", "reciprocidade", "dor_atendimento_24_7", "solucao_qualificacao"];

        const pickFromPool = (pool: string[]): string => {
          // Prefere hooks ainda não usados, e nunca repete o último
          const fresh = pool.filter((h) => !usedHooks.includes(h) && h !== lastHook);
          if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
          const notLast = pool.filter((h) => h !== lastHook);
          return notLast.length > 0
            ? notLast[Math.floor(Math.random() * notLast.length)]
            : pool[Math.floor(Math.random() * pool.length)];
        };

        let hookKey = analysis.recommended_hook;

        // Override por cenário: se o hook recomendado não for adequado ao cenário, escolhe do pool certo
        if (analysis.scenario === "curiosidade_inicial" && !POOL_CURIOSIDADE.includes(hookKey)) {
          hookKey = pickFromPool(POOL_CURIOSIDADE);
        } else if (analysis.scenario === "conversa_interrompida" && !POOL_INTERROMPIDA.includes(hookKey)) {
          hookKey = pickFromPool(POOL_INTERROMPIDA);
        } else if (analysis.scenario === "nunca_respondeu" && !POOL_NUNCA.includes(hookKey)) {
          hookKey = pickFromPool(POOL_NUNCA);
        }

        // Evita repetir o mesmo hook 2x seguidas
        if (hookKey === lastHook) {
          const pool = analysis.scenario === "curiosidade_inicial" ? POOL_CURIOSIDADE
            : analysis.scenario === "conversa_interrompida" ? POOL_INTERROMPIDA
            : POOL_NUNCA;
          hookKey = pickFromPool(pool);
        }

        // Travas de fase
        if (hookKey === "escassez" && currentDay < 5) hookKey = "coerencia_cialdini";
        if (hookKey === "pergunta_de_saida" && currentDay < maxDays) hookKey = "rotulo_voss";

        const hook = HOOK_LIBRARY[hookKey] || HOOK_LIBRARY.pergunta_calibrada;

        const nameForGreeting = analysis.name_is_valid && analysis.sanitized_name
          ? analysis.sanitized_name
          : null;

        // Bloco de instruções específico do cenário
        const scenarioBlock =
          analysis.scenario === "curiosidade_inicial"
            ? `🎯 CENÁRIO: CURIOSIDADE INICIAL
O lead demonstrou interesse genérico ("quero saber mais", "como funciona", etc.) e sumiu antes de aprofundar. Ele NÃO sabe ainda o que o Theo IA realmente entrega.

ESTRUTURA OBRIGATÓRIA da mensagem (2-3 linhas):
1. Abra batendo na DOR REAL de quem vende pelo WhatsApp (use o gancho escolhido)
2. Mostre 1 SOLUÇÃO CONCRETA do Theo IA conectada à dor (não venda tudo, foque em UMA)
3. Termine convidando pro TESTE GRÁTIS DE 15 DIAS com pergunta direta

FUNCIONALIDADES DO THEO IA que você pode citar (escolha 1 alinhada à dor):
- Recupera leads inativos automaticamente (igual a esta mensagem)
- Atendimento 24/7 (responde de noite, fim de semana, feriado)
- Resposta em segundos (não deixa cliente quente esfriar)
- Agendamento automático dentro do WhatsApp (sem abrir agenda)
- Qualifica leads sozinho e te chama só quando tá pronto pra fechar
- Transferência inteligente pra humano quando precisa
- Aprende com a base de conhecimento do seu negócio`
            : analysis.scenario === "conversa_interrompida"
            ? `🎯 CENÁRIO: CONVERSA INTERROMPIDA
O lead já trocou várias mensagens e parou em um ponto específico. Ele JÁ CONHECE o produto — não venda do zero.

ESTRUTURA OBRIGATÓRIA da mensagem (2-3 linhas):
1. Referencie EXATAMENTE o último ponto que ele falou ("${analysis.last_open_point || analysis.pending_object}") — sem inventar
2. Resolva a objeção implícita ou nomeie o sentimento (use o gancho escolhido)
3. Termine com pergunta calibrada que destrava o próximo passo concreto

❌ PROIBIDO neste cenário: argumentar de novo sobre features que ele já conhece, repetir pitch genérico.`
            : `🎯 CENÁRIO: NUNCA RESPONDEU
O lead recebeu mensagens mas nunca respondeu. Pode ter chegado por anúncio sem contexto.

ESTRUTURA OBRIGATÓRIA da mensagem (2-3 linhas):
1. Abra com a dor mais universal de quem vende no WhatsApp (use o gancho)
2. Mostre que o Theo resolve isso (1 funcionalidade concreta)
3. Termine com pergunta de baixo atrito ("posso te explicar em 30 segundos?")`;

        const generationPrompt = `Você é ${agentName}, um consultor humano experiente do time de vendas do Theo IA reativando um lead por WhatsApp. Theo IA é um sistema de atendimento automatizado por IA para WhatsApp voltado a donos de negócio que vendem/atendem pelo WhatsApp.

Use técnicas de Cialdini ("As Armas da Persuasão") e Chris Voss ("Never Split the Difference").

ANÁLISE DA CONVERSA (FATOS — use exatamente isso):
- Item oferecido: ${analysis.offered_item}
- O que o cliente precisa fazer: ${analysis.pending_object}
- Último ponto em aberto: ${analysis.last_open_point || "(nenhum)"}
- Temperatura do lead: ${analysis.lead_temperature}
- Mensagens já enviadas pelo cliente: ${clientMessageCount}
- Padrão de silêncio: ${silencePattern}
- Dia atual: ${currentDay} de ${maxDays} | Tentativa: ${item.current_step}
${nameForGreeting ? `- Nome do cliente (validado): ${nameForGreeting}` : `- Nome do cliente: INVÁLIDO/AUSENTE — NÃO use nome, use saudação neutra ("Oi!", "E aí!")`}
${currentDay >= 5 && bargainingTools ? `- Armas de negociação disponíveis (use APENAS agora): ${bargainingTools}` : ""}
${usedHooks.length > 0 ? `- Ângulos JÁ USADOS com este lead (NÃO repetir o mesmo argumento): ${usedHooks.join(", ")}` : ""}

${scenarioBlock}

GANCHO DE PERSUASÃO ESCOLHIDO PARA ESTA MENSAGEM: ${hook.name}
Como aplicar: ${hook.instruction}
Exemplo do ESTILO (não copie literalmente): "${hook.example}"

CONTEXTO DA CONVERSA (apenas referência — não copie literalmente):
${contextText || "(sem histórico)"}

REGRAS OBRIGATÓRIAS — quebrar = mensagem rejeitada:
1. ❌ PROIBIDO começar com "Olá, tudo bem?", "Oi, tudo bem?" sozinho
2. ❌ PROIBIDO usar "Como você está?" como pergunta principal
3. ❌ PROIBIDO usar nomes inválidos
4. ❌ PROIBIDO mencionar que é IA, automático, robô, bot ou follow-up
5. ❌ PROIBIDO oferecer desconto/promoção antes do dia 5
6. ❌ PROIBIDO repetir os ângulos já usados (listados acima)
7. ✅ A mensagem DEVE seguir a ESTRUTURA OBRIGATÓRIA do cenário acima
8. ✅ A mensagem DEVE terminar com UMA pergunta direta
9. ✅ Máximo 3 linhas curtas, estilo WhatsApp natural (frases diretas, sem firula)
10. ✅ Máximo 1 emoji (opcional)
11. ✅ Tom humano, confiante, espontâneo — como consultor experiente, não vendedor desesperado

Retorne APENAS a mensagem final pronta pra enviar, sem explicações, sem aspas, sem prefixos.`;

        let aiMessage: string | null = null;
        let rateLimited = false;

        for (let attempt = 0; attempt < 2; attempt++) {
          const promptToUse = attempt === 0
            ? generationPrompt
            : generationPrompt + `\n\n⚠️ TENTATIVA ANTERIOR FOI REJEITADA POR SER GENÉRICA. Reescreva começando IMEDIATAMENTE com referência concreta ao item oferecido ou ao último ponto da conversa.`;

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptToUse }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
              }),
            },
          );

          if (!geminiResponse.ok) {
            if (geminiResponse.status === 429) { rateLimited = true; break; }
            break;
          }

          const geminiData = await geminiResponse.json();
          const candidate = cleanAIText(geminiData.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text && !p.thoughtSignature)
            ?.map((p: any) => p.text)
            ?.join("")
            ?.trim()
            ?.replace(/^["'`]+|["'`]+$/g, ""));

          if (!candidate) continue;
          if (isGenericGreeting(candidate)) continue;

          aiMessage = candidate;
          break;
        }

        if (rateLimited) break;
        if (!aiMessage) continue;

        // Composing indicator (fire-and-forget)
        const composingDelay = 2000 + Math.random() * 2000;
        fetch(`${evolutionUrl}/chat/presence/${instance.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({
            number: item.phone,
            delay: Math.floor(composingDelay),
            presence: "composing",
          }),
        }).catch((e) => console.error("Composing failed:", e));

        await new Promise((resolve) => setTimeout(resolve, Math.min(composingDelay, 2000)));

        const sendResponse = await fetch(
          `${evolutionUrl}/message/sendText/${instance.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({ number: item.phone, text: aiMessage }),
          },
        );

        if (!sendResponse.ok) {
          console.error("Send failed:", await sendResponse.text());
          continue;
        }

        console.log(`[support-followup] sent to ${item.phone} (step ${item.current_step}, day ${currentDay})`);

        // Persiste mensagem na conversa
        const followupMessage = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: true,
          content: aiMessage,
          type: "text",
          sent_by: "followup_ai",
        };
        const updatedMessages = [...messages, followupMessage];

        await supabase
          .from("system_whatsapp_conversations")
          .update({
            messages: updatedMessages,
            last_message_at: new Date().toISOString(),
            total_messages: updatedMessages.length,
          })
          .eq("phone", item.phone);

        // Próximo step
        const nextStep = item.current_step + 1;
        const nextDay = Math.ceil(nextStep / 2);
        let newStatus = "pending";
        if (nextDay > maxDays) newStatus = "exhausted";

        let nextScheduledAt: string | null = null;
        if (newStatus === "pending") {
          nextScheduledAt = calculateNextSchedule(config, nextStep, isMorning);
        }

        let contextSummary = item.context_summary;
        if (!contextSummary && item.current_step === 1) {
          contextSummary = `Última conversa sobre: ${lastMessages
            .filter((m: any) => !m.from_me)
            .slice(-3)
            .map((m: any) => m.content?.slice(0, 50))
            .join(" | ")}`;
        }

        await supabase
          .from("system_followup_tracking")
          .update({
            current_step: nextStep,
            last_sent_at: new Date().toISOString(),
            next_scheduled_at: nextScheduledAt,
            status: newStatus,
            context_summary: contextSummary,
            engagement_data: {
              ...engagementData,
              last_hook: hookKey,
              last_scenario: analysis.scenario,
              used_hooks: Array.from(new Set([...usedHooks, hookKey])),
            },
          })
          .eq("id", item.id);

        processed++;
      } catch (itemError) {
        console.error(`Error processing follow-up for ${item.phone}:`, itemError);
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("system-followup-ai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function calculateNextSchedule(config: any, nextStep: number, currentIsMorning: boolean): string {
  const isNextMorning = nextStep % 2 === 1;
  const windowStart = isNextMorning ? config.morning_window_start : config.evening_window_start;
  const windowEnd = isNextMorning ? config.morning_window_end : config.evening_window_end;

  const nextDate = new Date();
  if (!currentIsMorning) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  const [startH, startM] = (windowStart || "08:00").split(":").map(Number);
  const [endH, endM] = (windowEnd || "19:00").split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const range = Math.max(endMinutes - startMinutes, 1);
  const randomMinutes = startMinutes + Math.floor(Math.random() * range);

  nextDate.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);

  if (nextDate.getTime() < Date.now()) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate.toISOString();
}