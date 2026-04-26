import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
- Nome bruto do contato: "${rawContactName || "(vazio)"}"
- Nome sanitizado: "${sanitized || "(inválido)"}"
- Padrão de silêncio: ${silencePattern}
- Última mensagem do cliente: "${lastClientSnippet || "(nunca respondeu)"}"
- Dia atual: ${currentDay} de ${maxDays}

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
            enum: ["confirmacao_de_leitura", "rotulo_voss", "pergunta_calibrada", "coerencia_cialdini", "prova_social", "reciprocidade", "escassez", "pergunta_de_saida"],
          },
          reasoning: { type: "string" },
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

        const rawContactName = conversation.contact_name || null;

        const analysis = await analyzeConversation(
          geminiKey,
          contextText,
          rawContactName,
          silencePattern,
          lastClientSnippet,
          currentDay,
          maxDays,
        );

        if (!analysis) continue;

        let hookKey = analysis.recommended_hook;
        if (hookKey === "escassez" && currentDay < 5) hookKey = "coerencia_cialdini";
        if (hookKey === "pergunta_de_saida" && currentDay < maxDays) hookKey = "rotulo_voss";
        const hook = HOOK_LIBRARY[hookKey] || HOOK_LIBRARY.pergunta_calibrada;

        const nameForGreeting = analysis.name_is_valid && analysis.sanitized_name
          ? analysis.sanitized_name
          : null;

        const generationPrompt = `Você é ${agentName}, um consultor humano experiente do time de suporte/vendas reativando um lead por WhatsApp. Use técnicas de Cialdini ("As Armas da Persuasão") e Chris Voss ("Never Split the Difference").

ANÁLISE DA CONVERSA (FATOS — use exatamente isso):
- Item oferecido: ${analysis.offered_item}
- O que o cliente precisa fazer: ${analysis.pending_object}
- Último ponto em aberto: ${analysis.last_open_point || "(nenhum)"}
- Temperatura do lead: ${analysis.lead_temperature}
- Padrão de silêncio: ${silencePattern}
- Dia atual: ${currentDay} de ${maxDays} | Tentativa: ${item.current_step}
${nameForGreeting ? `- Nome do cliente (validado): ${nameForGreeting}` : `- Nome do cliente: INVÁLIDO/AUSENTE — NÃO use nome, use saudação neutra ("Oi!", "E aí!")`}
${currentDay >= 5 && bargainingTools ? `- Armas de negociação disponíveis: ${bargainingTools}` : ""}

GANCHO DE PERSUASÃO ESCOLHIDO: ${hook.name}
Como aplicar: ${hook.instruction}
Exemplo do estilo: "${hook.example}"

CONTEXTO DA CONVERSA (apenas referência — não copie):
${contextText || "(sem histórico)"}

REGRAS OBRIGATÓRIAS — quebrar = mensagem rejeitada:
1. ❌ PROIBIDO começar com "Olá, tudo bem?", "Oi, tudo bem?" sozinho
2. ❌ PROIBIDO usar "Como você está?" como pergunta principal
3. ❌ PROIBIDO usar nomes inválidos
4. ❌ PROIBIDO mencionar que é IA, automático ou follow-up
5. ❌ PROIBIDO oferecer desconto/promoção antes do dia 5
6. ✅ A mensagem DEVE referenciar concretamente "${analysis.offered_item}" ou "${analysis.last_open_point || analysis.pending_object}"
7. ✅ A mensagem DEVE terminar com UMA pergunta específica ligada ao gancho
8. ✅ Máximo 2-3 linhas, estilo WhatsApp natural
9. ✅ Máximo 1 emoji (opcional)
10. ✅ Tom humano e espontâneo, como amigo profissional

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
          const candidate = geminiData.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text && !p.thoughtSignature)
            ?.map((p: any) => p.text)
            ?.join("")
            ?.trim()
            ?.replace(/^["'`]+|["'`]+$/g, "");

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