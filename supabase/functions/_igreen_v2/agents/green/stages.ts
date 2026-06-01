// Pedido explícito de handoff humano.
const HANDOFF_RX = /\b(falar com (um |uma )?(atendente|humano|pessoa|algu[eé]m)|quero (um |uma )?(atendente|humano)|me passa (pra|para) (algu[eé]m|humano|atendente)|atendimento humano|n[aã]o quero (falar|conversar) com (rob[oô]|ia|m[aá]quina))\b/i;
export function isHandoffRequest(msg: string): boolean {
  return HANDOFF_RX.test(msg ?? "");
}

// Aceite explícito do link de auto-cadastro (após objection_security).
const AUTOCADASTRO_ACCEPT_RX = /\b(sim|pode|envia|manda|me envia|me manda|por favor|prefiro|quero o link)\b/i;
export function acceptsAutoCadastro(msg: string): boolean {
  return AUTOCADASTRO_ACCEPT_RX.test(msg ?? "");
}

// Heurísticas determinísticas do Green specialist (D1: LLM não controla fluxo).
// Decide qual sub-passo rodar com base em etapa_funil + última mensagem.
// LLM só gera texto curto DENTRO do molde escolhido aqui.

import type { IgreenConversationState } from "../../types.ts";

export type GreenStage =
  | "greet"
  | "explain_solution"
  | "send_video"
  | "engage_check"
  | "ask_consumo"
  | "ask_estado"
  | "present_distributors"
  | "ask_distribuidora"
  | "ask_cidade"
  | "ask_name"
  | "simulate_discount"
  | "simulate_discount_concreto"
  | "ask_valor_fatura"
  | "request_invoice"
  | "intent_send_invoice_ack"
  | "waiting_invoice"
  | "validate_invoice"
  | "invoice_rejected_reply"
  | "faq_answer"
  | "soft_confirm_ask"
  | "request_identity"
  | "validate_identity"
  | "family_authorization_check"
  | "objection_security"
  | "send_autocadastro_link"
  | "handoff_human"
  | "ask_full_name_cpf"
  | "idle";

const INVOICE_KEYWORDS = [
  "fatura", "conta de luz", "boleto", "mando", "vou mandar", "enviar fatura",
];

// Cliente diz que vai enviar a fatura SEM anexar nada — não disparar validate.
const INTENT_SEND_INVOICE_RX = /\b(vou (te )?mandar|vou enviar|j[aá] te envio|j[aá] envio|agora mando|mando (j[aá]|agora)|te mando (j[aá]|agora|daqui)|envio (j[aá]|agora))\b[\s\S]{0,30}\b(fatura|conta|boleto|luz)\b/i;

// Cliente sinaliza que está procurando/buscando a fatura (mesmo sem citar a palavra).
const INTENT_SEARCHING_INVOICE_RX = /\b(vou (procurar|buscar|achar|pegar|ver)|deixa eu (ver|achar|pegar|buscar|procurar)|s[oó] um (minuto|momento|instante|segundo|seg)|j[aá] j[aá]|t[oô] (procurando|vendo|buscando|achando)|aguenta a[ií]|pera[ií]|um momento)\b/i;

// Objeção de segurança / golpe.
const OBJECTION_SECURITY_RX = /\b(golpe|fraude|seguro|por que.{0,15}precis|n[aã]o gosto de mandar|tenho medo|isso[\s\S]{0,5}é seguro|isso[\s\S]{0,5}é confi[aá]vel)\b/i;

export function isIntentSendInvoice(msg: string): boolean {
  return INTENT_SEND_INVOICE_RX.test(msg ?? "");
}
export function isIntentSearchingInvoice(msg: string): boolean {
  return INTENT_SEARCHING_INVOICE_RX.test(msg ?? "");
}
export function isObjectionSecurity(msg: string): boolean {
  return OBJECTION_SECURITY_RX.test(msg ?? "");
}

// FAQ rápida — dúvidas comuns que NÃO devem disparar repetição de pedido de fatura.
// Mapeamos a categoria para escolher resposta determinística em run.ts.
export type GreenFaqTopic =
  | "cashback"
  | "como_funciona"
  | "seguro"
  | "prazo"
  | "cancelar"
  | "instalacao"
  | "fidelidade";

export function detectFaqTopic(msg: string): GreenFaqTopic | null {
  const m = (msg ?? "").toLowerCase();
  if (!m) return null;
  if (/\bcash\s*back|cashback|indica(c|ç)(a|ã)o|indicar|zerar (a )?conta\b/.test(m)) return "cashback";
  if (/\bcancel(ar|amento|o)|sair (do|da)\b/.test(m)) return "cancelar";
  if (/\bfidelidade|multa|car(e|ê)ncia\b/.test(m)) return "fidelidade";
  if (/\binstala(c|ç)(a|ã)o|instala(r|m)|obra|placa\b/.test(m)) return "instalacao";
  if (/\bprazo|quando come(c|ç)a|come(c|ç)a a valer|quanto tempo\b/.test(m)) return "prazo";
  if (/\bseguro|confi(a|á)vel|golpe|fraude\b/.test(m)) return "seguro";
  if (/\bcomo funciona|funciona como|me explica\b/.test(m)) return "como_funciona";
  return null;
}

// Confirmações curtas / interesse explícito após explicação.
const AFFIRMATION_RX = /\b(sim|claro|quero|pode ser|bora|vamos|entendi|ok|beleza|certo|com certeza|positivo|isso|isso ai|isso aí|fechado|t[oô] dentro|topo|gostei|me interessei|tenho interesse)\b/i;

export function isAffirmation(msg: string): boolean {
  if (!msg) return false;
  return AFFIRMATION_RX.test(msg);
}

export function decideGreenStage(
  state: Pick<IgreenConversationState, "etapa_funil" | "produto" | "extras">,
  message: string,
  hasMedia: boolean = false,
  documentStatus?: string | null,
): GreenStage {
  const etapa = (state.etapa_funil ?? "novo").toLowerCase();
  const msg = (message ?? "").toLowerCase();
  const extras = (state.extras ?? {}) as Record<string, unknown>;

  // PRIORIDADE -1 — pedido explícito de humano: handoff imediato.
  if (isHandoffRequest(message) && !extras.handoff_done) {
    return "handoff_human";
  }

  // PRIORIDADE 0 — objeção de golpe (válida em qualquer etapa, desde que já tenha saudado).
  if (isObjectionSecurity(message) && !extras.objection_security_handled && extras.greeted) {
    return "objection_security";
  }

  // Após objeção, se cliente aceitar, enviar link de auto-cadastro (1 vez).
  if (extras.objection_security_handled && !extras.autocadastro_sent && acceptsAutoCadastro(message)) {
    return "send_autocadastro_link";
  }

  if (hasMedia && (etapa === "qualificacao" || etapa === "fatura_enviada" || etapa === "fatura_rejeitada")) {
    return "validate_invoice";
  }

  // Fatura recebida mas rejeitada silenciosamente — precisamos avisar o cliente
  // e pedir reenvio em vez de repetir "fico aguardando".
  if (!hasMedia && documentStatus === "rejected" &&
      (etapa === "qualificacao" || etapa === "fatura_enviada" || etapa === "fatura_rejeitada") &&
      !extras.invoice_rejected_notified) {
    return "invoice_rejected_reply";
  }

  // FAQ rápida (cashback, como funciona, etc.) — só após qualificação iniciada,
  // sem mídia anexada e sem objeção de segurança ativa neste turno.
  if (!hasMedia &&
      (etapa === "qualificacao" || etapa === "fatura_enviada") &&
      extras.greeted &&
      detectFaqTopic(message)) {
    return "faq_answer";
  }

  // Cliente sinalizou que vai enviar / está procurando a fatura mas não anexou.
  if (!hasMedia &&
      (isIntentSendInvoice(message) || isIntentSearchingInvoice(message)) &&
      (etapa === "qualificacao" || etapa === "fatura_enviada")) {
    return "intent_send_invoice_ack";
  }

  if (documentStatus === "awaiting_soft_confirm") {
    return "soft_confirm_ask";
  }

  if (etapa === "novo") {
    if (!extras.greeted) return "greet";
    if (!extras.explained) return "explain_solution";
    if (extras.video_sent) return "engage_check";
    return "send_video";
  }

  if (etapa === "qualificacao") {
    if (!extras.video_sent) return "send_video";
    if (!extras.engaged) return "engage_check";
    if (!extras.consumo_medio) return "ask_consumo";
    if (!extras.estado) return "ask_estado";
    if (!extras.distribuidora) {
      if (!extras.distributors_presented) return "present_distributors";
      return "ask_distribuidora";
    }
    if (!extras.valor_fatura) return "ask_valor_fatura";
    if (!extras.discount_lookup_done) return "simulate_discount_concreto";
    return "request_invoice";
  }

  if (etapa === "fatura_enviada") {
    if (extras.invoice_search_ack) return "waiting_invoice";
    if (INVOICE_KEYWORDS.some((k) => msg.includes(k))) return "waiting_invoice";
    return "waiting_invoice";
  }

  if (etapa === "fatura_validada") {
    // Novo fluxo: após validate_green_invoice com match=true, pedir RG/CNH do titular.
    if (extras.invoice_validated_match && !extras.identity_validated) {
      if (!extras.identity_requested) return "request_identity";
      return "validate_identity";
    }
    if (extras.invoice_match_third_party && !extras.family_authorized) {
      return "family_authorization_check";
    }
    if (!extras.full_name || !extras.cpf) return "ask_full_name_cpf";
    return "idle";
  }

  return "idle";
}