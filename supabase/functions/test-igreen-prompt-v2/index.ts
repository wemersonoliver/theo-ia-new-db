// test-igreen-prompt-v2 — Bridge entre o Simulador de Atendimento (dashboard)
// e o pipeline V2 real (whatsapp-igreen-agent-v2).
//
// Para contas iGreen, o simulador NÃO pode mais usar o caminho V1
// (test-ai-prompt + _igreen_flow.ts) porque o WhatsApp real roda no V2
// (supervisor + specialists + qualifier + tools + RAG + guardrails).
//
// Esta função:
//   1. Autentica o usuário via JWT.
//   2. Resolve o account_id do usuário e bloqueia contas não-iGreen.
//   3. Usa um "phone" sintético (sim<userId>) namespaced para não conflitar
//      com clientes reais — state, memory e conversation history ficam isolados.
//   4. Se body.reset = true, limpa o state/memory/conversation do sandbox.
//   5. Invoca whatsapp-igreen-agent-v2 com { sandbox: true }, que força
//      dryRun no transporte (não envia para o WhatsApp) e pula automations
//      (não dispara notificações, CRM, follow-ups).
//   6. Devolve para o frontend a resposta gerada + debug (specialist/intent).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";
import { buildAgentSystemPrompt, buildCalendarBlock } from "../_ai_system_prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Phone sintético determinístico por usuário. Mantém a sessão estável entre
 * chamadas (state/memory persistem até o usuário clicar "Reiniciar"), e fica
 * em um namespace que nunca colide com números reais (começa com "sim").
 */
function buildSandboxPhone(userId: string): string {
  const compact = userId.replace(/-/g, "").slice(0, 16);
  return `sim${compact}`;
}

/** Limpa state/memory/conversation do sandbox para começar uma nova simulação. */
async function resetSandbox(
  service: ReturnType<typeof createClient>,
  accountId: string,
  phone: string,
): Promise<void> {
  const tables = [
    "igreen_conversation_state",
    "igreen_memory_window",
    "igreen_memory_summaries",
    "igreen_state_snapshots",
    "whatsapp_conversations",
    "whatsapp_pending_responses",
    "igreen_transport_events",
  ];
  await Promise.all(
    tables.map(async (table) => {
      try {
        await service.from(table).delete().eq("account_id", accountId).eq("phone", phone);
      } catch (e) {
        console.error(`[test-igreen-prompt-v2] reset ${table} error:`, e);
      }
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const accountId = await resolveAccountId(service, userId);
    if (!accountId) {
      return json({ error: "Conta não encontrada para o usuário." }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const userMessage = String(body?.userMessage ?? "").trim();
    const reset = Boolean(body?.reset);
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history)
      ? body.history.filter((m: any) => m && typeof m.content === "string")
      : [];

    if (!userMessage && !reset) {
      return json({ error: "userMessage é obrigatório." }, 400);
    }

    // Verifica se a conta é iGreen. Se não for, roda simulador genérico
    // (chamada stateless ao Gemini com o custom_prompt do usuário).
    const { data: accountRow } = await service
      .from("accounts")
      .select("is_igreen")
      .eq("id", accountId)
      .maybeSingle();

    if (!accountRow?.is_igreen) {
      if (reset && !userMessage) return json({ ok: true, reset: true });
      return await runGenericSimulator({ service, userId, userMessage, history });
    }

    const phone = buildSandboxPhone(userId);

    if (reset) {
      await resetSandbox(service, accountId, phone);
      if (!userMessage) {
        return json({ ok: true, reset: true });
      }
    }

    // Invoca a edge function V2 real com sandbox=true.
    const v2Url = `${supabaseUrl}/functions/v1/whatsapp-igreen-agent-v2`;
    const v2Res = await fetch(v2Url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // service-role bypassa verify_jwt e RLS.
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        account_id: accountId,
        phone,
        message: userMessage,
        sandbox: true,
      }),
    });

    const v2Data = await v2Res.json().catch(() => ({} as any));

    if (!v2Res.ok) {
      console.error("[test-igreen-prompt-v2] v2 error:", v2Res.status, v2Data);
      return json(
        {
          error: "v2_failed",
          status: v2Res.status,
          details: v2Data,
        },
        502,
      );
    }

    const messages: string[] = Array.isArray(v2Data?.messages) ? v2Data.messages : [];
    // Fast-path bypass não preenche `messages`; nesse caso retornamos o motivo
    // para que o simulador mostre algo coerente em vez de uma string vazia.
    let message = messages.join("\n\n").trim();
    if (!message && v2Data?.fast_path?.bypass) {
      message = `[fast-path] ${v2Data.fast_path.action ?? "bypass"} — ${v2Data.fast_path.reason ?? ""}`;
    }
    if (!message) {
      message = "(o agente V2 não devolveu mensagem neste turno)";
    }

    return json({
      message,
      debug: {
        pipeline: "igreen-v2",
        sandbox_phone: phone,
        specialist: v2Data?.specialist ?? null,
        intent: v2Data?.supervisor?.intent ?? null,
        confidence: v2Data?.supervisor?.confidence ?? null,
        fast_path: v2Data?.fast_path ?? null,
        tool_results: Array.isArray(v2Data?.tool_results)
          ? v2Data.tool_results.map((t: any) => ({ name: t?.name, ok: t?.ok ?? t?.success ?? null }))
          : [],
        correlation_id: v2Data?.correlation_id ?? null,
      },
    });
  } catch (e) {
    console.error("[test-igreen-prompt-v2] fatal:", e);
    return json({ error: (e as Error)?.message ?? "unknown_error" }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Simulador genérico (contas não-iGreen) — stateless, usa custom_prompt.
// ─────────────────────────────────────────────────────────────────────────────
async function runGenericSimulator(args: {
  service: ReturnType<typeof createClient>;
  userId: string;
  userMessage: string;
  history: Array<{ role: string; content: string }>;
}): Promise<Response> {
  const { service, userId, userMessage, history } = args;
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_GEMINI_API_KEY não configurado" }, 500);

  // Carrega a config completa do agente (mesmos campos usados em produção).
  const { data: aiConfig } = await service
    .from("whatsapp_ai_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Carrega base de conhecimento (texto completo de todos os docs do usuário).
  let knowledgeBase = "";
  try {
    const { data: docs } = await service
      .from("knowledge_base_documents")
      .select("title, content, product_name")
      .eq("user_id", userId)
      .eq("status", "processed")
      .limit(20);
    if (Array.isArray(docs) && docs.length) {
      knowledgeBase = docs
        .map((d: any) => {
          const tag = d?.product_name ? `[PRODUTO: ${d.product_name}]` : "[GERAL]";
          return `${tag} ${d?.title || ""}\n${(d?.content || "").slice(0, 4000)}`;
        })
        .join("\n\n---\n\n");
    }
  } catch (e) {
    console.error("[test-igreen-prompt-v2] knowledge load error:", e);
  }

  // Hora BRT (UTC-3) para saudação/calendário.
  const nowUtc = new Date();
  const brt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mm = String(brt.getUTCMinutes()).padStart(2, "0");
  const brtTime = `${hh}:${mm}`;
  const hour = brt.getUTCHours();
  const brtGreeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const todayLocal = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
  const ymd = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;
  const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const weekdays = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const todayFormatted = `${weekdays[todayLocal.getDay()]}, ${todayLocal.getDate()} de ${months[todayLocal.getMonth()]} de ${todayLocal.getFullYear()}`;

  const systemPrompt = buildAgentSystemPrompt({
    aiConfig: aiConfig || {},
    knowledgeBase,
    productsCatalog: "",
    returningClientContext: "",
    departmentsBlock: "",
    existingAppointmentsContext: "",
    pendingConfirmationContext: "",
    todayStr: ymd,
    todayFormatted,
    brtTime,
    brtGreeting,
    calendarBlock: buildCalendarBlock(todayLocal),
  }) + "\n\n[MODO SIMULAÇÃO] Esta conversa é um teste do dashboard — não há cliente real, nem ferramentas reais (agendamento, handoff, localização). Responda como responderia ao cliente real, mas não chame tools.";

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[test-igreen-prompt-v2] gemini error:", res.status, data);
      return json({ error: `Gemini retornou ${res.status}`, details: data }, 502);
    }
    const message =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n").trim()
      || "(o agente não devolveu resposta neste turno)";
    return json({ message, debug: { pipeline: "generic-v1", model: "gemini-2.5-flash" } });
  } catch (e) {
    console.error("[test-igreen-prompt-v2] generic simulator error:", e);
    return json({ error: (e as Error).message ?? "gemini_failed" }, 500);
  }
}