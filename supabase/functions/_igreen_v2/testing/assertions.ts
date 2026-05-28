// Behavioral assertions — funções puras sobre os turnos do ConversationRunner.
// Cada assert retorna { ok, reason? } e nunca lança.

import { ALLOWED_TRANSITIONS } from "../state-engine/transitions.ts";

export interface Turn {
  user: string;
  stage: string;
  specialist: string;
  intent: string;
  confidence: number;
  source: string;
  messages: string[];
  patch: Record<string, unknown>;
  events: Array<{ type: string; payload?: Record<string, unknown> }>;
  etapa_funil_before: string | null;
  etapa_funil_after: string | null;
  extras_after: Record<string, unknown>;
  handoff_ativo: boolean;
}

export interface AssertionResult { name: string; ok: boolean; reason?: string }

const STOP = new Set([
  "a","o","as","os","de","da","do","das","dos","e","ou","um","uma","com","sem",
  "no","na","nos","nas","em","pra","para","por","seu","sua","seus","suas","me",
  "te","se","que","qual","quais","como","onde","quando","quanto","quantos","quantas",
  "voce","você","tudo","bem","ola","olá","oi","ai","aí","hoje","entao","então",
]);

function tokens(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s?]/g, " ")
    .split(/\s+/).filter((t) => t && !STOP.has(t));
}

function extractQuestions(text: string): string[] {
  return (text ?? "").split(/(?<=[?])/).map((s) => s.trim()).filter((s) => s.endsWith("?"));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a); const sb = new Set(b);
  let inter = 0; for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function assertNoRepeatedQuestion(turns: Turn[]): AssertionResult {
  const qs: { idx: number; tks: string[]; text: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    for (const m of turns[i].messages) {
      for (const q of extractQuestions(m)) qs.push({ idx: i, tks: tokens(q), text: q });
    }
  }
  for (let i = 0; i < qs.length; i++) {
    for (let j = i + 1; j < qs.length; j++) {
      if (jaccard(qs[i].tks, qs[j].tks) > 0.7) {
        return { name: "assertNoRepeatedQuestion", ok: false,
          reason: `Turnos ${qs[i].idx} e ${qs[j].idx} repetem semanticamente: "${qs[i].text}" ~ "${qs[j].text}"` };
      }
    }
  }
  return { name: "assertNoRepeatedQuestion", ok: true };
}

export function assertNoLoop(turns: Turn[]): AssertionResult {
  let streak = 1;
  for (let i = 1; i < turns.length; i++) {
    if (turns[i].stage && turns[i].stage === turns[i - 1].stage) {
      streak++;
      if (streak > 2) return { name: "assertNoLoop", ok: false,
        reason: `Stage "${turns[i].stage}" repetido ${streak}x seguidas (turno ${i})` };
    } else streak = 1;
  }
  return { name: "assertNoLoop", ok: true };
}

export function assertNoUnexpectedFailsafe(turns: Turn[], allowFailsafeTurns: number[] = []): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].specialist === "failsafe" && !allowFailsafeTurns.includes(i)) {
      return { name: "assertNoUnexpectedFailsafe", ok: false,
        reason: `Failsafe inesperado no turno ${i} (source=${turns[i].source})` };
    }
  }
  return { name: "assertNoUnexpectedFailsafe", ok: true };
}

export function assertNoUnexpectedHandoff(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].handoff_ativo) return { name: "assertNoUnexpectedHandoff", ok: false,
      reason: `Handoff ativado no turno ${i}` };
  }
  return { name: "assertNoUnexpectedHandoff", ok: true };
}

export function assertSingleIntentPerTurn(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    const text = turns[i].messages.join(" ");
    const qCount = (text.match(/\?/g) ?? []).length;
    if (qCount > 1) return { name: "assertSingleIntentPerTurn", ok: false,
      reason: `Turno ${i} tem ${qCount} perguntas: "${text.slice(0, 160)}"` };
  }
  return { name: "assertSingleIntentPerTurn", ok: true };
}

export function assertValidStageTransition(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    const before = (turns[i].etapa_funil_before ?? "novo").toLowerCase();
    const after = (turns[i].etapa_funil_after ?? before).toLowerCase();
    if (before === after) continue;
    const allowed = ALLOWED_TRANSITIONS[before];
    if (!allowed || !allowed.includes(after)) {
      return { name: "assertValidStageTransition", ok: false,
        reason: `Transição inválida turno ${i}: ${before} → ${after}` };
    }
  }
  return { name: "assertValidStageTransition", ok: true };
}

const FORM_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /nome\s+completo[\s\S]{0,40}cpf/i, label: "nome completo + cpf no mesmo turno" },
  { rx: /cidade[\s\S]{0,40}consumo[\s\S]{0,40}conta/i, label: "cidade + consumo + conta no mesmo turno" },
  { rx: /(?:nome|cidade|consumo|cpf)[\s\S]{0,60}(?:e tamb[eé]m|e me|, e )[\s\S]{0,30}(?:nome|cidade|consumo|cpf)/i, label: "múltiplos dados encadeados" },
];

export function assertNoFormBehavior(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    const text = turns[i].messages.join(" ");
    for (const p of FORM_PATTERNS) {
      if (p.rx.test(text)) return { name: "assertNoFormBehavior", ok: false,
        reason: `Turno ${i}: ${p.label}` };
    }
  }
  return { name: "assertNoFormBehavior", ok: true };
}

export function assertResponseNotTruncated(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    for (const m of turns[i].messages) {
      const t = (m ?? "").trim();
      if (!t) continue;
      if (t.length < 20) return { name: "assertResponseNotTruncated", ok: false,
        reason: `Turno ${i}: resposta curta demais (${t.length} chars): "${t}"` };
      if (!/[.!?…)]$/.test(t)) return { name: "assertResponseNotTruncated", ok: false,
        reason: `Turno ${i}: terminação abrupta: "...${t.slice(-40)}"` };
    }
  }
  return { name: "assertResponseNotTruncated", ok: true };
}

export function assertConversationProgressing(turns: Turn[]): AssertionResult {
  for (let i = 2; i < turns.length; i++) {
    const a = turns[i - 2], b = turns[i - 1], c = turns[i];
    const stagesEqual = a.stage === b.stage && b.stage === c.stage;
    const etapasEqual = a.etapa_funil_after === b.etapa_funil_after && b.etapa_funil_after === c.etapa_funil_after;
    const extrasA = Object.keys(a.extras_after ?? {}).length;
    const extrasC = Object.keys(c.extras_after ?? {}).length;
    if (stagesEqual && etapasEqual && extrasA === extrasC) {
      return { name: "assertConversationProgressing", ok: false,
        reason: `Conversa estagnou em ${c.stage} por 3 turnos sem evoluir etapa nem extras` };
    }
  }
  return { name: "assertConversationProgressing", ok: true };
}

// Memória semântica: se um extra "dado" foi coletado, IA não pode perguntar de novo.
const MEMORY_QUESTIONS: Record<string, RegExp> = {
  client_name: /\b(seu nome|como.{0,10}chamar|nome completo|me fala.{0,10}nome)\b/i,
  cidade: /\b(qual.{0,5}cidade|em qual cidade|onde.{0,5}mora)\b/i,
  consumo_medio: /\b(quanto.{0,10}conta|m[eé]dia.{0,10}conta|valor.{0,5}conta|consumo)\b/i,
  cpf: /\bcpf\b/i,
  full_name: /\bnome completo\b/i,
};

export function assertSemanticMemory(turns: Turn[]): AssertionResult {
  for (let i = 1; i < turns.length; i++) {
    const known = turns[i - 1].extras_after ?? {};
    const text = turns[i].messages.join(" ");
    for (const [k, rx] of Object.entries(MEMORY_QUESTIONS)) {
      if (known[k] && rx.test(text)) {
        return { name: "assertSemanticMemory", ok: false,
          reason: `Turno ${i}: IA perguntou "${k}" que já está em extras (${String(known[k]).slice(0, 40)})` };
      }
    }
  }
  return { name: "assertSemanticMemory", ok: true };
}

export const ALL_ASSERTIONS = [
  assertNoRepeatedQuestion, assertNoLoop, assertNoUnexpectedHandoff,
  assertSingleIntentPerTurn, assertValidStageTransition, assertNoFormBehavior,
  assertResponseNotTruncated, assertConversationProgressing, assertSemanticMemory,
];