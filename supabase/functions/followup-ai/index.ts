import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max items to process per invocation to avoid timeout (each takes ~5-8s with composing)
const MAX_ITEMS_PER_RUN = 5;

// ─── Sanitização de nome ──────────────────────────────────────────────
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

// ─── Biblioteca de ganchos de persuasão ───────────────────────────────
const HOOK_LIBRARY: Record<string, { name: string; instruction: string; example: string }> = {
  confirmacao_de_leitura: {
    name: "Confirmação de Leitura",
    instruction: "O cliente recebeu material/link/proposta concreta. Pergunte de forma leve se conseguiu olhar/avaliar — referenciando EXATAMENTE o que foi enviado.",
    example: "Conseguiu dar uma olhadinha no link da calculadora que te mandei? Se quiser, faço a simulação aqui com você.",
  },
  rotulo_voss: {
    name: "Rótulo (Chris Voss)",
    instruction: "Nomeie a possível objeção/sentimento do cliente sem cobrá-lo. Use 'parece que...', 'imagino que...'. Reduz resistência.",
    example: "Parece que algo te fez pausar essa decisão... posso ajudar a clarear alguma dúvida?",
  },
  pergunta_calibrada: {
    name: "Pergunta Calibrada (Chris Voss)",
    instruction: "Pergunta com 'como' ou 'o que' que faz o cliente refletir sobre o resultado desejado. Nunca sim/não genérico.",
    example: "Como seria pra você se conseguíssemos resolver [problema específico] essa semana?",
  },
  coerencia_cialdini: {
    name: "Coerência (Cialdini)",
    instruction: "Relembre algo que o cliente JÁ DISSE querer/precisar. Cite literalmente. Aciona o gatilho de manter consistência.",
    example: "Você comentou que precisava resolver [X] — isso ainda faz sentido pra você?",
  },
  prova_social: {
    name: "Prova Social (Cialdini)",
    instruction: "Mencione resultado de outros clientes parecidos (sem nomes). Útil quando há objeção implícita.",
    example: "Outros clientes do mesmo perfil que o seu conseguiram [resultado] em poucos dias — vale a pena tentar?",
  },
  reciprocidade: {
    name: "Reciprocidade (Cialdini)",
    instruction: "Ofereça algo de valor sem pedir nada em troca: dica, material, análise gratuita. Cria obrigação social leve.",
    example: "Separei uma dica rápida que pode te ajudar com [tema] — quer que eu te mande?",
  },
  escassez: {
    name: "Escassez Real",
    instruction: "USE APENAS NOS DIAS 5-6. Crie urgência REAL com prazo/condição que de fato muda. Nada de escassez falsa.",
    example: "Essa condição vale até [prazo], depois entra a tabela cheia. Quer que eu garanta pra você?",
  },
  pergunta_de_saida: {
    name: "Pergunta de Saída",
    instruction: "USE APENAS NO ÚLTIMO DIA. Encerramento elegante que dá ao cliente a opção de fechar a porta com dignidade — muitas vezes ele reabre.",
    example: "Faz sentido a gente pausar por aqui, ou ainda quer seguir adiante?",
  },
};

// ─── Validação anti-genérico ──────────────────────────────────────────
function isGenericGreeting(msg: string): boolean {
  const cleaned = msg.toLowerCase().trim().replace(/[!.?,]/g, "").replace(/\s+/g, " ");
  const patterns = [
    /^(olá|oi|ola|opa|e[ai])\s+(tudo bem|tudo certo|td bem|td certo|como (você |voce )?(vai|está|esta|tá|ta))\s*$/,
    /^(olá|oi|ola|opa)\s+\w{1,15}\s+(tudo bem|td bem|tudo certo)\s*$/,
    /^(olá|oi|ola)\s*$/,
  ];
  return patterns.some((rx) => rx.test(cleaned));
}

// ─── Etapa A: Análise estruturada da conversa ─────────────────────────
interface ConversationAnalysis {
  offered_item: string;
  pending_object: string;
  lead_temperature: "frio" | "morno" | "quente";
  last_open_point: string;
  name_is_valid: boolean;
  sanitized_name: string | null;
  recommended_hook: string;
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
): Promise<ConversationAnalysis | null> {
  const sanitized = sanitizeContactName(rawContactName);

  const analysisPrompt = `Você é um analista de vendas. Analise a conversa abaixo e extraia informações estruturadas para gerar uma mensagem de follow-up de alta conversão.

CONVERSA:
${contextText || "(sem histórico relevante)"}

METADADOS:
- Nome bruto do contato no WhatsApp: "${rawContactName || "(vazio)"}"
- Nome sanitizado pelo sistema: "${sanitized || "(inválido)"}"
- Padrão de silêncio: ${silencePattern}
- Última mensagem do cliente: "${lastClientSnippet || "(nunca respondeu)"}"
- Dia atual do follow-up: ${currentDay} de ${maxDays}

Retorne via tool call um JSON estruturado. Seja FACTUAL — extraia informações REAIS da conversa, não invente.`;

  const tool = {
    function_declarations: [{
      name: "registrar_analise",
      description: "Registra a análise estruturada da conversa.",
      parameters: {
        type: "object",
        properties: {
          offered_item: { type: "string", description: "O que foi concretamente oferecido/enviado pelo atendente. Ex: 'link da calculadora', 'proposta', 'agendamento'. Se nada, retorne 'nenhum item específico'." },
          pending_object: { type: "string", description: "O que o cliente precisa fazer/avaliar/responder, baseado na conversa." },
          lead_temperature: { type: "string", enum: ["frio", "morno", "quente"] },
          last_open_point: { type: "string", description: "Último assunto/dúvida em aberto, citando algo da conversa." },
          name_is_valid: { type: "boolean", description: "true se o nome sanitizado é nome humano real; false se placeholder/lixo." },
          sanitized_name: { type: "string", description: "Nome sanitizado a usar (string vazia se inválido)." },
          recommended_hook: {
            type: "string",
            enum: ["confirmacao_de_leitura", "rotulo_voss", "pergunta_calibrada", "coerencia_cialdini", "prova_social", "reciprocidade", "escassez", "pergunta_de_saida"],
            description: "Gancho mais adequado. 'escassez' só dias 5-6. 'pergunta_de_saida' só último dia."
          },
          reasoning: { type: "string", description: "Justificativa curta (1-2 frases)." },
        },
        required: ["offered_item", "pending_object", "lead_temperature", "last_open_point", "name_is_valid", "sanitized_name", "recommended_hook", "reasoning"],
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
  if (!fnCall?.args) {
    console.error("Analysis: no functionCall in response");
    return null;
  }
  const args = fnCall.args;
  return {
    offered_item: args.offered_item || "nenhum item específico",
    pending_object: args.pending_object || "retomar a conversa",
    lead_temperature: args.lead_temperature || "frio",
    last_open_point: args.last_open_point || "",
    name_is_valid: args.name_is_valid === true,
    sanitized_name: args.name_is_valid ? (args.sanitized_name || sanitized) : null,
    recommended_hook: args.recommended_hook || "pergunta_calibrada",
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

    // Fetch pending follow-ups that are due (limited to avoid timeout)
    const { data: pendingItems, error: fetchError } = await supabase
      .from("followup_tracking")
      .select("*")
      .eq("status", "pending")
      .lte("next_scheduled_at", new Date().toISOString())
      .order("next_scheduled_at", { ascending: true })
      .limit(MAX_ITEMS_PER_RUN);

    if (fetchError) {
      console.error("Error fetching pending follow-ups:", fetchError);
      throw fetchError;
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log("No pending follow-ups to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pendingItems.length} follow-ups (max ${MAX_ITEMS_PER_RUN})`);
    let processed = 0;

    for (const item of pendingItems) {
      try {
        // Re-check status to avoid race conditions (client might have responded between fetch and now)
        const { data: freshItem } = await supabase
          .from("followup_tracking")
          .select("status")
          .eq("id", item.id)
          .single();

        if (!freshItem || freshItem.status !== "pending") {
          console.log(`Skipping ${item.phone}: status changed to ${freshItem?.status}`);
          continue;
        }

        // Check 3h minimum interval
        if (item.last_sent_at) {
          const lastSent = new Date(item.last_sent_at).getTime();
          const threeHoursMs = 3 * 60 * 60 * 1000;
          if (Date.now() - lastSent < threeHoursMs) {
            console.log(`Skipping ${item.phone}: 3h interval not met`);
            continue;
          }
        }

        // Load user's followup config
        const { data: config } = await supabase
          .from("followup_config")
          .select("*")
          .eq("user_id", item.user_id)
          .maybeSingle();

        if (!config || !config.enabled) {
          console.log(`Follow-up disabled for user ${item.user_id}, marking declined`);
          await supabase
            .from("followup_tracking")
            .update({ status: "declined" })
            .eq("id", item.id);
          continue;
        }

        // Load conversation history
        const { data: conversation } = await supabase
          .from("whatsapp_conversations")
          .select("messages, contact_name, ai_active")
          .eq("user_id", item.user_id)
          .eq("phone", item.phone)
          .maybeSingle();

        if (!conversation) {
          console.log(`No conversation found for ${item.phone}, marking declined`);
          await supabase
            .from("followup_tracking")
            .update({ status: "declined" })
            .eq("id", item.id);
          continue;
        }

        // Check if conversation was handed off and exclude_handoff is true
        if (config.exclude_handoff && !conversation.ai_active) {
          console.log(`Skipping ${item.phone}: handoff excluded`);
          await supabase
            .from("followup_tracking")
            .update({ status: "declined" })
            .eq("id", item.id);
          continue;
        }

        // Load user's AI config for agent name
        const { data: aiConfig } = await supabase
          .from("whatsapp_ai_config")
          .select("agent_name, custom_prompt")
          .eq("user_id", item.user_id)
          .maybeSingle();

        // Calculate current day (step 1-2 = day 1, step 3-4 = day 2, etc.)
        const currentDay = Math.ceil(item.current_step / 2);
        const isMorning = item.current_step % 2 === 1;
        const maxDays = config.max_days || 6;

        if (currentDay > maxDays) {
          await supabase
            .from("followup_tracking")
            .update({ status: "exhausted", updated_at: new Date().toISOString() })
            .eq("id", item.id);
          console.log(`Follow-up exhausted for ${item.phone}`);
          continue;
        }

        // Extract last messages for context
        const messages = (conversation.messages as any[]) || [];
        const lastMessages = messages.slice(-10);
        const contextText = lastMessages
          .map((m: any) => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
          .join("\n");

        // Detect engagement pattern: did the lead EVER reply?
        // Ignore follow-up messages when judging "client ever responded"
        const clientHasEverReplied = messages.some((m: any) => !m.from_me);
        const lastClientMsg = [...messages].reverse().find((m: any) => !m.from_me);
        const lastClientSnippet = lastClientMsg?.content?.slice(0, 120) || "";
        const silencePattern = clientHasEverReplied ? "DROPPED_OFF" : "NEVER_REPLIED";

        // Build persuasion prompt based on day
        const agentName = aiConfig?.agent_name || "Assistente";
        const contactName = conversation.contact_name || "cliente";
        
        let persuasionStrategy = "";
        if (currentDay <= 2) {
          persuasionStrategy = `
ESTRATÉGIA: Dias 1-2 — COERÊNCIA E COMPROMISSO (Cialdini)
- Relembre algo que o cliente mencionou querer ou precisar
- Use frases como "Você comentou que...", "Lembro que você mencionou..."
- Faça uma pergunta simples que reative o diálogo
- Tom: Amigável, casual, sem pressão`;
        } else if (currentDay <= 4) {
          persuasionStrategy = `
ESTRATÉGIA: Dias 3-4 — PROVA SOCIAL E RECIPROCIDADE (Cialdini)
- Compartilhe resultados de outros clientes (sem nomes específicos)
- Ofereça um conteúdo de valor grátis ou dica relevante
- Use frases como "Muitos clientes que tinham a mesma dúvida...", "Separei essa informação especialmente para você..."
- Tom: Prestativo, gerando valor sem cobrar nada`;
        } else {
          const bargainingTools = config.bargaining_tools || "condição especial";
          persuasionStrategy = `
ESTRATÉGIA: Dias 5-6 — ESCASSEZ E URGÊNCIA + CARTADA FINAL (Chris Voss + Cialdini)
- É hora de usar as ARMAS DE NEGOCIAÇÃO: ${bargainingTools}
- Use gatilhos de escassez: "Essa condição é válida só até...", "Últimas vagas..."
- Use a técnica do "rótulo" de Chris Voss: "Parece que algo te impediu de seguir..."
- Faça uma oferta concreta e com prazo
- Tom: Direto mas empático, criando senso de urgência real
- IMPORTANTE: Esta é a cartada final, use tudo que tem disponível`;
        }

        const systemPrompt = `Você é ${agentName}, um especialista em reativação de leads por WhatsApp.

CONTEXTO DA CONVERSA ANTERIOR:
${contextText}

${item.context_summary ? `RESUMO DO CONTEXTO: ${item.context_summary}` : ""}

NOME DO CLIENTE: ${contactName}
DIA DO FOLLOW-UP: ${currentDay} de ${maxDays}
TURNO: ${isMorning ? "Manhã" : "Tarde"}
TENTATIVA: ${item.current_step} de ${maxDays * 2}

PADRÃO DE SILÊNCIO DETECTADO: ${silencePattern}
${silencePattern === "NEVER_REPLIED" ? `
⚠️ ATENÇÃO: Este lead NUNCA respondeu nenhuma mensagem. Ele recebeu o pitch/abordagem inicial e ficou em silêncio total.
ESTRATÉGIA OBRIGATÓRIA PARA "NUNCA RESPONDEU":
- NÃO repita a oferta nem reforce argumentos de venda — isso espanta ainda mais
- Tom 100% leve, humano, quase casual — como se fosse um amigo curioso, não vendedor
- Faça UMA pergunta MUITO simples, fechada e fácil de responder (de preferência de 1 palavra ou sim/não)
- Reconheça implicitamente o silêncio sem cobrar ("vi que ainda não rolou de a gente conversar...", "imagino que você esteja na correria...")
- Dê opção ao lead de escolher o canal/formato de resposta para reduzir atrito
- Exemplos de boas perguntas: "Faz mais sentido conversarmos por aqui ou prefere uma call rápida?", "Posso te mandar agora ou prefere depois?", "Ainda faz sentido pra você?"
- NUNCA mande mensagem longa — máximo 2 linhas` : `
✅ Este lead JÁ respondeu antes e parou no meio da conversa.
ÚLTIMA MENSAGEM DO CLIENTE: "${lastClientSnippet}"
ESTRATÉGIA OBRIGATÓRIA PARA "SUMIU NO MEIO":
- Retome o FIO da conversa explicitamente — referencie o último ponto que ele tocou
- Use frases como "Você tinha comentado sobre...", "Ficou aquela dúvida sobre...", "Conseguiu pensar sobre o que conversamos?"
- Pergunta-gancho específica relacionada ao que ele disse, não genérica`}

${persuasionStrategy}

REGRAS OBRIGATÓRIAS:
1. Mensagem CURTA (máximo 3 linhas, estilo WhatsApp)
2. NUNCA mencione que é uma IA ou follow-up automático
3. Pareça uma mensagem natural e espontânea
4. Use o nome do cliente se disponível
5. Personalize baseado no contexto da conversa anterior
6. NÃO use emojis em excesso (máximo 1-2)
7. ${currentDay < 5 ? "NÃO ofereça descontos ou promoções ainda — isso é reservado para os últimos dias" : "Pode usar as armas de negociação disponíveis"}
8. Baseie-se nos livros "As Armas da Persuasão" (Cialdini) e "Never Split the Difference" (Chris Voss)
9. OBRIGATÓRIO: a mensagem DEVE terminar com UMA pergunta clara e fácil de responder (gancho de engajamento). Sem pergunta = mensagem ruim.

Responda APENAS com a mensagem a ser enviada, sem explicações.`;

        // Call Gemini
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
              generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 200,
              },
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errText = await geminiResponse.text();
          console.error("Gemini error:", errText);
          // On rate limit, skip this item - it'll be retried next run
          if (geminiResponse.status === 429) {
            console.log("Gemini rate limited, stopping batch");
            break;
          }
          continue;
        }

        const geminiData = await geminiResponse.json();
        const aiMessage = geminiData.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text && !p.thoughtSignature)
          ?.map((p: any) => p.text)
          ?.join("")
          ?.trim();

        if (!aiMessage) {
          console.error("No AI message generated for", item.phone);
          continue;
        }

        // Get WhatsApp instance for this user
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("instance_name, status")
          .eq("user_id", item.user_id)
          .maybeSingle();

        if (!instance || instance.status !== "connected") {
          console.log(`WhatsApp not connected for user ${item.user_id}`);
          continue;
        }

        // Simulate composing (typing indicator) — fire-and-forget, don't await
        const composingDelay = 2000 + Math.random() * 2000; // 2-4 seconds
        fetch(`${evolutionUrl}/chat/presence/${instance.instance_name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            number: item.phone,
            delay: Math.floor(composingDelay),
            presence: "composing",
          }),
        }).catch((e) => console.error("Composing simulation failed:", e));

        // Short delay to let composing indicator show (but not full duration)
        await new Promise((resolve) => setTimeout(resolve, Math.min(composingDelay, 2000)));

        // Send message via Evolution API
        const sendResponse = await fetch(
          `${evolutionUrl}/message/sendText/${instance.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({
              number: item.phone,
              text: aiMessage,
            }),
          }
        );

        if (!sendResponse.ok) {
          const errText = await sendResponse.text();
          console.error("Send message failed:", errText);
          continue;
        }

        console.log(`Follow-up sent to ${item.phone} (step ${item.current_step}, day ${currentDay})`);

        // Save the sent message in the conversation
        const existingMessages = (conversation.messages as any[]) || [];
        const followupMessage = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          from_me: true,
          content: aiMessage,
          type: "text",
          sent_by: "followup_ai",
        };
        const updatedMessages = [...existingMessages, followupMessage];

        await supabase
          .from("whatsapp_conversations")
          .update({
            messages: updatedMessages,
            last_message_at: new Date().toISOString(),
            total_messages: updatedMessages.length,
          })
          .eq("user_id", item.user_id)
          .eq("phone", item.phone);

        // Calculate next scheduled time
        const nextStep = item.current_step + 1;
        const nextDay = Math.ceil(nextStep / 2);
        let newStatus = "pending";

        if (nextDay > maxDays) {
          newStatus = "exhausted";
        }

        let nextScheduledAt: string | null = null;
        if (newStatus === "pending") {
          nextScheduledAt = calculateNextSchedule(config, nextStep, isMorning);
        }

        // Generate context summary on first step
        let contextSummary = item.context_summary;
        if (!contextSummary && item.current_step === 1) {
          contextSummary = `Última conversa sobre: ${lastMessages
            .filter((m: any) => !m.from_me)
            .slice(-3)
            .map((m: any) => m.content?.slice(0, 50))
            .join(" | ")}`;
        }

        await supabase
          .from("followup_tracking")
          .update({
            current_step: nextStep,
            last_sent_at: new Date().toISOString(),
            next_scheduled_at: nextScheduledAt,
            status: newStatus,
            context_summary: contextSummary,
            updated_at: new Date().toISOString(),
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
    console.error("Follow-up AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextSchedule(config: any, nextStep: number, currentIsMorning: boolean): string {
  const isNextMorning = nextStep % 2 === 1;
  const windowStart = isNextMorning ? config.morning_window_start : config.evening_window_start;
  const windowEnd = isNextMorning ? config.morning_window_end : config.evening_window_end;

  const nextDate = new Date();

  // If current step was afternoon, next (morning) is tomorrow
  // If current step was morning, next (afternoon) is today
  if (!currentIsMorning) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  const [startH, startM] = (windowStart || "08:00").split(":").map(Number);
  const [endH, endM] = (windowEnd || "19:00").split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Ensure we have a valid range
  const range = Math.max(endMinutes - startMinutes, 1);
  const randomMinutes = startMinutes + Math.floor(Math.random() * range);

  nextDate.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);

  // Safety: if scheduled in the past, push to tomorrow
  if (nextDate.getTime() < Date.now()) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate.toISOString();
}
