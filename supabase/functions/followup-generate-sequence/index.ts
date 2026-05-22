import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateScheduleSequence } from "../_followup-window.ts";
import { logTextUsage, extractGeminiTokens } from "../_shared/ai-usage.ts";
import { extractPersonName } from "../_person-name.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_LEADS_PER_RUN = 4;
const TOTAL_STEPS = 6; // 1 mensagem por dia × 6 dias

function sanitizeContactName(rawName: string | null | undefined): string | null {
  const v = extractPersonName(rawName);
  return v ? v.firstName : null;
}

interface SequenceMessage {
  step: number;
  hook: string;
  content: string;
}

async function generateSequence(
  geminiKey: string,
  contextText: string,
  contactName: string | null,
  agentName: string,
  businessNiche: string | null,
  businessDescription: string | null,
  bargainingTools: string,
): Promise<{ messages: SequenceMessage[]; tokens: { input: number; output: number } } | null> {
  const prompt = `Você é um especialista em vendas e copywriting. Gere uma SEQUÊNCIA NARRATIVA de ${TOTAL_STEPS} mensagens de follow-up que devem ser enviadas em ordem (UMA mensagem por dia, durante 6 dias) para reativar um lead inativo no WhatsApp.

CONTEXTO DA CONVERSA ANTERIOR:
${contextText || "(sem histórico relevante — cliente nunca respondeu)"}

DADOS:
- Atendente: ${agentName}
- Cliente: ${contactName || "(nome desconhecido — não use placeholders, use abordagem neutra)"}
${businessNiche ? `- Nicho: ${businessNiche}` : ""}
${businessDescription ? `- Negócio: ${businessDescription}` : ""}
${bargainingTools ? `- Ferramentas de negociação disponíveis: ${bargainingTools}` : ""}

REGRAS OBRIGATÓRIAS DO ARCO NARRATIVO:
- Step 1 (Dia 1): leveza, pergunta calibrada ou confirmação de leitura. Reabra a conversa.
- Step 2 (Dia 2): rótulo Voss + coerência (relembre o que o cliente já disse).
- Step 3 (Dia 3): dor real + prova social (sem nomes).
- Step 4 (Dia 4): solução concreta + reciprocidade (oferecer algo de valor).
- Step 5 (Dia 5): escassez REAL com prazo/condição.
- Step 6 (Dia 6): pergunta de saída elegante (última tentativa + encerramento).

REGRAS DE ESTILO:
- Cada mensagem com no máximo 220 caracteres.
- Tom humano, conversacional, brasileiro. NUNCA pareça robô.
- Cada mensagem deve REFERENCIAR sutilmente a mensagem anterior (continuidade narrativa).
- NUNCA repita o mesmo gancho em mensagens consecutivas.
- NUNCA use cumprimentos genéricos isolados ("Olá, tudo bem?").
- Use o nome do cliente APENAS se válido. Se desconhecido, abordagem neutra.

Retorne via tool call um array com EXATAMENTE ${TOTAL_STEPS} mensagens em ordem.`;

  const tool = {
    function_declarations: [{
      name: "registrar_sequencia",
      description: `Registra a sequência completa de ${TOTAL_STEPS} mensagens de follow-up.`,
      parameters: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            description: `Array com EXATAMENTE ${TOTAL_STEPS} mensagens em ordem narrativa.`,
            items: {
              type: "object",
              properties: {
                step: { type: "integer", description: `Número do step (1-${TOTAL_STEPS})` },
                hook: { type: "string", description: "Nome do gancho usado" },
                content: { type: "string", description: "Texto da mensagem (máx 220 chars)" },
              },
              required: ["step", "hook", "content"],
            },
          },
        },
        required: ["messages"],
      },
    }],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [tool],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_sequencia"] } },
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!response.ok) {
    console.error("Gemini sequence generation failed:", response.status, await response.text());
    return null;
  }

  const data = await response.json();
  const tokens = extractGeminiTokens(data);
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
  if (!fnCall?.args?.messages || !Array.isArray(fnCall.args.messages)) {
    console.error("Sequence: invalid functionCall response");
    return null;
  }

  const messages = (fnCall.args.messages as any[])
    .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
    .map((m, idx) => ({
      step: typeof m.step === "number" ? m.step : idx + 1,
      hook: m.hook || "unknown",
      content: String(m.content).trim().slice(0, 240),
    }));

  if (messages.length < TOTAL_STEPS) {
    console.error(`Sequence: only ${messages.length} messages returned, expected ${TOTAL_STEPS}`);
    return null;
  }

  return { messages: messages.slice(0, TOTAL_STEPS), tokens };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    // Pega trackings pendentes SEM sequência ainda gerada
    const { data: pendings, error } = await supabase
      .from("followup_tracking")
      .select("*")
      .eq("status", "pending")
      .is("sequence_generated_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_LEADS_PER_RUN);

    if (error) throw error;
    if (!pendings || pendings.length === 0) {
      return new Response(JSON.stringify({ generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    const failures: string[] = [];

    for (const tracking of pendings) {
      try {
        // Carrega config + AI config
        const [{ data: config }, { data: aiConfig }, { data: conversation }] = await Promise.all([
          supabase.from("followup_config").select("*").eq("user_id", tracking.user_id).maybeSingle(),
          supabase.from("whatsapp_ai_config").select("agent_name, business_niche, business_description").eq("user_id", tracking.user_id).maybeSingle(),
          supabase.from("whatsapp_conversations").select("messages, contact_name, ai_active").eq("user_id", tracking.user_id).eq("phone", tracking.phone).maybeSingle(),
        ]);

        if (!config || !config.enabled) {
          await supabase.from("followup_tracking").update({ status: "declined", cancellation_reason: "disabled" }).eq("id", tracking.id);
          continue;
        }

        if (!conversation) {
          await supabase.from("followup_tracking").update({ status: "declined", cancellation_reason: "no_conversation" }).eq("id", tracking.id);
          continue;
        }

        if (config.exclude_handoff && conversation.ai_active === false) {
          await supabase.from("followup_tracking").update({ status: "declined", cancellation_reason: "handoff" }).eq("id", tracking.id);
          continue;
        }

        const messages = (conversation.messages as any[]) || [];
        const contextText = messages.slice(-12)
          .map((m: any) => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
          .join("\n");

        const sanitizedName = sanitizeContactName(conversation.contact_name);
        const agentName = aiConfig?.agent_name || "Atendente";

        const result = await generateSequence(
          geminiKey,
          contextText,
          sanitizedName,
          agentName,
          aiConfig?.business_niche || null,
          aiConfig?.business_description || null,
          config.bargaining_tools || "",
        );

        if (!result) {
          failures.push(tracking.phone);
          continue;
        }

        // Loga uso de IA
        if (result.tokens.input || result.tokens.output) {
          await logTextUsage(supabase, {
            userId: tracking.user_id,
            source: "followup-sequence-gen",
            tokensInput: result.tokens.input,
            tokensOutput: result.tokens.output,
            referenceId: tracking.phone,
          });
        }

        // Calcula horários
        const schedule = generateScheduleSequence(config, TOTAL_STEPS);

        // Insere as 12 mensagens
        const rows = result.messages.map((m, idx) => ({
          tracking_id: tracking.id,
          user_id: tracking.user_id,
          account_id: tracking.account_id,
          phone: tracking.phone,
          step: m.step || idx + 1,
          hook_used: m.hook,
          content: m.content,
          scheduled_at: schedule[idx],
          status: "scheduled",
        }));

        const { error: insertError } = await supabase.from("followup_messages").insert(rows);
        if (insertError) {
          console.error(`Insert messages failed for ${tracking.phone}:`, insertError);
          failures.push(tracking.phone);
          continue;
        }

        // Marca tracking como scheduled
        await supabase.from("followup_tracking").update({
          status: "scheduled",
          sequence_generated_at: new Date().toISOString(),
          next_scheduled_at: schedule[0],
          updated_at: new Date().toISOString(),
        }).eq("id", tracking.id);

        generated++;
        console.log(`[followup-gen] sequence created for ${tracking.phone} (${TOTAL_STEPS} msgs)`);
      } catch (e) {
        console.error(`Error generating sequence for ${tracking.phone}:`, e);
        failures.push(tracking.phone);
      }
    }

    return new Response(JSON.stringify({ generated, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("followup-generate-sequence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
