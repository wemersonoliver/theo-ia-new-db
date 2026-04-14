import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Theo, Agente de Suporte e Consultor Comercial da Theo IA, um super agente com acesso total ao sistema. Seu papel é ajudar clientes que utilizam a plataforma e também atender potenciais clientes interessados em contratar o Theo IA — um sistema de atendimento WhatsApp com IA integrada.

## REGRA FUNDAMENTAL DE FORMATO DE MENSAGENS

- **NUNCA envie mensagens longas.** Cada mensagem deve ter no máximo 2-3 linhas.
- Divida sua resposta em blocos curtos e envie como mensagens separadas (use quebras de linha duplas para separar os blocos).
- Isso simula uma conversa natural de WhatsApp, como uma pessoa real digitando.
- Exemplo de como responder:

"Oi! Eu sou o Theo 😊

Sou o assistente inteligente da plataforma Theo IA!

Antes de tudo, como posso te chamar?"

## REGRA DE ABERTURA — PRIMEIRA MENSAGEM

Quando for a PRIMEIRA interação com um contato (sem histórico prévio ou sem nome identificado):
1. Se apresente como Theo de forma simpática e breve
2. Pergunte o nome do cliente ANTES de qualquer outra coisa
3. Só prossiga com o atendimento DEPOIS de saber o nome
4. A partir daí, SEMPRE chame o cliente pelo nome em todas as mensagens

## REGRA DE DESCOBERTA DO NEGÓCIO

Após saber o nome do cliente:
1. Pergunte qual é o tipo de negócio ou área de atuação dele
2. Use essa informação para PERSONALIZAR toda a conversa com exemplos práticos do segmento
3. Mostre como o Theo IA seria um diferencial específico para aquele tipo de negócio
4. Exemplos: clínica → agendamento automático + lembretes; loja → catálogo + atendimento 24h; consultório → confirmação de consultas; imobiliária → qualificação de leads; restaurante → pedidos e reservas

## Sobre o Theo IA

O Theo IA é uma plataforma SaaS que permite aos usuários:

1. **Conectar WhatsApp** — Via Evolution API, escaneando QR Code. Cada usuário tem sua própria instância.
2. **Agente de IA** — Um assistente virtual que responde automaticamente via WhatsApp usando Gemini. Configurável com prompt personalizado, horários de funcionamento, ativação por palavras-chave.
3. **Agendamentos** — Sistema completo de agendamento com tipos de serviço, horários disponíveis, lembretes automáticos via WhatsApp.
4. **CRM** — Pipeline de vendas com kanban, deals, contatos vinculados.
5. **Produtos** — Catálogo de produtos/serviços com nome, preço, SKU, quantidade.
6. **Base de Conhecimento** — Upload de documentos (PDF, TXT) que a IA usa como referência nas respostas.
7. **Follow-up Automático** — Sistema que envia mensagens automáticas para contatos inativos usando técnicas de persuasão e vendas.
8. **Contatos** — Gestão de contatos com tags, notas, email.
9. **Conversas** — Visualização de todas as conversas do WhatsApp com opção de assumir manualmente.
10. **Configurações** — Horário comercial, mensagem fora do expediente, mensagem de handoff, delay entre mensagens.
11. **Notificações** — Contatos que recebem alertas de novos agendamentos e transferências para humano.

## Planos e Preços

- **Plano Mensal**: R$ 97,00/mês — acesso completo a todas as funcionalidades
- **Plano Anual**: R$ 997,00/ano — economia de quase 15% (equivale a ~R$ 83/mês)
- Link Mensal (SOMENTE quando o cliente pedir para pagar/assinar): https://pay.kiwify.com.br/AdpFbz3
- Link Anual (SOMENTE quando o cliente pedir para pagar/assinar): https://pay.kiwify.com.br/bpNMdQ0
- **Período de teste gratuito de 15 dias** para novos usuários — SEM necessidade de pagamento ou cartão de crédito
- **Link de cadastro para teste grátis**: https://theoia.com.br/register — ESTE é o link que deve ser enviado quando o cliente quiser testar

## REGRAS CRÍTICAS SOBRE TESTE GRÁTIS E LINKS

1. **O teste grátis é de 15 dias, NUNCA diga 7 dias.**
2. **Para iniciar o teste grátis, o cliente NÃO precisa pagar.** Basta se cadastrar no link: https://theoia.com.br/register
3. **NUNCA envie links de pagamento (Kiwify) a menos que o cliente PEÇA EXPLICITAMENTE para assinar/pagar.** Quando o cliente demonstrar interesse em testar, envie APENAS o link de cadastro.
4. **O cadastro é rápido, simples e sem complicação.** Reforce isso sempre.

## Sobre a Configuração do Sistema

- A configuração do Theo IA é feita em poucos passos, de forma rápida e fácil, sem complicação.
- Basta conectar o WhatsApp escaneando o QR Code, preencher as informações do negócio e pronto — a IA já começa a atender.
- A entrevista inteligente ajuda a configurar tudo automaticamente, sem precisar de conhecimento técnico.
- Em poucos minutos o sistema já está funcionando e atendendo clientes.
- Sempre mencione a facilidade e rapidez da configuração ao apresentar o sistema.

## Regras de Comportamento — Comercial / Vendas

1. **Seja simpático e acolhedor** — Trate cada potencial cliente como alguém especial. Use o nome da pessoa sempre que possível.
2. **Seja persuasivo com elegância** — Não force a venda. Mostre valor real e como o Theo IA resolve problemas concretos do negócio.
3. **Foque nos benefícios, não nas funcionalidades** — Em vez de "temos CRM", diga "você vai organizar todas as suas oportunidades de venda em um painel visual e nunca mais perder um cliente por esquecimento".
4. **Use prova social** — Mencione que empresários e profissionais já utilizam o Theo IA para automatizar o atendimento e vender mais.
5. **Crie urgência natural** — Destaque o custo de NÃO ter um atendimento automatizado (clientes perdidos, tempo gasto respondendo manualmente, oportunidades desperdiçadas).
6. **Recomende o teste grátis PRIMEIRO** — Sempre convide o prospect a experimentar gratuitamente por 15 dias antes de falar em preço. O link de cadastro é: https://theoia.com.br/register
7. **Fale sobre preços SOMENTE se o cliente perguntar** — Apresente o plano anual como melhor custo-benefício, com o mensal como alternativa.
8. **Quebre objeções com empatia** — Se disserem "é caro", compare com o custo de contratar um atendente humano (salário + encargos vs R$ 97/mês 24h por dia). Se disserem "já tenho atendimento", pergunte se conseguem responder em 3 segundos às 2h da manhã.
9. **Conduza ao cadastro, não ao pagamento** — Quando sentir interesse, envie o link de cadastro (https://theoia.com.br/register) e explique que a configuração é rápida e simples.
10. **Não desista fácil** — Se a pessoa não responder ou mostrar dúvida, faça perguntas que reengajem: "O que mais te preocupa?", "Posso esclarecer algum ponto?"
11. **Adapte o pitch ao segmento** — Se souber o ramo do prospect, personalize os exemplos (clínicas → agendamento automático, lojas → catálogo + atendimento 24h, consultórios → lembretes automáticos, etc.)
12. **Destaque a facilidade de configuração** — Sempre mencione que a configuração é feita em poucos minutos, sem complicação, de forma rápida e intuitiva.

## Argumentos de Venda Principais

- 🤖 Atendimento 24h sem folga, férias ou mau humor
- ⚡ Respostas em segundos, não em horas
- 📅 Agendamentos automáticos direto pelo WhatsApp
- 📊 CRM integrado para nunca perder uma oportunidade
- 🔄 Follow-up automático que reconquista clientes inativos
- 📚 IA que aprende com seus documentos e fala a língua do seu negócio
- 💰 Custo menor que um dia de salário de um atendente
- 🚀 Configuração em poucos minutos, sem complicação — resultado imediato
- 🆓 15 dias grátis para testar sem compromisso e sem cartão

## Orientações por Funcionalidade

### WhatsApp
- Se o usuário relata problemas de conexão, verifique o status da instância
- Oriente sobre reconexão: ir em WhatsApp > Desconectar > Reconectar escaneando QR

### Agente IA
- Explique que o prompt é o "cérebro" da IA e deve conter todas as informações do negócio
- Horários de atendimento controlam quando a IA responde
- Palavras-chave permitem ativar a IA apenas com termos específicos

### Agendamentos
- Tipos de serviço definem duração, horários e dias disponíveis
- Lembretes são enviados automaticamente X horas antes

### Produtos
- Produtos podem ser usados pela IA para informar preços e disponibilidade
- SKU é opcional mas útil para controle interno

### Assinatura
- Verifique o status (active, expired, cancelled) e a data de expiração
- Para problemas de pagamento, oriente o cliente a verificar o email de cobrança
- Se a assinatura estiver expirada, ofereça o link de renovação com incentivo`;

// Tool declarations for Gemini function calling
const supportTools = {
  function_declarations: [
    {
      name: "lookup_user",
      description: "Busca um usuário no sistema pelo telefone. Retorna perfil, assinatura e roles.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número de telefone do usuário (ex: 5511999999999)" }
        },
        required: ["phone"]
      }
    },
    {
      name: "check_subscription",
      description: "Verifica o status da assinatura de um usuário específico.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "get_user_ai_config",
      description: "Lê a configuração de IA do WhatsApp do usuário (prompt, horários, nome do agente, etc).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "update_user_ai_config",
      description: "Atualiza configurações de IA do usuário. Campos opcionais: custom_prompt, agent_name, business_hours_start, business_hours_end, business_days, active, handoff_message, out_of_hours_message.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" },
          updates: {
            type: "object",
            description: "Campos a atualizar na configuração de IA",
            properties: {
              custom_prompt: { type: "string" },
              agent_name: { type: "string" },
              business_hours_start: { type: "string" },
              business_hours_end: { type: "string" },
              business_days: { type: "array", items: { type: "number" } },
              active: { type: "boolean" },
              handoff_message: { type: "string" },
              out_of_hours_message: { type: "string" }
            }
          }
        },
        required: ["user_id", "updates"]
      }
    },
    {
      name: "list_user_products",
      description: "Lista todos os produtos cadastrados pelo usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "create_product",
      description: "Cria um novo produto para o usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" },
          name: { type: "string", description: "Nome do produto" },
          price_cents: { type: "number", description: "Preço em centavos" },
          description: { type: "string", description: "Descrição do produto" },
          sku: { type: "string", description: "SKU do produto" },
          quantity: { type: "number", description: "Quantidade em estoque" }
        },
        required: ["user_id", "name", "price_cents"]
      }
    },
    {
      name: "update_product",
      description: "Atualiza um produto existente.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              price_cents: { type: "number" },
              description: { type: "string" },
              sku: { type: "string" },
              quantity: { type: "number" },
              active: { type: "boolean" }
            }
          }
        },
        required: ["product_id", "updates"]
      }
    },
    {
      name: "get_whatsapp_status",
      description: "Verifica o status da instância WhatsApp do usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "update_business_hours",
      description: "Atualiza os horários de atendimento da IA do usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" },
          business_hours_start: { type: "string", description: "Horário de início (HH:MM)" },
          business_hours_end: { type: "string", description: "Horário de fim (HH:MM)" },
          business_days: { type: "array", items: { type: "number" }, description: "Dias da semana (0=dom, 1=seg...6=sab)" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "update_followup_config",
      description: "Configura o follow-up automático do usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" },
          enabled: { type: "boolean" },
          inactivity_hours: { type: "number" },
          max_days: { type: "number" },
          morning_window_start: { type: "string" },
          morning_window_end: { type: "string" },
          evening_window_start: { type: "string" },
          evening_window_end: { type: "string" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "list_appointments",
      description: "Lista agendamentos do usuário, opcionalmente filtrados por status.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" },
          status: { type: "string", description: "Filtrar por status: scheduled, confirmed, cancelled, completed" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "get_crm_summary",
      description: "Retorna um resumo do CRM do usuário: pipelines, estágios e quantidade de deals.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID do usuário" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "transfer_to_human",
      description: "Transfere a conversa para atendimento humano. Use quando não souber resolver ou o cliente solicitar explicitamente.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo da transferência" }
        },
        required: ["reason"]
      }
    }
  ]
};

// Tool execution functions
async function executeTool(supabase: any, toolName: string, args: any, phone: string, conversationHistory: any[]): Promise<string> {
  try {
    switch (toolName) {
      case "lookup_user": {
        const searchPhone = args.phone || phone;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("phone", searchPhone)
          .maybeSingle();
        
        if (!profile) {
          // Try partial match
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .ilike("phone", `%${searchPhone.slice(-8)}%`)
            .limit(3);
          
          if (profiles?.length) {
            return JSON.stringify({ found: true, profiles, note: "Busca parcial por telefone" });
          }
          return JSON.stringify({ found: false, message: "Usuário não encontrado com este telefone" });
        }

        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id);

        return JSON.stringify({
          found: true,
          profile: { ...profile, avatar_url: undefined },
          subscription: subscription || null,
          roles: roles?.map((r: any) => r.role) || []
        });
      }

      case "check_subscription": {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", args.user_id)
          .order("created_at", { ascending: false })
          .limit(5);
        
        return JSON.stringify({ subscriptions: subs || [], count: subs?.length || 0 });
      }

      case "get_user_ai_config": {
        const { data: config } = await supabase
          .from("whatsapp_ai_config")
          .select("*")
          .eq("user_id", args.user_id)
          .maybeSingle();
        
        return JSON.stringify(config || { message: "Configuração de IA não encontrada" });
      }

      case "update_user_ai_config": {
        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update({ ...args.updates, updated_at: new Date().toISOString() })
          .eq("user_id", args.user_id);
        
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, message: "Configuração de IA atualizada com sucesso" });
      }

      case "list_user_products": {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price_cents, description, sku, quantity, active")
          .eq("user_id", args.user_id)
          .order("created_at", { ascending: false });
        
        return JSON.stringify({ products: products || [], count: products?.length || 0 });
      }

      case "create_product": {
        const { data, error } = await supabase
          .from("products")
          .insert({
            user_id: args.user_id,
            name: args.name,
            price_cents: args.price_cents,
            description: args.description || null,
            sku: args.sku || null,
            quantity: args.quantity || 0,
          })
          .select()
          .single();
        
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, product: data });
      }

      case "update_product": {
        const { error } = await supabase
          .from("products")
          .update({ ...args.updates, updated_at: new Date().toISOString() })
          .eq("id", args.product_id);
        
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, message: "Produto atualizado" });
      }

      case "get_whatsapp_status": {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("status, phone_number, profile_name, last_sync_at, updated_at")
          .eq("user_id", args.user_id)
          .maybeSingle();
        
        return JSON.stringify(instance || { message: "Instância WhatsApp não encontrada" });
      }

      case "update_business_hours": {
        const updates: any = { updated_at: new Date().toISOString() };
        if (args.business_hours_start) updates.business_hours_start = args.business_hours_start;
        if (args.business_hours_end) updates.business_hours_end = args.business_hours_end;
        if (args.business_days) updates.business_days = args.business_days;

        const { error } = await supabase
          .from("whatsapp_ai_config")
          .update(updates)
          .eq("user_id", args.user_id);
        
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, message: "Horários de atendimento atualizados" });
      }

      case "update_followup_config": {
        const { user_id, ...updates } = args;
        const { error } = await supabase
          .from("followup_config")
          .upsert({ user_id, ...updates, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, message: "Configuração de follow-up atualizada" });
      }

      case "list_appointments": {
        let query = supabase
          .from("appointments")
          .select("id, title, appointment_date, appointment_time, status, contact_name, phone, duration_minutes")
          .eq("user_id", args.user_id)
          .order("appointment_date", { ascending: false })
          .limit(20);
        
        if (args.status) query = query.eq("status", args.status);
        
        const { data } = await query;
        return JSON.stringify({ appointments: data || [], count: data?.length || 0 });
      }

      case "get_crm_summary": {
        const { data: pipelines } = await supabase
          .from("crm_pipelines")
          .select("id, name")
          .eq("user_id", args.user_id);

        const { data: deals } = await supabase
          .from("crm_deals")
          .select("id, title, value_cents, stage_id, priority")
          .eq("user_id", args.user_id);

        const { data: stages } = await supabase
          .from("crm_stages")
          .select("id, name, pipeline_id, position")
          .eq("user_id", args.user_id)
          .order("position");

        const totalValue = deals?.reduce((sum: number, d: any) => sum + (d.value_cents || 0), 0) || 0;

        return JSON.stringify({
          pipelines: pipelines?.length || 0,
          stages: stages?.length || 0,
          deals: deals?.length || 0,
          total_value_cents: totalValue,
          stages_detail: stages?.map((s: any) => ({
            name: s.name,
            deals_count: deals?.filter((d: any) => d.stage_id === s.id).length || 0
          }))
        });
      }

      case "transfer_to_human": {
        // 1. Disable AI on this conversation
        await supabase
          .from("system_whatsapp_conversations")
          .update({ ai_active: false, updated_at: new Date().toISOString() })
          .eq("phone", phone);

        // 2. Generate conversation summary
        const summary = await generateSummary(conversationHistory, args.reason);

        // 3. Notify admin contacts
        await notifyAdminContacts(supabase, phone, summary, args.reason);

        return JSON.stringify({ 
          success: true, 
          message: "Conversa transferida para atendimento humano. Administradores foram notificados." 
        });
      }

      default:
        return JSON.stringify({ error: `Tool ${toolName} not found` });
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return JSON.stringify({ error: `Erro ao executar ${toolName}: ${error.message}` });
  }
}

async function generateSummary(history: any[], reason: string): Promise<string> {
  try {
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiApiKey) return `Motivo: ${reason}. Histórico não resumido (chave API indisponível).`;

    const historyText = history.slice(-20).map((m: any) => 
      `${m.from_me ? "Agente" : "Cliente"}: ${m.content}`
    ).join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `Resuma esta conversa de suporte em 3-5 linhas. Motivo da transferência: ${reason}\n\nConversa:\n${historyText}` }]
          }],
          generationConfig: { maxOutputTokens: 300 }
        })
      }
    );

    if (!response.ok) return `Motivo: ${reason}`;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || `Motivo: ${reason}`;
  } catch {
    return `Motivo: ${reason}`;
  }
}

async function notifyAdminContacts(supabase: any, clientPhone: string, summary: string, reason: string) {
  try {
    const { data: contacts } = await supabase
      .from("admin_notification_contacts")
      .select("phone, name")
      .eq("active", true);

    if (!contacts?.length) {
      console.log("No admin notification contacts configured");
      return;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const message = `⚠️ *Suporte - Transferência para Humano*\n\n📞 Cliente: ${clientPhone}\n📋 Motivo: ${reason}\n\n📝 *Resumo da Conversa:*\n${summary}\n\n💡 Acesse o painel admin para assumir a conversa.`;

    // Get system instance name
    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name")
      .limit(1)
      .maybeSingle();

    if (!sysInstance) {
      console.error("No system WhatsApp instance found for notifications");
      return;
    }

    for (const contact of contacts) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            phone: contact.phone,
            content: message,
            system: true,
          }),
        });
        console.log(`Admin notification sent to ${contact.name || contact.phone}`);
      } catch (err) {
        console.error(`Failed to notify ${contact.phone}:`, err);
      }
    }
  } catch (error) {
    console.error("Error notifying admin contacts:", error);
  }
}

const MAX_SUPPORT_MESSAGE_CHARS = 220;

function splitByWordLength(text: string, maxChars = MAX_SUPPORT_MESSAGE_CHARS): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (let i = 0; i < word.length; i += maxChars) {
        chunks.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

function splitLongSupportBlock(block: string, maxChars = MAX_SUPPORT_MESSAGE_CHARS): string[] {
  const normalized = block.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9*•-])/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const granularParts = (sentenceParts.length > 1 ? sentenceParts : [normalized]).flatMap((part) => {
    if (part.length <= maxChars) return [part];

    const clauseParts = part
      .split(/(?<=[,;:])\s+/u)
      .map((clause) => clause.trim())
      .filter(Boolean);

    return clauseParts.length > 1 ? clauseParts : splitByWordLength(part, maxChars);
  });

  const chunks: string[] = [];
  let current = "";

  for (const part of granularParts) {
    if (part.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      chunks.push(...splitByWordLength(part, maxChars));
      continue;
    }

    const next = current ? `${current} ${part}` : part;
    if (next.length > maxChars) {
      if (current) chunks.push(current.trim());
      current = part;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

function splitSupportResponseIntoBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const baseBlocks = normalized
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sourceBlocks = baseBlocks.length > 0 ? baseBlocks : [normalized];

  return sourceBlocks.flatMap((block) => {
    const lineBlocks = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lineBlocks.length > 1) {
      return lineBlocks.flatMap((line) => splitLongSupportBlock(line));
    }

    return splitLongSupportBlock(block);
  });
}

async function callGeminiWithTools(
  apiKey: string,
  systemPrompt: string,
  conversationHistory: any[],
  supabase: any,
  phone: string
): Promise<string> {
  const contents = conversationHistory.map((msg: any) => ({
    role: msg.from_me ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  // Ensure first message is from user
  if (contents.length > 0 && contents[0].role === "model") {
    contents.shift();
  }

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;

    const requestBody: any = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [supportTools],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2000 * attempts));
        continue;
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No candidate in Gemini response");

    const parts = candidate.content?.parts || [];
    
    // Check for function calls
    const functionCalls = parts.filter((p: any) => p.functionCall);
    
    if (functionCalls.length > 0) {
      // Add model response to contents
      contents.push({ role: "model", parts });

      // Execute all function calls
      const functionResponses: any[] = [];
      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        console.log(`Executing tool: ${name}`, JSON.stringify(args).slice(0, 200));
        
        const result = await executeTool(supabase, name, args || {}, phone, conversationHistory);
        functionResponses.push({
          functionResponse: {
            name,
            response: { result: JSON.parse(result) }
          }
        });
      }

      // Add function responses
      contents.push({ role: "user", parts: functionResponses });
      continue; // Loop to get final text response
    }

    // Extract text response (filter thinking parts)
    const textParts = parts.filter((p: any) => p.text && !p.thought);
    if (textParts.length > 0) {
      return textParts.map((p: any) => p.text).join("\n");
    }

    // Fallback: any text
    const anyText = parts.find((p: any) => p.text);
    if (anyText) return anyText.text;

    return "Desculpe, não consegui processar sua solicitação. Deseja falar com um atendente?";
  }

  return "Desculpe, ocorreu um problema no processamento. Vou transferir você para um atendente humano.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, messageContent, inputType } = await req.json();

    if (!phone || !messageContent) {
      return new Response(JSON.stringify({ error: "phone and messageContent required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Support AI processing message from ${phone}: ${messageContent.slice(0, 100)}`);

    // Get system AI config
    const { data: sysConfig } = await supabase
      .from("system_ai_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!sysConfig?.active) {
      console.log("System AI is not active");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history
    const { data: conversation } = await supabase
      .from("system_whatsapp_conversations")
      .select("messages, ai_active")
      .eq("phone", phone)
      .maybeSingle();

    if (conversation && !conversation.ai_active) {
      console.log("AI disabled for this conversation (human takeover)");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const history = (conversation?.messages || []) as any[];

    // Build prompt with admin custom prompt
    const customPrompt = sysConfig.custom_prompt || "";
    const fullPrompt = customPrompt 
      ? `${SYSTEM_PROMPT}\n\n## Instruções Adicionais do Administrador\n\n${customPrompt}`
      : SYSTEM_PROMPT;

    // Call Gemini with tools
    const aiResponse = await callGeminiWithTools(geminiApiKey, fullPrompt, history, supabase, phone);

    console.log(`AI response for ${phone}: ${aiResponse.slice(0, 200)}`);

    // Split AI response into message blocks with hard fallback for long paragraphs
    const messageBlocks = splitSupportResponseIntoBlocks(aiResponse);

    // Save ALL blocks as individual messages in conversation
    const newMessages = messageBlocks.map((block: string) => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from_me: true,
      content: block,
      type: "text",
      sent_by: "ai",
    }));

    const updatedMessages = [...history, ...newMessages];

    await supabase
      .from("system_whatsapp_conversations")
      .update({
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
        total_messages: updatedMessages.length,
        updated_at: new Date().toISOString(),
      })
      .eq("phone", phone);

    // Send each block as a separate WhatsApp message
    const { data: sysInstance } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name")
      .limit(1)
      .maybeSingle();

    if (sysInstance) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

      // Determine response mode: mirror the input type
      const voiceEnabled = sysConfig.voice_enabled === true;
      const voiceId = sysConfig.voice_id || undefined;
      const respondWithAudio = voiceEnabled && inputType === "audio";

      for (let i = 0; i < messageBlocks.length; i++) {
        if (respondWithAudio) {
          // AUDIO MODE: send audio only (no text)
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

            const ttsRes = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                text: messageBlocks[i],
                voiceId,
                phone,
                source: "support",
              }),
            });

            if (ttsRes.ok) {
              const { audioBase64 } = await ttsRes.json();
              if (audioBase64) {
                await fetch(`${evolutionUrl}/message/sendWhatsAppAudio/${sysInstance.instance_name}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": evolutionKey,
                  },
                  body: JSON.stringify({
                    number: phone,
                    audio: `data:audio/mpeg;base64,${audioBase64}`,
                  }),
                });
                console.log(`Audio-only sent for block ${i} (${messageBlocks[i].length} chars)`);
              }
            } else {
              // Fallback to text if TTS fails
              console.error(`TTS failed, falling back to text for block ${i}`);
              await fetch(`${evolutionUrl}/message/sendText/${sysInstance.instance_name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": evolutionKey },
                body: JSON.stringify({ number: phone, text: messageBlocks[i] }),
              });
            }
          } catch (ttsErr) {
            console.error(`TTS error, falling back to text for block ${i}:`, ttsErr);
            await fetch(`${evolutionUrl}/message/sendText/${sysInstance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evolutionKey },
              body: JSON.stringify({ number: phone, text: messageBlocks[i] }),
            });
          }
        } else {
          // TEXT MODE: send text only
          await fetch(`${evolutionUrl}/message/sendText/${sysInstance.instance_name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evolutionKey,
            },
            body: JSON.stringify({
              number: phone,
              text: messageBlocks[i],
            }),
          });
        }

        // Delay between blocks to simulate typing
        if (i < messageBlocks.length - 1) {
          const delay = Math.min(messageBlocks[i].length * 30, 3000);
          await new Promise(r => setTimeout(r, Math.max(delay, 800)));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, response: aiResponse.slice(0, 100) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Support AI Agent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
