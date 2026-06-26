// D1 + D3 — Supervisor classifica intent/specialist via Gemini.
// Timeout hard de 8s. Em timeout ou erro → specialist:"failsafe".

import type { IgreenConversationState } from "../types.ts";
import { trace } from "../observability/trace.ts";
import { auditDecision } from "../observability/behavior-audit.ts";
import { SUPERVISOR_SYSTEM_PROMPT, buildSupervisorUserPrompt } from "./prompt.ts";
import { openAIJsonFallback } from "../../_shared/ai-fallback/index.ts";

const SUPERVISOR_TIMEOUT_MS = 8000;
const VALID_SPECIALISTS = new Set(["green", "telecom", "expansao", "qualifier", "failsafe"]);
// Specialists que podem manter o turno em fallback "sticky" (continuidade de fluxo).
const STICKY_SPECIALISTS = new Set(["green", "telecom", "expansao", "qualifier"]);

export interface SupervisorDecision {
  intent: string;
  specialist: string;
  confidence: number;
  source: "llm" | "timeout" | "error" | "low_confidence" | "low_confidence_sticky" | "openai_fallback";
}

export async function decideSupervisor(args: {
  account_id: string;
  phone: string;
  message: string;
  state: Pick<IgreenConversationState, "produto" | "specialist" | "etapa_funil">;
  last_ai_question?: string | null;
  correlation_id?: string | null;
}): Promise<SupervisorDecision> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const currentSpecialist = (args.state as any)?.specialist ?? null;
  const etapaFunil = (args.state as any)?.etapa_funil ?? null;
  const lastAiQ = args.last_ai_question ?? null;
  const auditBase = {
    account_id: args.account_id, phone: args.phone,
    correlation_id: args.correlation_id ?? null,
    specialist_before: currentSpecialist,
    conversation_snapshot: {
      message: (args.message ?? "").slice(0, 500),
      etapa_funil: etapaFunil,
      last_ai_question: (lastAiQ ?? "").slice(0, 300),
      produto: args.state.produto ?? null,
    },
  };
  if (!apiKey) {
    auditDecision({ ...auditBase, specialist_after: "failsafe", intent: "other",
      confidence: 0, decision_source: "error", trigger_reason: "missing GOOGLE_GEMINI_API_KEY" });
    return { intent: "other", specialist: "failsafe", confidence: 0, source: "error" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPERVISOR_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUPERVISOR_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildSupervisorUserPrompt(
            args.message,
            args.state.produto,
            { current_specialist: currentSpecialist, last_ai_question: lastAiQ, etapa_funil: etapaFunil },
          ) }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      await trace({ account_id: args.account_id, phone: args.phone, step: "supervisor.http_error",
        level: "standard", duration_ms: Date.now() - t0, payload: { status: res.status } });
      const fb = await tryOpenAIFallback({
        message: args.message, produto: args.state.produto,
        currentSpecialist, lastAiQ, etapaFunil,
        ctx: { account_id: args.account_id, phone: args.phone, correlation_id: args.correlation_id, reason: `gemini_${res.status}` },
      });
      if (fb) {
        await trace({ account_id: args.account_id, phone: args.phone, step: "supervisor.openai_fallback",
          level: "standard", duration_ms: Date.now() - t0, payload: { from: `gemini_${res.status}`, ...fb } });
        auditDecision({ ...auditBase, specialist_after: fb.specialist, intent: fb.intent,
          confidence: fb.confidence, decision_source: "llm", trigger_reason: `openai_fallback_http_${res.status}` });
        return { ...fb, source: "openai_fallback" };
      }
      auditDecision({ ...auditBase, specialist_after: "failsafe", intent: "other",
        confidence: 0, decision_source: "error", trigger_reason: `http_${res.status}` });
      return { intent: "other", specialist: "failsafe", confidence: 0, source: "error" };
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = safeParse(text);

    const intent = typeof parsed.intent === "string" ? parsed.intent : "other";
    let specialist = typeof parsed.specialist === "string" ? parsed.specialist : "failsafe";
    const confidence = Number(parsed.confidence ?? 0);

    if (!VALID_SPECIALISTS.has(specialist)) specialist = "failsafe";

    if (confidence < 0.5) {
      // Sticky specialist: se a conversa já tem um specialist ativo de fluxo,
      // não derruba para failsafe (evita handoff em respostas curtas legítimas).
      if (currentSpecialist && STICKY_SPECIALISTS.has(String(currentSpecialist).toLowerCase())) {
        await trace({
          account_id: args.account_id, phone: args.phone,
          step: "supervisor.low_confidence_sticky",
          level: "standard", duration_ms: Date.now() - t0,
          payload: { intent, specialist_llm: specialist, sticky_to: currentSpecialist, confidence },
        });
        auditDecision({ ...auditBase, specialist_after: String(currentSpecialist),
          intent, confidence, decision_source: "low_confidence_sticky",
          trigger_reason: `sticky_to=${currentSpecialist} llm_said=${specialist}` });
        return {
          intent: intent || "other",
          specialist: String(currentSpecialist),
          confidence,
          source: "low_confidence_sticky",
        };
      }
      // Conversa nova (sem specialist ativo): não jogar para failsafe.
      // O default de roteamento é o qualifier, que apresenta o menu de produtos.
      // Failsafe só é acionado quando o cliente pede handoff explicitamente
      // (intent === "handoff_request") ou em erro/timeout do supervisor.
      if (!currentSpecialist && intent !== "handoff_request") {
        await trace({
          account_id: args.account_id, phone: args.phone,
          step: "supervisor.low_confidence_default_qualifier",
          level: "standard", duration_ms: Date.now() - t0,
          payload: { intent, specialist_llm: specialist, confidence },
        });
        auditDecision({ ...auditBase, specialist_after: "qualifier",
          intent: intent || "greeting", confidence, decision_source: "low_confidence",
          trigger_reason: `no_current_specialist confidence<0.5 llm_said=${specialist}` });
        return {
          intent: intent || "greeting",
          specialist: "qualifier",
          confidence,
          source: "low_confidence",
        };
      }
      await trace({ account_id: args.account_id, phone: args.phone, step: "supervisor.low_confidence",
        level: "standard", duration_ms: Date.now() - t0, payload: { intent, specialist, confidence } });
      auditDecision({ ...auditBase, specialist_after: "failsafe",
        intent, confidence, decision_source: "low_confidence",
        trigger_reason: `confidence<0.5 llm_said=${specialist}` });
      return { intent, specialist: "failsafe", confidence, source: "low_confidence" };
    }

    await trace({ account_id: args.account_id, phone: args.phone, step: "supervisor.decided",
      level: "standard", duration_ms: Date.now() - t0, payload: { intent, specialist, confidence } });

    auditDecision({ ...auditBase, specialist_after: specialist,
      intent, confidence, decision_source: "llm", trigger_reason: "ok" });
    return { intent, specialist, confidence, source: "llm" };
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error).name === "AbortError";
    await trace({
      account_id: args.account_id, phone: args.phone,
      step: aborted ? "supervisor.timeout" : "supervisor.error",
      level: "standard", duration_ms: Date.now() - t0,
      payload: { error: (e as Error).message, timeout_ms: SUPERVISOR_TIMEOUT_MS },
    });
    const fb = await tryOpenAIFallback({
      message: args.message, produto: args.state.produto,
      currentSpecialist, lastAiQ, etapaFunil,
      ctx: { account_id: args.account_id, phone: args.phone, correlation_id: args.correlation_id,
        reason: aborted ? "gemini_timeout" : "gemini_error" },
    });
    if (fb) {
      await trace({ account_id: args.account_id, phone: args.phone, step: "supervisor.openai_fallback",
        level: "standard", duration_ms: Date.now() - t0,
        payload: { from: aborted ? "timeout" : "error", ...fb } });
      auditDecision({ ...auditBase, specialist_after: fb.specialist, intent: fb.intent,
        confidence: fb.confidence, decision_source: "llm",
        trigger_reason: `openai_fallback_${aborted ? "timeout" : "error"}` });
      return { ...fb, source: "openai_fallback" };
    }
    auditDecision({ ...auditBase, specialist_after: "failsafe", intent: "other",
      confidence: 0, decision_source: aborted ? "timeout" : "error",
      trigger_reason: (e as Error).message?.slice(0, 200) ?? "" });
    return {
      intent: "other", specialist: "failsafe", confidence: 0,
      source: aborted ? "timeout" : "error",
    };
  }
}

function safeParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return {};
}

/** Tenta classificar via OpenAI quando o Gemini falhar. Retorna null se indisponível/erro. */
async function tryOpenAIFallback(args: {
  message: string;
  produto: string | null | undefined;
  currentSpecialist: string | null;
  lastAiQ: string | null;
  etapaFunil: string | null;
  ctx: { account_id?: string; phone?: string; correlation_id?: string | null; reason: string };
}): Promise<{ intent: string; specialist: string; confidence: number } | null> {
  const userPrompt = buildSupervisorUserPrompt(
    args.message,
    args.produto ?? null,
    {
      current_specialist: args.currentSpecialist,
      last_ai_question: args.lastAiQ,
      etapa_funil: args.etapaFunil,
    },
  ) + "\n\nResponda em JSON.";
  const fb = await openAIJsonFallback({
    systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
    userPrompt,
    model: "gpt-4o-mini",
    maxTokens: 200,
    ctx: args.ctx,
  });
  if (!fb) return null;
  const intent = typeof fb.parsed.intent === "string" ? fb.parsed.intent as string : "other";
  let specialist = typeof fb.parsed.specialist === "string" ? fb.parsed.specialist as string : "failsafe";
  const confidence = Number(fb.parsed.confidence ?? 0);
  if (!VALID_SPECIALISTS.has(specialist)) specialist = "failsafe";
  return { intent, specialist, confidence };
}