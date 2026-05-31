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

const CITY_RX = /\b(qual.{0,5}cidade|em qual cidade|onde voc[eê] mora|mora em qual|sua cidade|cidade voc[eê])\b/i;
export function assertNoCityQuestion(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    const text = turns[i].messages.join(" ");
    if (CITY_RX.test(text)) {
      return { name: "assertNoCityQuestion", ok: false,
        reason: `Turno ${i}: IA perguntou cidade — proibido: "${text.slice(0, 160)}"` };
    }
  }
  return { name: "assertNoCityQuestion", ok: true };
}

const GREETING_START_RX = /^\s*(opa\b|ol[aá]\b|oi\b|tudo bem)/i;
export function assertNoRepeatedGreeting(turns: Turn[]): AssertionResult {
  for (let i = 1; i < turns.length; i++) {
    for (const m of turns[i].messages) {
      if (GREETING_START_RX.test(m ?? "")) {
        return { name: "assertNoRepeatedGreeting", ok: false,
          reason: `Turno ${i}: IA reabriu saudação ("${(m ?? "").slice(0, 60)}")` };
      }
    }
  }
  return { name: "assertNoRepeatedGreeting", ok: true };
}

const MENU_NUMBERED_RX = /1\s*-\s*[^\n]*\n[\s\S]*2\s*-\s*[^\n]*\n[\s\S]*3\s*-/;
const GENERIC_FIRST_RX = /^\s*(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|tenho interesse|quero saber|como funciona|me explica|info|informa)/i;
export function assertMenuPresentedWhenGeneric(turns: Turn[]): AssertionResult {
  if (!turns.length) return { name: "assertMenuPresentedWhenGeneric", ok: true };
  const first = turns[0].user ?? "";
  if (!GENERIC_FIRST_RX.test(first)) return { name: "assertMenuPresentedWhenGeneric", ok: true };
  const allText = turns.map((t) => t.messages.join("\n")).join("\n");
  if (!MENU_NUMBERED_RX.test(allText)) {
    return { name: "assertMenuPresentedWhenGeneric", ok: false,
      reason: `Cliente entrou genérico ("${first}") mas IA não apresentou menu numerado 1/2/3` };
  }
  return { name: "assertMenuPresentedWhenGeneric", ok: true };
}

export function assertNoPrematureDataCollection(turns: Turn[]): AssertionResult {
  // Antes de extras.engaged=true, IA não pode pedir consumo/estado/distribuidora/fatura.
  const DATA_RX = /\b(quanto.{0,10}conta|consumo|m[eé]dia.{0,10}conta|qual.{0,5}estado|distribuidora|fatura|conta de luz)\b/i;
  let engaged = false;
  for (let i = 0; i < turns.length; i++) {
    const extras = turns[i].extras_after ?? {};
    if (extras.engaged) { engaged = true; continue; }
    if (engaged) continue;
    // Só fiscaliza após o vídeo (extras.video_sent), antes disso é normal não ter engaged.
    if (!extras.video_sent) continue;
    const text = turns[i].messages.join(" ");
    if (DATA_RX.test(text)) {
      return { name: "assertNoPrematureDataCollection", ok: false,
        reason: `Turno ${i}: pediu dado antes de engage_check ("${text.slice(0, 120)}")` };
    }
  }
  return { name: "assertNoPrematureDataCollection", ok: true };
}

const COMMERCIAL_ORDER = [
  "greet_open","present_menu","greet","explain_solution","route_green",
  "send_video","engage_check","ask_consumo","ask_estado","ask_distribuidora",
  "simulate_discount","ask_valor_fatura","request_invoice","intent_send_invoice_ack",
  "validate_invoice","request_identity","validate_identity",
  "family_authorization_check","ask_full_name_cpf","idle",
];
export function assertCommercialProgression(turns: Turn[]): AssertionResult {
  let lastIdx = -1;
  for (let i = 0; i < turns.length; i++) {
    const idx = COMMERCIAL_ORDER.indexOf(turns[i].stage);
    if (idx < 0) continue;
    // Permite repetir o mesmo (já coberto por assertNoLoop) ou avançar.
    if (idx < lastIdx) {
      return { name: "assertCommercialProgression", ok: false,
        reason: `Turno ${i}: stage "${turns[i].stage}" retrocedeu de "${COMMERCIAL_ORDER[lastIdx]}"` };
    }
    lastIdx = Math.max(lastIdx, idx);
  }
  return { name: "assertCommercialProgression", ok: true };
}

export const ALL_ASSERTIONS = [
  assertNoRepeatedQuestion, assertNoLoop, assertNoUnexpectedHandoff,
  assertSingleIntentPerTurn, assertValidStageTransition, assertNoFormBehavior,
  assertResponseNotTruncated, assertConversationProgressing, assertSemanticMemory,
  assertNoCityQuestion, assertNoRepeatedGreeting, assertCommercialProgression,
];

// ─── Assertions NOVAS (não entram em ALL_ASSERTIONS — usadas só nos cenários novos) ───

const SLANG_RX = /\b(blz|beleza|massa|de boa|t[oô]pa|topo|tranquilo|tranquila|rapidinho|bora|show|maneiro)\b/i;
export function assertNoSlang(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    for (const m of turns[i].messages) {
      if (SLANG_RX.test(m ?? "")) {
        return { name: "assertNoSlang", ok: false,
          reason: `Turno ${i}: gíria detectada em "${(m ?? "").slice(0, 120)}"` };
      }
    }
  }
  return { name: "assertNoSlang", ok: true };
}

const EM_DASH_RX = /[—–]/;
export function assertNoEmDash(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    for (const m of turns[i].messages) {
      if (EM_DASH_RX.test(m ?? "")) {
        return { name: "assertNoEmDash", ok: false,
          reason: `Turno ${i}: travessão proibido em "${(m ?? "").slice(0, 120)}"` };
      }
    }
  }
  return { name: "assertNoEmDash", ok: true };
}

export function assertDiscountToolCalled(turns: Turn[]): AssertionResult {
  // Se em algum turno extras tem estado E distribuidora, deve haver tool_call get_distributor_discount.
  let needed = false;
  let called = false;
  for (const t of turns) {
    const e = (t.extras_after ?? {}) as Record<string, unknown>;
    if (e.estado && e.distribuidora) needed = true;
    const tc = (t as any).toolCalls ?? (t as any).tool_calls ?? [];
    if (Array.isArray(tc) && tc.some((c: any) => c?.name === "get_distributor_discount")) called = true;
    // mock runner não expõe tool_calls em turns; checamos eventos de stage
    const ev = (t.events ?? []) as Array<{ payload?: any }>;
    if (ev.some((x) => x.payload?.stage === "simulate_discount")) called = true;
  }
  if (needed && !called) {
    return { name: "assertDiscountToolCalled", ok: false,
      reason: "estado+distribuidora capturados mas simulate_discount/get_distributor_discount nunca foi chamado" };
  }
  return { name: "assertDiscountToolCalled", ok: true };
}

export function assertIntentSendInvoiceDoesNotValidate(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].stage === "intent_send_invoice_ack") {
      const ev = turns[i].events ?? [];
      const validated = ev.some((e: any) => e.payload?.stage === "validate_invoice");
      if (validated) {
        return { name: "assertIntentSendInvoiceDoesNotValidate", ok: false,
          reason: `Turno ${i}: cliente só disse que vai mandar fatura mas validate_invoice foi disparado` };
      }
    }
  }
  return { name: "assertIntentSendInvoiceDoesNotValidate", ok: true };
}

export function assertObjectionSecurityHandled(turns: Turn[]): AssertionResult {
  const hit = turns.find((t) => t.stage === "objection_security");
  if (!hit) {
    return { name: "assertObjectionSecurityHandled", ok: false,
      reason: "Mensagem de objeção de segurança não disparou stage objection_security" };
  }
  const e = (hit.extras_after ?? {}) as Record<string, unknown>;
  if (!e.objection_security_handled) {
    return { name: "assertObjectionSecurityHandled", ok: false,
      reason: "objection_security rodou mas flag objection_security_handled não foi persistida" };
  }
  return { name: "assertObjectionSecurityHandled", ok: true };
}

export function assertHandoffSilencesAI(turns: Turn[]): AssertionResult {
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].stage === "handoff_human") {
      if ((turns[i].messages ?? []).length > 0) {
        return { name: "assertHandoffSilencesAI", ok: false,
          reason: `Turno ${i}: handoff_human emitiu mensagens (deveria ser silêncio)` };
      }
      if (!turns[i].handoff_ativo) {
        return { name: "assertHandoffSilencesAI", ok: false,
          reason: `Turno ${i}: handoff_human não ativou handoff_ativo` };
      }
    }
  }
  return { name: "assertHandoffSilencesAI", ok: true };
}

export function assertAutocadastroLinkSent(turns: Turn[]): AssertionResult {
  const hit = turns.find((t) => t.stage === "send_autocadastro_link");
  if (!hit) {
    return { name: "assertAutocadastroLinkSent", ok: false,
      reason: "Stage send_autocadastro_link não foi disparado" };
  }
  const hasLink = (hit.messages ?? []).some((m) => /https?:\/\/|app\.igreen/i.test(m ?? ""));
  if (!hasLink) {
    return { name: "assertAutocadastroLinkSent", ok: false,
      reason: `Stage send_autocadastro_link rodou mas não enviou link` };
  }
  return { name: "assertAutocadastroLinkSent", ok: true };
}