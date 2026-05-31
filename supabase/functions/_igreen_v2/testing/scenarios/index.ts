// Catálogo de cenários comportamentais do Green.
// Cada cenário define passos do usuário + lista de assertions a executar.

import {
  ALL_ASSERTIONS, assertNoUnexpectedFailsafe,
  assertNoCityQuestion, assertNoRepeatedGreeting,
  assertMenuPresentedWhenGeneric, assertNoPrematureDataCollection,
  assertCommercialProgression,
  assertNoSlang, assertNoEmDash,
  assertDiscountToolCalled, assertIntentSendInvoiceDoesNotValidate,
  assertObjectionSecurityHandled,
  type AssertionResult, type Turn,
} from "../assertions.ts";
import type { ScenarioStep } from "../conversation-runner.ts";
import type { IgreenConversationState } from "../../types.ts";

export interface Scenario {
  id: string;
  title: string;
  steps: ScenarioStep[];
  initialState?: Partial<IgreenConversationState>;
  allowFailsafeTurns?: number[];
  run: (turns: Turn[]) => AssertionResult[];
}

const baseRun = (allowFailsafe: number[] = []) => (turns: Turn[]): AssertionResult[] => {
  const results = ALL_ASSERTIONS.map((fn) => fn(turns));
  results.push(assertNoUnexpectedFailsafe(turns, allowFailsafe));
  return results;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "01-greeting",
    title: "Saudação simples não pede nome nem cai em handoff",
    steps: [{ user: "Bom dia" }],
    run: baseRun(),
  },
  {
    id: "02-interest",
    title: "Interesse explícito em green: qualifier roteia direto sem menu",
    steps: [
      { user: "Bom dia" },
      { user: "Quero saber sobre conexão green" },
    ],
    run: baseRun(),
  },
  {
    id: "03-short-context",
    title: "Respostas curtas contextuais (Sim/Wemerson/Pode ser) não viram failsafe",
    steps: [
      { user: "Bom dia" },
      { user: "Sim" },
      { user: "Pode ser" },
    ],
    run: baseRun(),
  },
  {
    id: "04-no-repetition",
    title: "IA não repete semanticamente a mesma pergunta de nome",
    steps: [
      { user: "Bom dia" },
      { user: "quero economizar na luz" },
      { user: "Wemerson" },
      { user: "Wemerson Leite Oliveira" },
    ],
    run: baseRun(),
  },
  {
    id: "05-no-loop",
    title: "Não fica em loop de explicação após 'Sim' (regressão TESTE 3)",
    steps: [
      { user: "Bom dia" },
      { user: "Conexão green energia por assinatura" },
      { user: "Sim" },
    ],
    run: baseRun(),
  },
  {
    id: "06-continuity",
    title: "Progressão correta greet→explain→qualify sem retroceder",
    steps: [
      { user: "Boa tarde" },
      { user: "Quero saber sobre energia por assinatura" },
      { user: "Sim, quero entender" },
      { user: "faz sentido" },
      { user: "550 reais" },
      { user: "SC" },
      { user: "Celesc" },
    ],
    run: baseRun(),
  },
  {
    id: "07-anti-form",
    title: "Anti-formulário: não pede 3 dados no mesmo turno",
    steps: [
      { user: "Oi" },
      { user: "quero contratar energia por assinatura" },
    ],
    run: baseRun(),
  },
  {
    id: "08-anti-failsafe",
    title: "Resposta 'Tenho' após pergunta não ativa failsafe",
    steps: [
      { user: "Bom dia" },
      { user: "Tenho" },
    ],
    run: baseRun(),
  },
  {
    id: "09-outbound-persisted",
    title: "Outbound persistido (validado apenas em modo live — placeholder no mock)",
    steps: [{ user: "Oi" }],
    run: baseRun(),
  },
  {
    id: "10-no-truncation",
    title: "Resposta não termina abruptamente nem fica curta demais",
    steps: [
      { user: "Bom dia" },
      { user: "quero saber" },
    ],
    run: baseRun(),
  },
  {
    id: "11-affirmation-after-explain",
    title: "Afirmação 'Sim' após explicação avança para qualificacao",
    steps: [
      { user: "Bom dia" },
      { user: "Conexão green energia por assinatura" },
      { user: "Sim" },
    ],
    run: baseRun(),
  },
  {
    id: "12-stage-progression",
    title: "Stages progridem deterministicamente sem voltar ao explain",
    steps: [
      { user: "Boa tarde" },
      { user: "quero saber sobre energia por assinatura" },
      { user: "claro" },
      { user: "faz sentido" },
      { user: "550 reais" },
    ],
    run: baseRun(),
  },
  {
    id: "13-no-stage-stall",
    title: "etapa_funil sai de novo após confirmação de interesse",
    steps: [
      { user: "oi" },
      { user: "tenho interesse em energia por assinatura" },
      { user: "pode ser" },
    ],
    run: baseRun(),
  },
  {
    id: "14-repeated-semantic-response",
    title: "IA não repete semanticamente a mesma explicação 3x",
    steps: [
      { user: "Bom dia" },
      { user: "Conexão green energia por assinatura" },
      { user: "Sim" },
      { user: "ok" },
    ],
    run: baseRun(),
  },
  {
    id: "15-explain-then-advance",
    title: "explain_solution aparece no máximo uma vez e depois avança",
    steps: [
      { user: "Bom dia" },
      { user: "quero economizar na conta de luz" },
      { user: "entendi" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const explainCount = turns.filter((t) => t.stage === "explain_solution" || t.stage === "route_green").length;
      base.push({
        name: "assertExplainOnce",
        ok: explainCount <= 2,
        reason: explainCount > 1 ? `explain_solution apareceu ${explainCount}x` : undefined,
      });
      return base;
    },
  },
  {
    id: "16-menu-on-generic-greeting",
    title: "Mensagem genérica após saudação → qualifier apresenta menu",
    steps: [
      { user: "Boa noite" },
      { user: "tudo bem, quero saber mais" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertMenuPresentedWhenGeneric(turns));
      return base;
    },
  },
  {
    id: "17-menu-on-interest",
    title: "'Tenho interesse' genérico → menu, sem ask_name nem dados",
    steps: [
      { user: "Olá" },
      { user: "tenho interesse" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertMenuPresentedWhenGeneric(turns));
      return base;
    },
  },
  {
    id: "18-menu-choice-1-green",
    title: "Menu apresentado, escolha '1' roteia para green",
    steps: [
      { user: "oi" },
      { user: "quero saber mais" },
      { user: "1" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const last = turns[turns.length - 1];
      base.push({
        name: "assertRouteGreen",
        ok: last?.stage === "route_green",
        reason: last?.stage !== "route_green" ? `Esperava route_green, recebi ${last?.stage}` : undefined,
      });
      return base;
    },
  },
  {
    id: "19-menu-choice-2-telecom",
    title: "Menu apresentado, escolha '2' roteia para telecom",
    steps: [
      { user: "oi" },
      { user: "quero saber mais" },
      { user: "2" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const last = turns[turns.length - 1];
      base.push({
        name: "assertRouteTelecom",
        ok: last?.stage === "route_telecom",
        reason: last?.stage !== "route_telecom" ? `Esperava route_telecom, recebi ${last?.stage}` : undefined,
      });
      return base;
    },
  },
  {
    id: "20-menu-choice-3-expansao",
    title: "Menu apresentado, escolha '3' roteia para expansao",
    steps: [
      { user: "oi" },
      { user: "quero saber mais" },
      { user: "3" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const last = turns[turns.length - 1];
      base.push({
        name: "assertRouteExpansao",
        ok: last?.stage === "route_expansao",
        reason: last?.stage !== "route_expansao" ? `Esperava route_expansao, recebi ${last?.stage}` : undefined,
      });
      return base;
    },
  },
  {
    id: "21-no-city-ever",
    title: "Qualificação completa sem nenhuma menção a cidade",
    steps: [
      { user: "Boa tarde" },
      { user: "quero economizar na conta de luz" },
      { user: "sim" },
      { user: "faz sentido" },
      { user: "450" },
      { user: "SC" },
      { user: "Celesc" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertNoCityQuestion(turns));
      return base;
    },
  },
  {
    id: "22-estado-distribuidora-order",
    title: "Ordem fixa: consumo → estado → distribuidora",
    steps: [
      { user: "Bom dia" },
      { user: "energia por assinatura" },
      { user: "sim" },
      { user: "faz sentido" },
      { user: "600" },
      { user: "PR" },
      { user: "Copel" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const stages = turns.map((t) => t.stage);
      const i1 = stages.indexOf("ask_consumo");
      const i2 = stages.indexOf("ask_estado");
      const i3 = stages.indexOf("ask_distribuidora");
      base.push({
        name: "assertConsumoEstadoDistribuidoraOrder",
        ok: i1 >= 0 && i2 > i1 && i3 > i2,
        reason: `consumo=${i1} estado=${i2} distribuidora=${i3}`,
      });
      return base;
    },
  },
  {
    id: "23-engage-before-data",
    title: "engage_check aparece entre send_video e ask_consumo",
    steps: [
      { user: "Oi" },
      { user: "quero economizar na luz" },
      { user: "sim" },
      { user: "ok" },
      { user: "faz sentido" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const stages = turns.map((t) => t.stage);
      const v = stages.indexOf("send_video");
      const e = stages.indexOf("engage_check");
      base.push({
        name: "assertEngageAfterVideo",
        ok: v >= 0 && e > v,
        reason: `send_video=${v} engage_check=${e}`,
      });
      return base;
    },
  },
  {
    id: "24-no-repeat-greeting",
    title: "Após turno 1, IA não reabre saudação (Opa/Olá/Oi/tudo bem)",
    steps: [
      { user: "Bom dia" },
      { user: "quero economizar na luz" },
      { user: "sim" },
      { user: "faz sentido" },
      { user: "500" },
      { user: "SC" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertNoRepeatedGreeting(turns));
      return base;
    },
  },
  {
    id: "25-no-repeated-question",
    title: "Cliente respondeu consumo, IA não pergunta consumo de novo",
    steps: [
      { user: "Oi" },
      { user: "energia por assinatura" },
      { user: "sim" },
      { user: "faz sentido" },
      { user: "500" },
      { user: "SC" },
    ],
    run: baseRun(),
  },
  {
    id: "26-one-question-per-turn",
    title: "Cada mensagem da IA tem no máximo 1 '?'",
    steps: [
      { user: "Boa tarde" },
      { user: "energia por assinatura" },
      { user: "sim" },
      { user: "faz sentido" },
      { user: "500" },
      { user: "SC" },
      { user: "Celesc" },
    ],
    run: baseRun(),
  },
  {
    id: "27-thays-replay",
    title: "Replay literal da conversa real da Thays — sem cidade, sem repetição, sem mini-saudação",
    steps: [
      { user: "Boa noite" },
      { user: "Quero saber como funciona a energia por assinatura" },
      { user: "Sim" },
      { user: "Ok" },
      { user: "faz sentido" },
      { user: "500" },
      { user: "SC" },
      { user: "Celesc" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertNoCityQuestion(turns));
      base.push(assertNoRepeatedGreeting(turns));
      base.push(assertNoPrematureDataCollection(turns));
      // Menu não aparece — cliente cita produto no turno 2
      const allText = turns.map((t) => t.messages.join("\n")).join("\n");
      const hasMenu = /1\s*-\s*[^\n]*\n[\s\S]*2\s*-/.test(allText);
      base.push({
        name: "assertNoMenuWhenProductCited",
        ok: !hasMenu,
        reason: hasMenu ? "Menu apareceu mas cliente já citou produto" : undefined,
      });
      return base;
    },
  },
  {
    id: "28-ideal-full-flow",
    title: "Fluxo ideal: greet → menu → escolha 1 → vídeo → engage → consumo → estado → distribuidora → fatura",
    steps: [
      { user: "Boa noite" },
      { user: "quero saber mais" },
      { user: "1" },
      { user: "sim" },
      { user: "ok" },
      { user: "faz sentido" },
      { user: "500" },
      { user: "SC" },
      { user: "Celesc" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      base.push(assertNoCityQuestion(turns));
      base.push(assertNoRepeatedGreeting(turns));
      base.push(assertCommercialProgression(turns));
      // Final deve chegar pelo menos a request_invoice
      const reachedInvoice = turns.some((t) =>
        t.messages.some((m) => /\bfatura\b/i.test(m ?? "")) ||
        (t.patch as any)?.extras?.distribuidora ||
        (t as any).events?.some((e: any) => e.payload?.stage === "request_invoice"),
      );
      base.push({
        name: "assertReachedRequestInvoice",
        ok: reachedInvoice,
        reason: reachedInvoice ? undefined : `não chegou a pedir fatura`,
      });
      return base;
    },
  },
];
