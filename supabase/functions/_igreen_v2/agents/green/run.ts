// Green Specialist — versão minimalista (Fase 3).
// Cobre: descoberta → vídeo → qualificação simples → solicitar fatura.
// LLM só preenche texto curto. Stage e tool_calls são decididos em código (D1).

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideGreenStage } from "./stages.ts";
import { GREEN_SYSTEM, buildGreenUserPrompt } from "./prompt.ts";

const LLM_TIMEOUT_MS = 8000;

export async function runGreen(ctx: AgentContext): Promise<AgentResult> {
  const stage = decideGreenStage(ctx.state, ctx.message);
  const text = await generateText(ctx, stage);

  const tool_calls: AgentResult["tool_calls"] = [];
  const events: AgentResult["events"] = [
    { type: "green_stage_decided", priority: "low", source: "specialist", payload: { stage } },
  ];
  const patch: AgentResult["suggested_state_patch"] = {};

  if (stage === "discovery") {
    // ainda em "novo"; deixa o supervisor/tool set_product mover etapa.
    patch.produto = "green";
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

  return {
    messages: text ? [text] : [],
    events,
    tool_calls,
    suggested_state_patch: patch,
  };
}

async function generateText(ctx: AgentContext, stage: string): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) return fallbackText(stage);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
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
    case "discovery": return "Olá! Tudo bem? Como posso te chamar?";
    case "send_video": return "Vou te mandar um vídeo curtinho explicando como funciona.";
    case "qualify": return "Pra te ajudar melhor: qual sua cidade e quanto vem de luz por mês?";
    case "request_invoice": return "Me manda a sua última fatura (PDF ou foto)? Assim consigo calcular sua economia.";
    case "waiting_invoice": return "Perfeito, fico no aguardo da fatura.";
    default: return "Beleza!";
  }
}