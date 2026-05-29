// ConversationRunner — simula turnos contra runGreen sem chamar transport nem persistir.
// Permite mockLLM determinístico (rápido) ou modo "live" usando Gemini real via runGreen.

import type { IgreenConversationState } from "../types.ts";
import { decideGreenStage, isAffirmation, type GreenStage } from "../agents/green/stages.ts";
import { runGreen } from "../agents/green/run.ts";
import { runQualifier } from "../agents/qualifier/run.ts";
import { decideQualifierStage, type QualifierStage } from "../agents/qualifier/stages.ts";
import {
  MENU_TEXT, MENU_SHORT_TEXT, GREET_OPEN_TEXT,
  ROUTE_GREEN_TEXT, ROUTE_TELECOM_TEXT, ROUTE_EXPANSAO_TEXT,
} from "../agents/qualifier/prompt.ts";
import type { Turn } from "./assertions.ts";

export interface ScenarioStep {
  user: string;
  media?: { url: string; mime_type: string; byte_size: number } | null;
}

export interface RunnerOptions {
  account_id?: string;
  phone?: string;
  initialState?: Partial<IgreenConversationState>;
  mockGreen?: boolean; // true = não chama Gemini; gera texto via fallback determinístico
}

// Templates determinísticos espelhando os fallbacks reais de run.ts
const MOCK_TEXTS: Record<GreenStage, string> = {
  greet: "Olá! Como posso te ajudar hoje?",
  explain_solution: "A Igreen te dá economia na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Quer entender melhor como funciona?",
  send_video: "Vou te mandar um vídeo curtinho explicando como funciona, dá uma olhada quando puder.",
  engage_check: "Faz sentido pra você, quer que eu te mostre quanto dá pra economizar?",
  ask_consumo: "Show! Pra te mostrar a economia, quanto vem em média na sua conta de luz por mês?",
  ask_estado: "Perfeito. E em qual estado você está?",
  ask_distribuidora: "Beleza. Qual é a sua distribuidora de energia?",
  ask_cidade: "(deprecado — nunca usado)",
  ask_name: "Pra ficar mais fácil, como posso te chamar?",
  request_invoice: "Agora me manda sua última fatura (PDF ou foto)? Assim eu calculo sua economia exata.",
  waiting_invoice: "Perfeito, fico no aguardo da fatura.",
  validate_invoice: "Recebi sua fatura, tô conferindo aqui rapidinho.",
  soft_confirm_ask: "Confirma pra mim: o titular da conta é você mesmo?",
  ask_full_name_cpf: "Pra preparar seu contrato, me passa por favor seu nome completo e CPF?",
  idle: "Beleza!",
};

function applyPatch(state: IgreenConversationState, patch: Partial<IgreenConversationState>): IgreenConversationState {
  const next = { ...state, ...patch };
  if (patch.extras !== undefined) {
    next.extras = { ...(state.extras ?? {}), ...(patch.extras as Record<string, unknown>) };
  }
  // Espelha lógica leve do state-engine para etapa_funil quando set_product é chamado
  return next;
}

export async function runScenario(steps: ScenarioStep[], opts: RunnerOptions = {}): Promise<Turn[]> {
  const account_id = opts.account_id ?? "00000000-0000-0000-0000-000000000000";
  const phone = opts.phone ?? "5500000000000";
  let state: IgreenConversationState = {
    account_id, phone,
    produto: null, etapa_funil: "novo", specialist: null, intent: null,
    handoff_ativo: false, extras: {}, version: 1,
    ...(opts.initialState ?? {}),
  };

  const turns: Turn[] = [];

  for (const step of steps) {
    const etapa_funil_before = state.etapa_funil ?? null;
    // Dispatcher por specialist (mirroring real flow): qualifier antes de green.
    const currentSpec = (state.specialist ?? "").toLowerCase() || null;
    const useQualifier = !currentSpec || currentSpec === "qualifier";

    let messages: string[] = [];
    let toolCalls: Array<{ name: string; args: unknown }> = [];
    let patch: Partial<IgreenConversationState> = {};
    let events: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    let specialist = useQualifier ? "qualifier" : (currentSpec === "green" ? "green" : "green");
    let stage: string;

    if (useQualifier) {
      // Qualifier é 100% determinístico — sempre roda real.
      const qStage = decideQualifierStage(state, step.user) as QualifierStage;
      stage = qStage;
      const result = await runQualifier({
        account_id, phone, state, message: step.user,
        intent: undefined, correlation_id: null, media: step.media ?? null,
      });
      messages = result.messages;
      toolCalls = result.tool_calls;
      patch = result.suggested_state_patch;
      events = result.events.map((e) => ({ type: e.type, payload: e.payload }));
    } else if (opts.mockGreen) {
      let gStage = decideGreenStage(state, step.user, !!step.media, (state as any).document_status ?? null);
      stage = gStage;
      // Espelha tool_calls e patches críticos de run.ts sem custo de LLM
      const currentExtras = (state.extras ?? {}) as Record<string, unknown>;
      if (gStage === "greet") patch = { produto: "green", extras: { ...currentExtras, greeted: true } };
      if (gStage === "explain_solution") {
        const nextExtras: Record<string, unknown> = { ...currentExtras, explained: true };
        if (isAffirmation(step.user)) nextExtras.solution_confirmed = true;
        patch = { produto: "green", extras: nextExtras };
        toolCalls = [{ name: "set_product", args: { produto: "green" } }];
      }
      if (gStage === "send_video") {
        toolCalls = [{ name: "send_discovery_video", args: { produto: "green" } }];
        patch = { extras: { ...currentExtras, video_sent: true } };
        if ((state.etapa_funil ?? "novo").toLowerCase() === "novo") {
          patch.etapa_funil = "qualificacao";
          toolCalls.push({ name: "set_stage", args: { etapa: "qualificacao" } });
        }
      }
      if (gStage === "engage_check") {
        patch = { extras: { ...currentExtras, engaged: true } };
      }
      if (gStage === "ask_consumo") {
        const m = step.user.match(/\d{2,5}/);
        if (m) patch = { extras: { ...currentExtras, consumo_medio: m[0] } };
      }
      if (gStage === "ask_estado") {
        const upper = step.user.trim().toUpperCase().replace(/[^A-Z]/g, "");
        if (upper.length === 2) patch = { extras: { ...currentExtras, estado: upper } };
        else if (step.user.trim().length >= 3) patch = { extras: { ...currentExtras, estado: step.user.trim().slice(0, 30) } };
      }
      if (gStage === "ask_distribuidora") {
        const t = step.user.trim();
        if (t.length >= 2 && t.length <= 60 && !/^\d+$/.test(t)) patch = { extras: { ...currentExtras, distribuidora: t } };
      }
      if (gStage === "ask_name") {
        const t = step.user.trim().replace(/[^\p{L}\s]/gu, "").split(/\s+/)[0];
        if (t && t.length >= 2) patch = { extras: { ...currentExtras, client_name: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() } };
      }
      // Post-capture re-decision (espelha run.ts)
      const REDECIDABLE = new Set(["ask_consumo", "ask_estado", "ask_distribuidora"]);
      if (REDECIDABLE.has(gStage)) {
        const mergedExtras = (patch.extras as Record<string, unknown>) ?? currentExtras;
        const mergedState = { ...state, extras: mergedExtras, etapa_funil: patch.etapa_funil ?? state.etapa_funil } as IgreenConversationState;
        const next = decideGreenStage(mergedState, step.user, !!step.media, (state as any).document_status ?? null);
        if (next !== gStage) {
          // Mantém o stage original no log (para asserts de ordem),
          // mas usa a mensagem do próximo stage (acknowledge + next question).
          // Side-effects do novo stage (engaged/video_sent/tools de stages terminais)
          if (next === "send_video") {
            const e = (patch.extras as Record<string, unknown>) ?? currentExtras;
            patch = { ...patch, extras: { ...e, video_sent: true } };
            toolCalls.push({ name: "send_discovery_video", args: { produto: "green" } });
          }
          if (next === "request_invoice") {
            toolCalls.push({ name: "request_invoice", args: { reason: "calculo_economia" } });
          }
          gStage = next;
        }
      }
      messages = [MOCK_TEXTS[gStage]];
      events = [{ type: "green_stage_decided", payload: { stage: gStage } }];
      specialist = "green";
    } else {
      const gStage = decideGreenStage(state, step.user, !!step.media, (state as any).document_status ?? null);
      stage = gStage;
      const result = await runGreen({
        account_id, phone, state, message: step.user,
        intent: undefined, correlation_id: null,
        media: step.media ?? null,
      });
      messages = result.messages;
      toolCalls = result.tool_calls;
      patch = result.suggested_state_patch;
      events = result.events.map((e) => ({ type: e.type, payload: e.payload }));
      specialist = "green";
    }

    // Espelhar set_stage explícito (novo → qualificacao via promoção determinística)
    const setStage = toolCalls.find((t) => t.name === "set_stage") as any;
    if (setStage?.args?.etapa) {
      patch = { ...patch, etapa_funil: setStage.args.etapa };
    }

    state = applyPatch(state, patch);

    turns.push({
      user: step.user, stage, specialist,
      intent: "ask_info", confidence: 1.0, source: "mock",
      messages, patch: patch as Record<string, unknown>, events,
      etapa_funil_before, etapa_funil_after: state.etapa_funil ?? null,
      extras_after: (state.extras ?? {}) as Record<string, unknown>,
      handoff_ativo: !!state.handoff_ativo,
    });
  }

  return turns;
}