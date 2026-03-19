import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch all pending follow-ups that are due
    const { data: pendingItems, error: fetchError } = await supabase
      .from("followup_tracking")
      .select("*")
      .eq("status", "pending")
      .lte("next_scheduled_at", new Date().toISOString());

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

    console.log(`Processing ${pendingItems.length} follow-ups`);
    let processed = 0;

    for (const item of pendingItems) {
      try {
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
          console.log(`Follow-up disabled for user ${item.user_id}`);
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
          console.log(`No conversation found for ${item.phone}`);
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

        // Load user's AI config for agent name and prompt context
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

Responda APENAS com a mensagem a ser enviada, sem explicações.`;

        // Call Gemini
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
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
          continue;
        }

        const geminiData = await geminiResponse.json();
        const aiMessage = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

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

        // Simulate composing (typing indicator)
        const composingDelay = 2000 + Math.random() * 3000; // 2-5 seconds
        try {
          await fetch(`${evolutionUrl}/chat/presence/${instance.instance_name}`, {
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
          });
        } catch (e) {
          console.error("Composing simulation failed:", e);
        }

        // Wait for composing duration
        await new Promise((resolve) => setTimeout(resolve, composingDelay));

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
        if (conversation) {
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
        }

        // Calculate next scheduled time
        const nextStep = item.current_step + 1;
        const nextDay = Math.ceil(nextStep / 2);
        let newStatus = "pending";

        if (nextDay > maxDays) {
          newStatus = "exhausted";
        }

        let nextScheduledAt: string | null = null;
        if (newStatus === "pending") {
          const isNextMorning = nextStep % 2 === 1;
          const windowStart = isNextMorning ? config.morning_window_start : config.evening_window_start;
          const windowEnd = isNextMorning ? config.morning_window_end : config.evening_window_end;

          // If next step is in the same day (afternoon after morning), schedule today
          // If next step starts a new day, schedule tomorrow
          const nextDate = new Date();
          if (!isMorning) {
            // Current is afternoon, next is tomorrow morning
            nextDate.setDate(nextDate.getDate() + 1);
          }

          // Random time within window
          const [startH, startM] = windowStart.split(":").map(Number);
          const [endH, endM] = windowEnd.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const randomMinutes = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));

          nextDate.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);
          nextScheduledAt = nextDate.toISOString();
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
