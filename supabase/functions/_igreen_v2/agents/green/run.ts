// Green Specialist — versão minimalista (Fase 3).
// Cobre: descoberta → vídeo → qualificação simples → solicitar fatura.
// LLM só preenche texto curto. Stage e tool_calls são decididos em código (D1).

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideGreenStage, isAffirmation } from "./stages.ts";
import { GREEN_SYSTEM, buildGreenUserPrompt } from "./prompt.ts";

const LLM_TIMEOUT_MS = 8000;

export async function runGreen(ctx: AgentContext): Promise<AgentResult> {
  const initialStage = decideGreenStage(
    ctx.state, ctx.message,
    !!ctx.media, (ctx.state as any).document_status ?? null,
  );
  const tool_calls: AgentResult["tool_calls"] = [];
  const events: AgentResult["events"] = [
    { type: "green_stage_decided", priority: "low", source: "specialist", payload: { stage: initialStage } },
  ];
  const patch: AgentResult["suggested_state_patch"] = {};

  const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;
  let stage = initialStage;

  if (stage === "greet") {
    // marca que já saudamos para na próxima entrarmos em explain_solution
    patch.produto = "green";
    patch.extras = { ...currentExtras, greeted: true };
  }

  if (stage === "explain_solution") {
    // Marca que já explicamos para o stage-engine progredir no próximo turno
    // mesmo se set_product retornar skipped.
    patch.produto = "green";
    patch.extras = { ...currentExtras, explained: true };
    tool_calls.push({ name: "set_product", args: { produto: "green" } });
    if (isAffirmation(ctx.message)) {
      patch.extras = { ...(patch.extras as object), solution_confirmed: true };
    }
  }

  // Promoção determinística novo → qualificacao quando entramos em send_video
  // ainda em etapa "novo". Não dependemos mais de set_product(skipped:false).
  if (stage === "send_video" && (ctx.state.etapa_funil ?? "novo").toLowerCase() === "novo") {
    patch.etapa_funil = "qualificacao";
    tool_calls.push({ name: "set_stage", args: { etapa: "qualificacao" } });
  }

  if (stage === "ask_consumo") {
    // tenta capturar consumo na mensagem atual (números seguidos de kwh/r$/reais)
    const consumo = extractConsumo(ctx.message);
    if (consumo) patch.extras = { ...currentExtras, consumo_medio: consumo };
  }

  if (stage === "engage_check") {
    // Marca engaged=true para destravar coleta de dados no próximo turno,
    // independentemente da resposta — o objetivo é dar respiro humano entre
    // o vídeo e o início da qualificação.
    patch.extras = { ...currentExtras, engaged: true };
  }

  if (stage === "ask_estado") {
    const uf = extractEstado(ctx.message);
    if (uf) patch.extras = { ...currentExtras, estado: uf };
  }

  if (stage === "ask_distribuidora") {
    const d = extractDistribuidora(ctx.message);
    if (d) patch.extras = { ...(patch.extras as object ?? currentExtras), distribuidora: d };
  }

  if (stage === "simulate_discount") {
    const estado = (currentExtras.estado as string | undefined) ?? "";
    const distribuidora = (currentExtras.distribuidora as string | undefined) ?? "";
    if (estado && distribuidora) {
      tool_calls.push({
        name: "get_distributor_discount",
        args: { state: estado, distributor: distribuidora },
      });
    }
    // Marca lookup como solicitado para evitar reentrada — a tool persiste discount_lookup_done.
    patch.extras = { ...(patch.extras as object ?? currentExtras), discount_lookup_done: true };
  }

  if (stage === "intent_send_invoice_ack") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), intent_send_invoice: true };
    // Adiciona tag CRM "vai enviar fatura" se a tool estiver disponível.
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "vai enviar fatura" },
    });
  }

  if (stage === "objection_security") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), objection_security_handled: true };
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "objecao_seguranca" },
    });
  }

  if (stage === "request_identity") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), identity_requested: true };
  }

  if (stage === "send_autocadastro_link") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), autocadastro_sent: true };
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "autocadastro_enviado" },
    });
    tool_calls.push({
      name: "save_green_lead_field",
      args: { field: "auto_cadastro_enviado", value: "true" },
    });
  }

  if (stage === "handoff_human") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), handoff_done: true };
    (patch as any).handoff_ativo = true;
    tool_calls.push({
      name: "request_human_handoff",
      args: { reason: "explicit_user_request" },
    });
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "handoff_humano" },
    });
  }

  if (stage === "validate_identity" && ctx.media) {
    tool_calls.push({
      name: "validate_green_identity",
      args: {
        media_url: ctx.media.url,
        mime_type: ctx.media.mime_type,
        byte_size: ctx.media.byte_size,
        expected_name: (currentExtras.client_name as string | undefined) ?? null,
      },
    });
  }

  if (stage === "ask_name") {
    const nome = extractFirstName(ctx.message);
    if (nome) patch.extras = { ...(patch.extras as object ?? currentExtras), client_name: nome };
  }

  if (stage === "send_video") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), video_sent: true };
    tool_calls.push({
      name: "send_discovery_video",
      args: { produto: "green" },
    });
  }

  if (stage === "request_invoice") {
    tool_calls.push({
      name: "request_invoice",
      args: { reason: "calculo_economia" },
    });
  }

  if (stage === "validate_invoice" && ctx.media) {
    tool_calls.push({
      name: "validate_green_invoice",
      args: {
        media_url: ctx.media.url,
        mime_type: ctx.media.mime_type,
        byte_size: ctx.media.byte_size,
      },
    });
  }

  // Post-capture re-decision: se acabamos de capturar um dado em extras,
  // re-decidimos o stage para evitar repetir a pergunta no próximo turno.
  // Não aplicamos para stages que disparam tool_calls (send_video/validate_invoice/request_invoice)
  // — esses precisam manter o stage original.
  const STAGES_REDECIDABLE = new Set(["ask_consumo", "ask_estado", "ask_distribuidora"]);
  if (STAGES_REDECIDABLE.has(stage)) {
    const mergedExtras = (patch.extras as Record<string, unknown>) ?? currentExtras;
    const mergedState = { ...ctx.state, extras: mergedExtras, etapa_funil: patch.etapa_funil ?? ctx.state.etapa_funil };
    const nextStage = decideGreenStage(mergedState, ctx.message, !!ctx.media, (ctx.state as any).document_status ?? null);
    if (nextStage !== stage) {
      events.push({ type: "green_stage_advanced", priority: "low", source: "specialist",
        payload: { from: stage, to: nextStage } });
      stage = nextStage;
    }
  }

  // Handoff humano: IA silencia (sem texto).
  const text = stage === "handoff_human" ? "" : await generateText(ctx, stage);

  return {
    messages: text ? [text] : [],
    events,
    tool_calls,
    suggested_state_patch: patch,
  };
}

function extractConsumo(msg: string): string | null {
  if (!msg) return null;
  const m = msg.match(/(\d{2,5})\s*(kwh|kw|reais|r\$|\$|conta)?/i);
  return m ? m[0].trim() : null;
}

const UF_SET = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);
const ESTADO_NOMES: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amapá":"AP","amazonas":"AM","bahia":"BA",
  "ceara":"CE","ceará":"CE","distrito federal":"DF","espirito santo":"ES","espírito santo":"ES",
  "goias":"GO","goiás":"GO","maranhao":"MA","maranhão":"MA","mato grosso":"MT",
  "mato grosso do sul":"MS","minas gerais":"MG","para":"PA","pará":"PA","paraiba":"PB",
  "paraíba":"PB","parana":"PR","paraná":"PR","pernambuco":"PE","piaui":"PI","piauí":"PI",
  "rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS",
  "rondonia":"RO","rondônia":"RO","roraima":"RR","santa catarina":"SC",
  "sao paulo":"SP","são paulo":"SP","sergipe":"SE","tocantins":"TO",
};
function extractEstado(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim();
  if (!t) return null;
  const upper = t.toUpperCase().replace(/[^A-Z]/g, "");
  if (upper.length === 2 && UF_SET.has(upper)) return upper;
  const lower = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [name, uf] of Object.entries(ESTADO_NOMES)) {
    if (lower.includes(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return uf;
  }
  return null;
}

function extractDistribuidora(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim();
  if (t.length < 2 || t.length > 60) return null;
  // Aceita nome livre da distribuidora (texto sem números longos).
  if (/^\d+$/.test(t)) return null;
  return t;
}

function extractFirstName(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim().replace(/[^\p{L}\s]/gu, "");
  if (!t) return null;
  const first = t.split(/\s+/)[0];
  if (first.length < 2 || first.length > 30) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

async function generateText(ctx: AgentContext, stage: string): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) return fallbackText(stage);

  // Modelo: usa lite (mais barato e sem thinking pesado). Sempre desliga
  // thinkingBudget para evitar que tokens de raciocínio consumam o
  // maxOutputTokens e produzam texto truncado nas respostas curtas.
  const model = (ctx as any).selected_model || "gemini-2.5-flash-lite";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: GREEN_SYSTEM }] },
          contents: [{
            role: "user",
            parts: [{ text: buildGreenUserPrompt({
              stage: stage as any,
              message: ctx.message,
              produto: ctx.state.produto,
              extras: (ctx.state.extras ?? {}) as Record<string, unknown>,
              last_ai_question: (ctx.state as any).last_ai_question ?? null,
              turn_index: (ctx.state as any).turn_index ?? undefined,
            }) }],
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    clearTimeout(timer);
    if (!res.ok) return fallbackText(stage);
    const json = await res.json();
    const txt = (json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    return txt || fallbackText(stage);
  } catch {
    clearTimeout(timer);
    return fallbackText(stage);
  }
}

function fallbackText(stage: string): string {
  switch (stage) {
    case "greet": return "Olá! Como posso te ajudar hoje?";
    case "explain_solution": return "A Igreen te dá economia na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Quer entender melhor como funciona?";
    case "send_video": return "Vou te mandar um vídeo curtinho explicando como funciona, dá uma olhada quando puder.";
    case "engage_check": return "Faz sentido pra você, quer que eu te mostre quanto dá pra economizar?";
    case "ask_consumo": return "Show! Pra te mostrar a economia, quanto vem em média na sua conta de luz por mês?";
    case "ask_estado": return "Perfeito. E em qual estado você está?";
    case "ask_distribuidora": return "Beleza. Qual é a sua distribuidora de energia?";
    case "ask_name": return "Pra ficar mais fácil, como posso te chamar?";
    case "request_invoice": return "Agora me manda sua última fatura (PDF ou foto)? Assim eu calculo sua economia exata.";
    case "waiting_invoice": return "Perfeito, fico no aguardo da fatura.";
    case "ask_full_name_cpf": return "Pra preparar seu contrato, me passa por favor seu nome completo e CPF?";
    case "simulate_discount": return "Com base na sua distribuidora e estado, conseguimos aplicar a faixa oficial de economia da iGreen. Posso seguir com o cálculo exato a partir da sua última fatura?";
    case "ask_valor_fatura": return "Você lembra qual o valor médio da sua conta de luz por mês, em reais?";
    case "intent_send_invoice_ack": return "Combinado, fico no aguardo da sua fatura.";
    case "request_identity": return "Sua fatura foi validada com sucesso. Para concluirmos, por favor me envie uma foto do RG ou CNH do titular da conta.";
    case "validate_identity": return "Recebi seu documento, estou conferindo aqui.";
    case "family_authorization_check": return "Notei que a conta está em nome de outra pessoa. O titular é alguém da sua família e você tem autorização para seguir com a contratação?";
    case "objection_security": return "Entendo sua preocupação, é totalmente compreensível.\n\nSe preferir, podemos te enviar o link do aplicativo oficial da iGreen para você fazer o cadastro por conta própria. Quer que eu te envie?";
    default: return "Beleza!";
  }
}