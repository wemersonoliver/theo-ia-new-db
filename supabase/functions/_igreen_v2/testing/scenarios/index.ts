// Catálogo de cenários comportamentais do Green.
// Cada cenário define passos do usuário + lista de assertions a executar.

import {
  ALL_ASSERTIONS, assertNoUnexpectedFailsafe,
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
    title: "Interesse no produto: explica resumido sem pedir CPF/nome completo",
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
      { user: "quero economizar" },
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
      { user: "Conexão green" },
      { user: "Sim" },
    ],
    run: baseRun(),
  },
  {
    id: "06-continuity",
    title: "Progressão correta greet→explain→qualify sem retroceder",
    steps: [
      { user: "Boa tarde" },
      { user: "Quero saber sobre a igreen" },
      { user: "Sim, quero entender" },
      { user: "550 reais" },
      { user: "Florianopolis" },
      { user: "Wemerson" },
    ],
    run: baseRun(),
  },
  {
    id: "07-anti-form",
    title: "Anti-formulário: não pede 3 dados no mesmo turno",
    steps: [
      { user: "Oi" },
      { user: "quero contratar" },
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
      { user: "Conexão green" },
      { user: "Sim" },
    ],
    run: baseRun(),
  },
  {
    id: "12-stage-progression",
    title: "Stages progridem deterministicamente sem voltar ao explain",
    steps: [
      { user: "Boa tarde" },
      { user: "quero saber sobre igreen" },
      { user: "claro" },
      { user: "550 reais" },
    ],
    run: baseRun(),
  },
  {
    id: "13-no-stage-stall",
    title: "etapa_funil sai de novo após confirmação de interesse",
    steps: [
      { user: "oi" },
      { user: "tenho interesse" },
      { user: "pode ser" },
    ],
    run: baseRun(),
  },
  {
    id: "14-repeated-semantic-response",
    title: "IA não repete semanticamente a mesma explicação 3x",
    steps: [
      { user: "Bom dia" },
      { user: "Conexão green" },
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
      { user: "quero economizar" },
      { user: "entendi" },
    ],
    run: (turns) => {
      const base = baseRun()(turns);
      const explainCount = turns.filter((t) => t.stage === "explain_solution").length;
      base.push({
        name: "assertExplainOnce",
        ok: explainCount <= 1,
        reason: explainCount > 1 ? `explain_solution apareceu ${explainCount}x` : undefined,
      });
      return base;
    },
  },
];
