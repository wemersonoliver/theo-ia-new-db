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

async function extractAndSaveBusinessData(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  companyName: string,
  segment: string,
  messages: Array<{ role: string; content: string }>,
  generatedPrompt: string | null,
) {
  // Find the support CRM deal for this user
  const { data: deal } = await adminClient
    .from("admin_crm_deals")
    .select("id")
    .eq("user_ref_id", userId)
    .maybeSingle();
  if (!deal) {
    console.log("No admin_crm_deal found for user", userId);
    return;
  }

  // Build a compact transcript for the summarizer
  const transcript = messages
    .slice(-30)
    .map((m) => `${m.role === "assistant" ? "IA" : "Cliente"}: ${m.content}`)
    .join("\n")
    .slice(0, 12000);

  let businessName = (companyName || "").trim() || null;
  let businessSegment = (segment || "").trim() || null;
  let businessSummary: string | null = null;

  if (GEMINI_API_KEY) {
    try {
      const tool = {
        function_declarations: [{
          name: "registrar_negocio",
          description: "Registra dados estruturados do negócio do cliente",
          parameters: {
            type: "object",
            properties: {
              business_name: { type: "string", description: "Nome oficial da empresa" },
              segment: { type: "string", description: "Segmento/nicho de mercado (ex: Estética, Odontologia, E-commerce)" },
              summary: { type: "string", description: "Resumo de 2-4 frases sobre o negócio: o que faz, público-alvo, principais produtos/serviços e dores típicas do segmento que a IA pode tocar." },
            },
            required: ["business_name", "segment", "summary"],
          },
        }],
      };
      const prompt = `Extraia dados do negócio com base na entrevista abaixo.\n\nDados informados:\n- Empresa: ${companyName}\n- Segmento: ${segment}\n\nTrecho da entrevista:\n${transcript}\n\n${generatedPrompt ? `Prompt gerado (referência):\n${generatedPrompt.slice(0, 4000)}\n` : ""}\nGere o resumo em português brasileiro, conciso, focado em DOR e PROPOSTA DE VALOR (para uso em follow-up de vendas).`;

      const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [tool],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_negocio"] } },
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
        const args = fnCall?.args || {};
        if (args.business_name) businessName = String(args.business_name).trim();
        if (args.segment) businessSegment = String(args.segment).trim();
        if (args.summary) businessSummary = String(args.summary).trim().slice(0, 2000);
      } else {
        console.error("Gemini summary failed:", resp.status, await resp.text());
      }
    } catch (e) {
      console.error("Gemini summary error:", e);
    }
  }

  const { error } = await adminClient
    .from("admin_crm_deals")
    .update({
      business_name: businessName,
      business_segment: businessSegment,
      business_summary: businessSummary,
      business_data_updated_at: new Date().toISOString(),
    })
    .eq("id", deal.id);
  if (error) console.error("Failed to update admin_crm_deal:", error);
  else console.log("Business data saved for deal", deal.id);
}

// ──────────────────────────────────────────────────────────────────────────
// Apply interview-collected configuration to the user's account.
// Extracts structured data from the conversation via Gemini function calling
// and persists into whatsapp_ai_config, appointment_types, notification_contacts
// and followup_config. Service role bypasses RLS.
// ──────────────────────────────────────────────────────────────────────────
async function applyInterviewConfig(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  companyName: string,
  segment: string,
  messages: Array<{ role: string; content: string }>,
  generatedPrompt: string | null,
): Promise<{
  appointment_types_created: number;
  notification_contact_created: boolean;
  address_set: boolean;
}> {
  const summary = {
    appointment_types_created: 0,
    notification_contact_created: false,
    address_set: false,
  };

  // Resolve account_id (owner)
  const { data: account } = await adminClient
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  const accountId = account?.id || null;

  // Build transcript
  const transcript = messages
    .slice(-40)
    .map((m) => `${m.role === "assistant" ? "IA" : "Cliente"}: ${m.content}`)
    .join("\n")
    .slice(0, 14000);

  let extracted: any = {};

  if (GEMINI_API_KEY) {
    try {
      const tool = {
        function_declarations: [{
          name: "registrar_configuracao_negocio",
          description: "Registra a configuração estruturada do negócio extraída da entrevista",
          parameters: {
            type: "object",
            properties: {
              agent_name: { type: "string", description: "Nome do agente virtual definido na entrevista (ex: Sofia, Theo). Se não foi informado, use 'Assistente Virtual'." },
              business_niche: { type: "string", description: "Nicho/segmento do negócio (curto, ex: 'Clínica de estética')" },
              business_description: { type: "string", description: "Descrição rápida do negócio em 1-2 frases" },
              uses_appointments: { type: "boolean", description: "Se o negócio trabalha com agendamentos" },
              appointment_types: {
                type: "array",
                description: "Tipos de agendamento coletados (vazio se não usa agendamentos)",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    duration_minutes: { type: "integer", description: "Duração em minutos (default 30 se não informado)" },
                    days_of_week: { type: "array", items: { type: "integer" }, description: "Dias da semana 0=domingo a 6=sábado" },
                    start_time: { type: "string", description: "HH:MM" },
                    end_time: { type: "string", description: "HH:MM" },
                  },
                  required: ["name"],
                },
              },
              notification_phone: { type: "string", description: "Número de WhatsApp para receber notificações do sistema (apenas dígitos com DDD, ex: 5511999999999). String vazia se não informado." },
              business_address: { type: "string", description: "Endereço completo do local de atendimento. String vazia se for 100% online." },
              business_location_name: { type: "string", description: "Nome do local (ex: 'Clínica Bem Estar - Unidade Centro'). String vazia se não houver." },
            },
            required: ["agent_name", "business_niche", "business_description", "uses_appointments"],
          },
        }],
      };

      const prompt = `Extraia a configuração estruturada do negócio com base na entrevista abaixo.\n\nDados informados:\n- Empresa: ${companyName}\n- Segmento: ${segment}\n\nTrecho da entrevista:\n${transcript}\n\n${generatedPrompt ? `Prompt gerado (referência):\n${generatedPrompt.slice(0, 4000)}\n` : ""}\nRegras:\n- Para appointment_types: só inclua se o cliente confirmou que trabalha com agendamentos. Use os horários e dias mencionados. Se mencionou só 'segunda a sexta', use [1,2,3,4,5].\n- Para notification_phone: extraia apenas dígitos. Adicione 55 no início se for número brasileiro sem DDI.\n- Para business_address: deixe vazio se for atendimento online/remoto.`;

      const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [tool],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_configuracao_negocio"] } },
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
        extracted = fnCall?.args || {};
      } else {
        console.error("Gemini config extraction failed:", resp.status, await resp.text());
      }
    } catch (e) {
      console.error("Gemini config extraction error:", e);
    }
  }

  // ─── 1. Upsert whatsapp_ai_config ───────────────────────────────────────
  const aiConfigUpdate: Record<string, unknown> = {
    agent_name: (extracted.agent_name || "Assistente Virtual").toString().slice(0, 100),
    business_niche: (extracted.business_niche || segment || "").toString().slice(0, 200) || null,
    business_description: (extracted.business_description || "").toString().slice(0, 1000) || null,
    custom_prompt: generatedPrompt,
    active: true,
    business_hours_start: "00:00",
    business_hours_end: "23:59",
    business_days: [0, 1, 2, 3, 4, 5, 6],
    max_messages_without_human: 50,
    response_delay_seconds: 15,
  };
  if (extracted.business_address && extracted.business_address.trim()) {
    aiConfigUpdate.business_address = extracted.business_address.trim();
    summary.address_set = true;
  }
  if (extracted.business_location_name && extracted.business_location_name.trim()) {
    aiConfigUpdate.business_location_name = extracted.business_location_name.trim();
  }

  const { data: existingCfg } = await adminClient
    .from("whatsapp_ai_config")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCfg) {
    const { error: updErr } = await adminClient
      .from("whatsapp_ai_config")
      .update(aiConfigUpdate)
      .eq("id", existingCfg.id);
    if (updErr) console.error("Failed updating whatsapp_ai_config:", updErr);
  } else {
    const { error: insErr } = await adminClient
      .from("whatsapp_ai_config")
      .insert({ user_id: userId, account_id: accountId, ...aiConfigUpdate });
    if (insErr) console.error("Failed inserting whatsapp_ai_config:", insErr);
  }

  // ─── 2. Insert appointment_types (skip duplicates by name) ──────────────
  if (extracted.uses_appointments && Array.isArray(extracted.appointment_types)) {
    const { data: existingTypes } = await adminClient
      .from("appointment_types")
      .select("name")
      .eq("user_id", userId);
    const existingNames = new Set((existingTypes || []).map((t: any) => (t.name || "").toLowerCase().trim()));

    for (const t of extracted.appointment_types) {
      const name = (t.name || "").toString().trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) continue;

      const days = Array.isArray(t.days_of_week) && t.days_of_week.length > 0
        ? t.days_of_week.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [1, 2, 3, 4, 5];
      const startTime = /^\d{2}:\d{2}$/.test(t.start_time || "") ? `${t.start_time}:00` : "08:00:00";
      const endTime = /^\d{2}:\d{2}$/.test(t.end_time || "") ? `${t.end_time}:00` : "18:00:00";
      const duration = Number.isInteger(t.duration_minutes) && t.duration_minutes > 0 ? t.duration_minutes : 30;

      const { error: aptErr } = await adminClient.from("appointment_types").insert({
        user_id: userId,
        account_id: accountId,
        name,
        duration_minutes: duration,
        days_of_week: days,
        start_time: startTime,
        end_time: endTime,
        max_appointments_per_slot: 1,
        is_active: true,
      });
      if (aptErr) console.error("Failed inserting appointment_type:", aptErr);
      else summary.appointment_types_created++;
    }
  }

  // ─── 3. Insert notification_contact ─────────────────────────────────────
  if (extracted.notification_phone) {
    let phone = String(extracted.notification_phone).replace(/\D/g, "");
    if (phone.length >= 10 && phone.length <= 11) phone = "55" + phone;
    if (phone.length >= 12 && phone.length <= 13) {
      const { data: existingNotif } = await adminClient
        .from("notification_contacts")
        .select("id")
        .eq("user_id", userId)
        .eq("phone", phone)
        .maybeSingle();
      if (!existingNotif) {
        const { error: notErr } = await adminClient.from("notification_contacts").insert({
          user_id: userId,
          account_id: accountId,
          phone,
          name: "Notificações do Sistema",
          notify_appointments: true,
          notify_handoffs: true,
        });
        if (notErr) console.error("Failed inserting notification_contact:", notErr);
        else summary.notification_contact_created = true;
      }
    }
  }

  // ─── 4. Upsert followup_config (defaults + enabled) ─────────────────────
  const { data: existingFu } = await adminClient
    .from("followup_config")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingFu) {
    await adminClient
      .from("followup_config")
      .update({ enabled: true })
      .eq("id", existingFu.id);
  } else {
    await adminClient.from("followup_config").insert({
      user_id: userId,
      account_id: accountId,
      enabled: true,
    });
  }

  return summary;
}

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
□ AGENDAMENTOS: Pergunte EXPLICITAMENTE "Você trabalha com agendamentos (consultas, reuniões, sessões com horário marcado)?". Se SIM, colete para CADA tipo de agendamento: nome do serviço, duração em minutos, dias da semana disponíveis e horário (início/fim). Se NÃO, registre e siga.
□ ENDEREÇO E LOCALIZAÇÃO: Endereço completo do local de atendimento, pontos de referência, como chegar. Se for 100% online/remoto, pergunte e registre como online.
□ CONTATO DE NOTIFICAÇÃO: Pergunte EXPLICITAMENTE "Qual número de WhatsApp você quer usar para receber notificações do sistema (novos agendamentos, transferências para humano, etc.)?". Aceite qualquer formato e confirme.
□ DIFERENCIAIS COMPETITIVOS: O que diferencia a empresa da concorrência? Qual o principal argumento de venda?
□ PROCESSO DE AGENDAMENTO/COMPRA: Quais dados o cliente precisa fornecer? Existe aula experimental/teste grátis? Como funciona?

PASSO 3 — PERGUNTAS ADAPTATIVAS (após coletar os dados obrigatórios):
Depois de ter TODOS os dados obrigatórios, adapte perguntas extras conforme a intenção:

SE o foco incluir VENDAS ATIVAS:
- Objeções mais comuns, gatilhos de urgência/escassez, script de fechamento

SE o foco incluir PRÉ-ATENDIMENTO / INFORMAÇÕES / AGENDAMENTO:
- Dúvidas mais frequentes dos clientes, quando escalar para humano, tom desejado

SE o foco incluir SUPORTE / PÓS-VENDA:
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
1️⃣ Indicar números específicos
2️⃣ Análise automática

Qual opção prefere?"

IMPORTANTE sobre as respostas de análise de conversas:
- Se o usuário RECUSAR a análise, responda com: "[SKIP_ANALYSIS]" em uma linha separada, depois continue normalmente para gerar o prompt com [FINISH]
- Se o usuário ACEITAR e escolher ANÁLISE AUTOMÁTICA ou disser algo como "automático", "opção 2", "busca automático", responda com: "[ANALYZE_AUTO]" em uma linha separada
- Se o usuário ACEITAR e enviar NÚMEROS, responda com: "[ANALYZE_PHONES]" em uma linha separada e liste os números que ele enviou
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

## INTENÇÕES DO ATENDIMENTO
O agente deve considerar que este atendimento pode envolver múltiplas intenções:
- VENDAS
- PRÉ-ATENDIMENTO
- AGENDAMENTO
- SUPORTE

## DIRETRIZ DE PRIORIDADE DO ATENDIMENTO
Antes de cada resposta, o agente deve refletir:
"Qual é a intenção atual do cliente e qual ação me aproxima do melhor resultado?"

## DETECÇÃO DE INTENÇÃO ATIVA
A cada mensagem do cliente, identificar:
- Se está buscando informação
- Se está demonstrando interesse
- Se quer agendar
- Se precisa de suporte

## PRIORIZAÇÃO
Ordem de prioridade:
1. SUPORTE (urgência)
2. AGENDAMENTO
3. VENDAS
4. INFORMAÇÃO

## PROTOCOLO DE ATENDIMENTO (INTELIGENTE E ADAPTATIVO)
O atendimento NÃO deve seguir roteiro fixo.

### COMPORTAMENTO BASE
- Sempre pedir o nome antes de continuar
- Nunca avançar sem resposta
- Usar linguagem humana
- Fazer uma pergunta por vez
- Adaptar conforme respostas
- Evitar textos longos

### CONDUÇÃO POR INTENÇÃO
SE FOR VENDAS:
- Usar SPIN Selling
- Investigar → aprofundar → gerar desejo → apresentar solução
- Nunca começar vendendo direto

SE FOR PRÉ-ATENDIMENTO:
- Informar com clareza
- Não pressionar
- Identificar oportunidade de avanço

SE FOR AGENDAMENTO:
- Ser direto
- Coletar dados
- Confirmar ação

SE FOR SUPORTE:
- Priorizar empatia
- Resolver rápido
- Não vender

## ADAPTAÇÃO DINÂMICA
O agente pode mudar abordagem durante a conversa conforme o comportamento do cliente.

## CONTROLE DE FLUXO
- Se não responder → retomar leve
- Se resposta incompleta → pedir complemento
- Se sair do assunto → trazer de volta
- Se pedir humano → transferir

## REGRAS CRÍTICAS
- Nunca inventar informações
- Nunca ser agressivo
- Nunca ignorar contexto
- Nunca quebrar o tom definido
- Sempre adaptar ao momento da conversa

O agente deve sempre priorizar adaptação ao contexto ao invés de seguir scripts rígidos.
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

      // On finish: extract business data and update support CRM deal
      let appliedConfigSummary: any = null;
      if (hasFinished) {
        try {
          const adminClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          await extractAndSaveBusinessData(
            adminClient,
            userId as string,
            companyName,
            segment,
            newMessages,
            generatedPrompt,
          );
          try {
            appliedConfigSummary = await applyInterviewConfig(
              adminClient,
              userId as string,
              companyName,
              segment,
              newMessages,
              generatedPrompt,
            );
          } catch (e) {
            console.error("applyInterviewConfig failed:", e);
          }
        } catch (e) {
          console.error("Business data extraction failed:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: displayMessage,
        finished: hasFinished,
        generatedPrompt,
        requestAnalyzeAuto,
        requestAnalyzePhones,
        skipAnalysis,
        appliedConfig: appliedConfigSummary,
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
