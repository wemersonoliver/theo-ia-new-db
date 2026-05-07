import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateScheduleSequence } from "../_followup-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_LEADS_PER_RUN = 4;
const TOTAL_STEPS = 12;

function sanitizeContactName(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const name = rawName.trim();
  if (name.length < 3 || /^\d+$/.test(name)) return null;
  const blacklist = ["user", "usuario", "cliente", "whatsapp", "test", "teste", "lead"];
  if (blacklist.includes(name.toLowerCase())) return null;
  const firstWord = name.split(/\s+/)[0];
  if (firstWord.length < 3) return null;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

interface SequenceMessage { step: number; hook: string; content: string; }

async function generateSequence(
  geminiKey: string,
  contextText: string,
  contactName: string | null,
  agentName: string,
  bargainingTools: string,
  business: { name: string | null; segment: string | null; summary: string | null } | null,
): Promise<SequenceMessage[] | null> {
  const personalized = !!(business && (business.name || business.segment || business.summary));
  const businessBlock = personalized
    ? `\nNEGÓCIO DO CLIENTE:\n- Empresa: ${business!.name || "(não informada)"}\n- Segmento: ${business!.segment || "(não informado)"}\n- Resumo: ${business!.summary || "(sem resumo)"}\n\nPERSONALIZAÇÃO OBRIGATÓRIA:\n- Cite o nicho/empresa em pelo menos 4 das 12 mensagens.\n- Use dores REAIS do segmento (ex.: estética → no-show, agenda lotada; loja → carrinho abandonado).\n- Conecte cada hook narrativo (dor, prova social, escassez) ao contexto do negócio dele.\n`
    : "";
  const prompt = `Você é especialista em vendas. Gere SEQUÊNCIA NARRATIVA de ${TOTAL_STEPS} mensagens de follow-up (manhã/tarde × 6 dias) para reativar lead inativo no WhatsApp do suporte da plataforma Theo IA.

CONVERSA ANTERIOR:
${contextText || "(sem histórico — cliente nunca respondeu)"}
${businessBlock}
DADOS:
- Atendente IA: ${agentName}
- Cliente: ${contactName || "(nome desconhecido)"}
- Produto: Theo IA — assistente WhatsApp com IA. Teste grátis 15 dias.
${bargainingTools ? `- Ferramentas: ${bargainingTools}` : ""}

ARCO NARRATIVO:
- Step 1-2 (Dia 1): leveza, retomada.
- Step 3-4 (Dia 2): rótulo + coerência.
- Step 5-6 (Dia 3): dor + prova social.
- Step 7-8 (Dia 4): solução + reciprocidade.
- Step 9-10 (Dia 5): escassez real.
- Step 11 (Dia 6 manhã): pergunta forte.
- Step 12 (Dia 6 tarde): pergunta de saída.

REGRAS:
- Máx 220 chars por mensagem.
- Tom humano brasileiro, conversacional.
- Cada mensagem REFERENCIA sutilmente a anterior.
- NUNCA repete gancho consecutivo.
- NUNCA cumprimento genérico isolado.
- Use nome só se válido.

Retorne via tool call EXATAMENTE ${TOTAL_STEPS} mensagens em ordem.`;

  const tool = {
    function_declarations: [{
      name: "registrar_sequencia",
      description: `Registra ${TOTAL_STEPS} mensagens de follow-up.`,
      parameters: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "integer" },
                hook: { type: "string" },
                content: { type: "string" },
              },
              required: ["step", "hook", "content"],
            },
          },
        },
        required: ["messages"],
      },
    }],
  };

  const resp = await fetch(
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

  if (!resp.ok) {
    console.error("Gemini failed:", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
  if (!fnCall?.args?.messages || !Array.isArray(fnCall.args.messages)) return null;
  const messages = (fnCall.args.messages as any[])
    .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
    .map((m, idx) => ({
      step: typeof m.step === "number" ? m.step : idx + 1,
      hook: m.hook || "unknown",
      content: String(m.content).trim().slice(0, 240),
    }));
  if (messages.length < TOTAL_STEPS) return null;
  return messages.slice(0, TOTAL_STEPS);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    const { data: config } = await supabase
      .from("system_followup_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ generated: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: aiConfig } = await supabase
      .from("system_ai_config")
      .select("agent_name")
      .limit(1)
      .maybeSingle();

    const agentName = aiConfig?.agent_name || "Theo";

    const { data: pendings } = await supabase
      .from("system_followup_tracking")
      .select("*")
      .eq("status", "pending")
      .is("sequence_generated_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_LEADS_PER_RUN);

    if (!pendings || pendings.length === 0) {
      return new Response(JSON.stringify({ generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    for (const tracking of pendings) {
      try {
        const { data: conversation } = await supabase
          .from("system_whatsapp_conversations")
          .select("messages, contact_name, ai_active")
          .eq("phone", tracking.phone)
          .maybeSingle();

        if (!conversation) {
          await supabase.from("system_followup_tracking").update({ status: "declined", cancellation_reason: "no_conversation" }).eq("id", tracking.id);
          continue;
        }

        if (config.exclude_handoff && conversation.ai_active === false) {
          await supabase.from("system_followup_tracking").update({ status: "declined", cancellation_reason: "handoff" }).eq("id", tracking.id);
          continue;
        }

        const messages = (conversation.messages as any[]) || [];
        const contextText = messages.slice(-12)
          .map((m: any) => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
          .join("\n");
        const sanitizedName = sanitizeContactName(conversation.contact_name);

        // Look up business data via profiles → admin_crm_deals
        let business: { name: string | null; segment: string | null; summary: string | null } | null = null;
        try {
          const digits = tracking.phone.replace(/\D/g, "");
          const candidates = new Set<string>([digits]);
          if (digits.length === 13 && digits.startsWith("55")) candidates.add(digits.slice(2));
          if (digits.length === 12 && digits.startsWith("55")) candidates.add(digits.slice(2));
          if (digits.length === 11) candidates.add(digits.slice(0, 2) + digits.slice(3));
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, phone")
            .in("phone", Array.from(candidates));
          const userId = profiles?.[0]?.user_id;
          if (userId) {
            const { data: deal } = await supabase
              .from("admin_crm_deals")
              .select("business_name, business_segment, business_summary")
              .eq("user_ref_id", userId)
              .maybeSingle();
            if (deal && (deal.business_name || deal.business_segment || deal.business_summary)) {
              business = {
                name: deal.business_name,
                segment: deal.business_segment,
                summary: deal.business_summary,
              };
            }
          }
        } catch (e) {
          console.error("business lookup failed for", tracking.phone, e);
        }

        const seq = await generateSequence(
          geminiKey,
          contextText,
          sanitizedName,
          agentName,
          config.bargaining_tools || "",
          business,
        );
        if (!seq) continue;

        const schedule = generateScheduleSequence(config, TOTAL_STEPS);
        const rows = seq.map((m, idx) => ({
          tracking_id: tracking.id,
          phone: tracking.phone,
          step: m.step || idx + 1,
          hook_used: m.hook,
          content: m.content,
          scheduled_at: schedule[idx],
          status: "scheduled",
        }));

        const { error: insErr } = await supabase.from("system_followup_messages").insert(rows);
        if (insErr) {
          console.error(`Insert failed for ${tracking.phone}:`, insErr);
          continue;
        }

        await supabase.from("system_followup_tracking").update({
          status: "scheduled",
          sequence_generated_at: new Date().toISOString(),
          next_scheduled_at: schedule[0],
          engagement_data: { ...(tracking.engagement_data || {}), personalization: business ? "personalized" : "generic" },
          updated_at: new Date().toISOString(),
        }).eq("id", tracking.id);

        generated++;
        console.log(`[system-followup-gen] sequence created for ${tracking.phone}`);
      } catch (e) {
        console.error(`Error for ${tracking.phone}:`, e);
      }
    }

    return new Response(JSON.stringify({ generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("system-followup-generate-sequence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
