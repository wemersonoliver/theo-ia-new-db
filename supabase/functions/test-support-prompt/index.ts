import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify caller is super_admin
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

    const { messages, userMessage } = await req.json();

    // Load system AI config to get the admin's extra prompt + agent name
    const { data: sysConfig } = await supabaseAdmin
      .from("system_ai_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    const customPrompt = sysConfig?.custom_prompt || "";
    const agentName = sysConfig?.agent_name || "Theo";

    // Mirror exactly what support-ai-agent uses (kept here for sandbox simulation)
    const SYSTEM_PROMPT = `Você é o ${agentName}, Agente de Suporte e Consultor Comercial da Theo IA.\n\nEsta é uma SIMULAÇÃO DE TESTE feita por um administrador para validar o comportamento da IA de suporte. Responda exatamente como faria em uma conversa real via WhatsApp com um cliente ou potencial cliente.\n\n## REGRAS DE FORMATO\n- Mensagens curtas (2-3 linhas), separe blocos com quebras duplas.\n- Linguagem natural, conversacional, em português brasileiro.\n- Nunca use código, sintaxe Python ou function calls em texto.\n- Apresente-se como ${agentName} na primeira mensagem e pergunte o nome do cliente antes de prosseguir.\n- Personalize pelo segmento/negócio do cliente quando descobrir.\n\nA Theo IA é uma plataforma SaaS de atendimento via WhatsApp com IA (Google Gemini), agendamentos, CRM, follow-up automático, base de conhecimento, equipe colaborativa e voz ElevenLabs opcional. Acesso em https://theoia.com.br.\n\nNESTA SIMULAÇÃO: NÃO crie tickets, agendamentos ou registros reais — apenas responda em texto como faria.`;

    const fullPrompt = customPrompt
      ? `${SYSTEM_PROMPT}\n\n## Instruções Adicionais do Administrador\n\n${customPrompt}`
      : SYSTEM_PROMPT;

    // Usa systemInstruction (campo nativo do Gemini) para garantir que a persona
    // seja respeitada em todos os turnos, evitando alucinações de persona quando
    // o histórico cresce.
    const geminiContents: any[] = [];

    for (const msg of (messages || [])) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    if (userMessage) {
      geminiContents.push({ role: "user", parts: [{ text: userMessage }] });
    }

    const geminiRes = await fetchGeminiWithRetry(geminiApiKey, {
      contents: geminiContents,
      systemInstruction: { role: "system", parts: [{ text: fullPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const textParts = candidate?.content?.parts?.filter((p: any) => p.text !== undefined) || [];
    const aiReply = textParts.map((p: any) => p.text).join("") ||
      "Desculpe, não consegui processar sua solicitação. Pode tentar novamente?";

    return new Response(JSON.stringify({ message: aiReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("test-support-prompt error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});