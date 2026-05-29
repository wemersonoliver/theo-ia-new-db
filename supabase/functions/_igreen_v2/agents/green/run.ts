// Green Specialist — versão minimalista (Fase 3).
// Cobre: descoberta → vídeo → qualificação simples → solicitar fatura.
// LLM só preenche texto curto. Stage e tool_calls são decididos em código (D1).

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideGreenStage, isAffirmation } from "./stages.ts";
import { GREEN_SYSTEM, buildGreenUserPrompt } from "./prompt.ts";

const LLM_TIMEOUT_MS = 8000;

export async function runGreen(ctx: AgentContext): Promise<AgentResult> {
  const stage = decideGreenStage(
    ctx.state, ctx.message,
    !!ctx.media, (ctx.state as any).document_status ?? null,
  );
  const text = await generateText(ctx, stage);

  const tool_calls: AgentResult["tool_calls"] = [];
  const events: AgentResult["events"] = [
    { type: "green_stage_decided", priority: "low", source: "specialist", payload: { stage } },
  ];
  const patch: AgentResult["suggested_state_patch"] = {};

  const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;

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

  if (stage === "ask_cidade") {
    // se a mensagem parecer uma cidade (texto curto sem números), salva
    const cidade = extractCidade(ctx.message);
    if (cidade) patch.extras = { ...(patch.extras as object ?? currentExtras), cidade };
  }

  if (stage === "ask_name") {
    const nome = extractFirstName(ctx.message);
    if (nome) patch.extras = { ...(patch.extras as object ?? currentExtras), client_name: nome };
  }

  if (stage === "send_video") {
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

function extractCidade(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim();
  if (t.length < 2 || t.length > 60) return null;
  if (/\d/.test(t)) return null;
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
            parts: [{ text: buildGreenUserPrompt({ stage: stage as any, message: ctx.message, produto: ctx.state.produto }) }],
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
    case "send_video": return "Vou te mandar um vídeo curtinho explicando como funciona.";
    case "ask_consumo": return "Pra eu te ajudar melhor, quanto vem em média na sua conta de luz por mês?";
    case "ask_cidade": return "Legal! E você mora em qual cidade?";
    case "ask_name": return "Pra ficar mais fácil, como posso te chamar?";
    case "request_invoice": return "Me manda sua última fatura (PDF ou foto)? Assim calculo sua economia exata.";
    case "waiting_invoice": return "Perfeito, fico no aguardo da fatura.";
    case "ask_full_name_cpf": return "Pra preparar seu contrato, me passa por favor seu nome completo e CPF?";
    default: return "Beleza!";
  }
}