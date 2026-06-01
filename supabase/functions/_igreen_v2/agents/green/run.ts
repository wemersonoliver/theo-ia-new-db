// Green Specialist — versão minimalista (Fase 3).
// Cobre: descoberta → vídeo → qualificação simples → solicitar fatura.
// LLM só preenche texto curto. Stage e tool_calls são decididos em código (D1).

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideGreenStage, isAffirmation, detectFaqTopic } from "./stages.ts";
import { GREEN_SYSTEM, buildGreenUserPrompt } from "./prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LLM_TIMEOUT_MS = 8000;

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function listDistributors(state: string): Promise<Array<{distributor: string; min: number; max: number}>> {
  try {
    const { data } = await svc()
      .from("igreen_distributor_discounts")
      .select("distributor,discount_min_percent,discount_max_percent")
      .eq("state", state)
      .eq("enabled", true)
      .order("distributor");
    return (data ?? []).map((r: any) => ({
      distributor: r.distributor,
      min: Number(r.discount_min_percent ?? 0),
      max: Number(r.discount_max_percent ?? 0),
    }));
  } catch (e) {
    console.error("[green] listDistributors failed", e);
    return [];
  }
}

function parseValor(msg: string): number | null {
  if (!msg) return null;
  const cleaned = msg.replace(/r\$/gi, "").replace(/reais?/gi, "");
  const m = cleaned.match(/(\d{2,6}(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const num = Number.parseFloat(m[1].replace(".", "").replace(",", "."));
  if (!Number.isFinite(num) || num <= 0 || num > 100000) return null;
  return num;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  let deterministicText: string | null = null;

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
    // Se o cliente respondeu em reais (R$/reais), também já preenchemos valor_fatura
    // para evitar perguntar de novo no próximo passo.
    if (/\b(r\$|reais?)\b/i.test(ctx.message)) {
      const v = parseValor(ctx.message);
      if (v) {
        patch.extras = {
          ...(patch.extras as object ?? currentExtras),
          valor_fatura: v,
        };
        tool_calls.push({
          name: "save_green_lead_field",
          args: { field: "valor_fatura", value: String(v) },
        });
      }
    }
  }

  if (stage === "engage_check") {
    // Marca engaged=true para destravar coleta de dados no próximo turno,
    // independentemente da resposta — o objetivo é dar respiro humano entre
    // o vídeo e o início da qualificação.
    patch.extras = { ...currentExtras, engaged: true };
    // Resposta do cliente APÓS o vídeo → adiciona tag "em atendimento",
    // o que move o card no CRM de "Novo Lead" para "Iniciou atendimento".
    if (!currentExtras.atendimento_started) {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        atendimento_started: true,
      };
      tool_calls.push({
        name: "add_contact_tag",
        args: { tag: "em atendimento" },
      });
    }
  }

  if (stage === "ask_estado") {
    const uf = extractEstado(ctx.message);
    if (uf) patch.extras = { ...currentExtras, estado: uf };
  }

  if (stage === "present_distributors") {
    const estado = (currentExtras.estado as string | undefined) ?? "";
    const list = estado ? await listDistributors(estado) : [];
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    if (list.length === 0) {
      deterministicText = `${nome ? nome + ", " : ""}me confirma só uma coisa: qual é a sua distribuidora de energia?`;
    } else if (list.length === 1) {
      deterministicText = `No seu estado trabalhamos com a ${list[0].distributor}. Essa é a sua distribuidora atual? 😊`;
    } else {
      const opts = list.map((d, i) => `${i + 1} - ${d.distributor}`).join("\n");
      deterministicText = `No seu estado trabalhamos com:\n\n${opts}\n\nQual dessas é a sua?`;
    }
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      distributors_presented: true,
      distributors_options: list.map((d) => d.distributor),
    };
  }

  if (stage === "ask_distribuidora") {
    const opts = (currentExtras.distributors_options as string[] | undefined) ?? [];
    const msg = ctx.message.trim();
    let chosen: string | null = null;
    // 1) resposta numérica (1, 2, 3…)
    const numMatch = msg.match(/^\s*(\d{1,2})\b/);
    if (numMatch && opts.length > 0) {
      const idx = Number(numMatch[1]) - 1;
      if (idx >= 0 && idx < opts.length) chosen = opts[idx];
    }
    // 2) match parcial pelo nome
    if (!chosen && opts.length > 0) {
      const low = msg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      chosen = opts.find((o) => {
        const ol = o.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return low.includes(ol) || ol.includes(low);
      }) ?? null;
    }
    // 3) lista de 1 + afirmação → assume essa
    if (!chosen && opts.length === 1 && isAffirmation(msg)) chosen = opts[0];
    // 4) fallback: texto livre
    if (!chosen) {
      const d = extractDistribuidora(ctx.message);
      if (d && opts.length === 0) chosen = d;
    }
    if (chosen) {
      patch.extras = { ...(patch.extras as object ?? currentExtras), distribuidora: chosen };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "distribuidora", value: chosen },
      });
    }
  }

  if (stage === "ask_valor_fatura") {
    const valor = parseValor(ctx.message);
    if (valor) {
      patch.extras = { ...(patch.extras as object ?? currentExtras), valor_fatura: valor };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "valor_fatura", value: String(valor) },
      });
    }
  }

  if (stage === "simulate_discount_concreto") {
    const estado = (currentExtras.estado as string | undefined) ?? "";
    const distribuidora = (currentExtras.distribuidora as string | undefined) ?? "";
    const valor = Number(currentExtras.valor_fatura ?? 0);
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Busca faixa oficial
    let min = 0, max = 0;
    if (estado && distribuidora) {
      const list = await listDistributors(estado);
      const found = list.find((d) =>
        d.distributor.toLowerCase().includes(distribuidora.toLowerCase()) ||
        distribuidora.toLowerCase().includes(d.distributor.toLowerCase()));
      if (found) { min = found.min; max = found.max; }
    }
    if (min > 0 && max > 0 && valor > 0) {
      const economia = (valor * max) / 100;
      deterministicText =
`Olha só${nome ? `, ${nome}` : ""}! Pra ${distribuidora} a média de desconto fica entre ${min}% e ${max}%. Numa conta de R$ ${formatBRL(valor)}, seu desconto pode chegar a R$ ${formatBRL(economia)} todo mês. 🤑

E não é só isso: depois do seu cadastro, você ainda pode chegar a zerar sua conta de luz indicando novos assinantes pelo nosso programa de cashback.

Bora fazer seu cadastro agora? Pra iniciar a verificação do seu cadastro, só preciso de uma foto ou PDF da sua última fatura. 😉`;
    } else {
      deterministicText = `${nome ? nome + ", " : ""}com a ${distribuidora || "sua distribuidora"} a iGreen tem uma faixa oficial de economia. Me envia uma foto ou PDF da sua última fatura pra eu iniciar a verificação do seu cadastro. 😊`;
    }
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      discount_lookup_done: true,
      discount_min_percent: min || null,
      discount_max_percent: max || null,
    };
    // Log oficial via tool (mantém compat)
    if (estado && distribuidora) {
      tool_calls.push({
        name: "get_distributor_discount",
        args: { state: estado, distributor: distribuidora },
      });
    }
  }

  if (stage === "intent_send_invoice_ack") {
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      intent_send_invoice: true,
      invoice_search_ack: true,
      invoice_search_ack_at: new Date().toISOString(),
    };
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
    // IA silencia neste turno — o texto final (aprovação/pedido de RG OU rejeição)
    // é gerado pelo orquestrador APÓS o resultado da tool, evitando "tô conferindo".
    deterministicText = "";
  }

  if (stage === "invoice_rejected_reply") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Mensagem por motivo conhecido (último evento). Fallback genérico.
    const lastReason = (ctx.state as any).last_media_reject_reason
      ?? (currentExtras.last_media_reject_reason as string | undefined)
      ?? null;
    let body = "Não consegui abrir o arquivo da fatura aqui. Pode reenviar como PDF ou foto nítida da última conta?";
    if (lastReason === "invalid_mime") {
      body = "Esse formato não abre aqui. Pode mandar a fatura como PDF ou foto (jpg/png)?";
    } else if (lastReason === "too_small") {
      body = "O arquivo chegou muito pequeno e não consegui ler. Pode mandar a fatura em PDF ou uma foto nítida?";
    } else if (lastReason === "too_large") {
      body = "O arquivo ficou muito pesado. Pode reenviar uma foto da fatura ou um PDF menor (até 10MB)?";
    } else if (lastReason === "reject_unreadable" || lastReason === "reject_low_confidence") {
      body = "A foto da fatura ficou um pouco baixa. Pode mandar de novo mostrando o nome do titular e o consumo, por favor?";
    } else if (lastReason === "reject_not_invoice") {
      body = "O arquivo que recebi não parece ser a fatura de energia. Pode me enviar a última conta de luz (PDF ou foto)?";
    }
    deterministicText = `${nome ? nome + ", " : ""}${body}`;
    // Reseta document_status para destravar próxima validação e marca que já avisamos.
    (patch as any).document_status = null;
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      invoice_rejected_notified: true,
      invoice_rejected_notified_at: new Date().toISOString(),
    };
  }

  if (stage === "faq_answer") {
    const topic = detectFaqTopic(ctx.message);
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const valor = Number(currentExtras.valor_fatura ?? 0);
    const distribuidora = (currentExtras.distribuidora as string | undefined) ?? "";
    // Determina o CTA pendente para amarrar a resposta da FAQ ao próximo passo.
    const faturaPedida = !!currentExtras.discount_lookup_done || (ctx.state.etapa_funil ?? "") === "fatura_enviada";
    const cta = faturaPedida
      ? "Pra eu iniciar a verificação do seu cadastro, me manda uma foto ou PDF da sua última fatura, pode ser?"
      : "Quer que eu te mostre quanto dá pra economizar?";
    let answer = "";
    switch (topic) {
      case "cashback":
        answer = "Funciona assim: cada novo assinante que entrar pela sua indicação te devolve uma parte da fatura dele em cashback todo mês. Quanto mais indicações ativas, mais sua própria conta de luz vai pra perto de zero.";
        break;
      case "cancelar":
        answer = "Você pode sair quando quiser, sem multa nem burocracia. É só avisar a iGreen e o cancelamento é feito.";
        break;
      case "fidelidade":
        answer = "Não tem fidelidade nem multa. Você fica enquanto for bom pra você.";
        break;
      case "instalacao":
        answer = "Não precisa de obra nem instalar nada. A energia continua chegando pela mesma distribuidora, só que com desconto da iGreen aplicado direto na fatura.";
        break;
      case "prazo":
        answer = "Depois do cadastro aprovado, o desconto costuma aparecer já na próxima fatura ou na seguinte, dependendo do ciclo da distribuidora.";
        break;
      case "seguro":
        answer = "É 100% seguro. A iGreen é uma empresa registrada, com mais de 200 mil clientes, e seus dados são usados só pra aplicar o desconto na sua conta.";
        break;
      case "como_funciona":
      default:
        answer = distribuidora
          ? `Funciona simples${nome ? `, ${nome}` : ""}: a iGreen aplica um desconto da faixa oficial da ${distribuidora} direto na sua fatura, sem obra e sem trocar de distribuidora.`
          : "Funciona simples: a iGreen aplica um desconto da faixa oficial da sua distribuidora direto na fatura, sem obra e sem trocar de distribuidora.";
    }
    const prefix = nome && topic !== "como_funciona" ? `${nome}, ` : "";
    deterministicText = valor > 0 && topic === "cashback"
      ? `${prefix}${answer}\n\n${cta}`
      : `${prefix}${answer}\n\n${cta}`;
    // FAQ não muda etapa/extras de qualificação.
  }

  // Post-capture re-decision: se acabamos de capturar um dado em extras,
  // re-decidimos o stage para evitar repetir a pergunta no próximo turno.
  // Não aplicamos para stages que disparam tool_calls (send_video/validate_invoice/request_invoice)
  // — esses precisam manter o stage original.
  const STAGES_REDECIDABLE = new Set(["ask_consumo", "ask_estado", "ask_distribuidora", "ask_valor_fatura"]);
  if (STAGES_REDECIDABLE.has(stage)) {
    const mergedExtras = (patch.extras as Record<string, unknown>) ?? currentExtras;
    const mergedState = { ...ctx.state, extras: mergedExtras, etapa_funil: patch.etapa_funil ?? ctx.state.etapa_funil };
    const nextStage = decideGreenStage(mergedState, ctx.message, !!ctx.media, (ctx.state as any).document_status ?? null);
    if (nextStage !== stage) {
      events.push({ type: "green_stage_advanced", priority: "low", source: "specialist",
        payload: { from: stage, to: nextStage } });
      stage = nextStage;
      // Tool wiring para os stages alcançados por redecide.
      if (stage === "present_distributors") {
        const estado = (mergedExtras.estado as string | undefined) ?? "";
        const list = estado ? await listDistributors(estado) : [];
        const nome = (mergedExtras.client_name as string | undefined) ?? "";
        if (list.length === 0) {
          deterministicText = `${nome ? nome + ", " : ""}me confirma só uma coisa: qual é a sua distribuidora de energia?`;
        } else if (list.length === 1) {
          deterministicText = `No seu estado trabalhamos com a ${list[0].distributor}. Essa é a sua distribuidora atual? 😊`;
        } else {
          const opts = list.map((d, i) => `${i + 1} - ${d.distributor}`).join("\n");
          deterministicText = `No seu estado trabalhamos com:\n\n${opts}\n\nQual dessas é a sua?`;
        }
        patch.extras = {
          ...(patch.extras as object ?? mergedExtras),
          distributors_presented: true,
          distributors_options: list.map((d) => d.distributor),
        };
      }
      if (stage === "simulate_discount_concreto") {
        const estado = (mergedExtras.estado as string | undefined) ?? "";
        const distribuidora = (mergedExtras.distribuidora as string | undefined) ?? "";
        const valor = Number(mergedExtras.valor_fatura ?? 0);
        const nome = (mergedExtras.client_name as string | undefined) ?? "";
        let min = 0, max = 0;
        if (estado && distribuidora) {
          const list = await listDistributors(estado);
          const found = list.find((d) =>
            d.distributor.toLowerCase().includes(distribuidora.toLowerCase()) ||
            distribuidora.toLowerCase().includes(d.distributor.toLowerCase()));
          if (found) { min = found.min; max = found.max; }
        }
        if (min > 0 && max > 0 && valor > 0) {
          const economia = (valor * max) / 100;
          deterministicText =
`Olha só${nome ? `, ${nome}` : ""}! Pra ${distribuidora} a média de desconto fica entre ${min}% e ${max}%. Numa conta de R$ ${formatBRL(valor)}, seu desconto pode chegar a R$ ${formatBRL(economia)} todo mês. 🤑

E não é só isso: depois do seu cadastro, você ainda pode chegar a zerar sua conta de luz indicando novos assinantes pelo nosso programa de cashback.

Bora fazer seu cadastro agora? Pra iniciar, só preciso de uma foto ou PDF da sua fatura. 😉`;
        } else {
          deterministicText = `${nome ? nome + ", " : ""}com a ${distribuidora || "sua distribuidora"} a iGreen tem uma faixa oficial de economia. Me envia uma foto ou PDF da sua última fatura que eu já calculo o valor exato. 😊`;
        }
        patch.extras = {
          ...(patch.extras as object ?? mergedExtras),
          discount_lookup_done: true,
          discount_min_percent: min || null,
          discount_max_percent: max || null,
        };
        if (estado && distribuidora) {
          tool_calls.push({
            name: "get_distributor_discount",
            args: { state: estado, distributor: distribuidora },
          });
        }
      }
    }
  }

  // Handoff humano: IA silencia (sem texto).
  const text = stage === "handoff_human"
    ? ""
    : deterministicText ?? await generateText(ctx, stage);

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
    case "send_autocadastro_link": return "Perfeito. Aqui está o link oficial do app iGreen para você fazer o cadastro com calma:\n\nhttps://app.igreen.com.br/autocadastro\n\nFico à disposição caso precise de ajuda em qualquer etapa.";
    case "handoff_human": return "";
    default: return "Beleza!";
  }
}