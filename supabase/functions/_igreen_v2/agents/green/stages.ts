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
  | "ask_distribuidora"
  | "ask_cidade"
  | "ask_name"
  | "simulate_discount"
  | "ask_valor_fatura"
  | "request_invoice"
  | "intent_send_invoice_ack"
  | "waiting_invoice"
  | "validate_invoice"
  | "soft_confirm_ask"
  | "request_identity"
  | "validate_identity"
  | "family_authorization_check"
  | "objection_security"
  | "ask_full_name_cpf"
  | "idle";

const INVOICE_KEYWORDS = [
  "fatura", "conta de luz", "boleto", "mando", "vou mandar", "enviar fatura",
];

// Cliente diz que vai enviar a fatura SEM anexar nada — não disparar validate.
const INTENT_SEND_INVOICE_RX = /\b(vou (te )?mandar|vou enviar|j[aá] te envio|j[aá] envio|agora mando|mando (j[aá]|agora)|te mando (j[aá]|agora|daqui)|envio (j[aá]|agora))\b[\s\S]{0,30}\b(fatura|conta|boleto|luz)\b/i;

// Objeção de segurança / golpe.
const OBJECTION_SECURITY_RX = /\b(golpe|fraude|seguro|por que.{0,15}precis|n[aã]o gosto de mandar|tenho medo|isso[\s\S]{0,5}é seguro|isso[\s\S]{0,5}é confi[aá]vel)\b/i;

export function isIntentSendInvoice(msg: string): boolean {
  return INTENT_SEND_INVOICE_RX.test(msg ?? "");
}
export function isObjectionSecurity(msg: string): boolean {
  return OBJECTION_SECURITY_RX.test(msg ?? "");
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

  // PRIORIDADE 0 — objeção de golpe (válida em qualquer etapa pós-novo).
  if (etapa !== "novo" && isObjectionSecurity(message) && !extras.objection_security_handled) {
    return "objection_security";
  }

  if (hasMedia && (etapa === "qualificacao" || etapa === "fatura_enviada" || etapa === "fatura_rejeitada")) {
    return "validate_invoice";
  }

  // Cliente sinalizou que vai enviar fatura mas não anexou — só ack, sem validate.
  if (!hasMedia && isIntentSendInvoice(message) &&
      (etapa === "qualificacao" || etapa === "fatura_enviada")) {
    return "intent_send_invoice_ack";
  }

  if (documentStatus === "awaiting_soft_confirm") {
    return "soft_confirm_ask";
  }

  if (etapa === "novo") {
    if (!extras.greeted) return "greet";
    if (!extras.explained) return "explain_solution";
    // Após explicar uma vez, NUNCA voltar a explain_solution.
    // Se houve confirmação/interesse OU já marcamos solution_confirmed,
    // promovemos para qualificacao (send_video é o primeiro sub-passo).
    if (extras.solution_confirmed || isAffirmation(message)) return "send_video";
    // Mesmo sem afirmação explícita, progredimos após 1 turno de explicação
    // para evitar loop absorvente em explain_solution.
    return "send_video";
  }

  if (etapa === "qualificacao") {
    if (!extras.video_sent) return "send_video";
    // Engage check entre vídeo e coleta de dados — evita sensação de formulário.
    if (!extras.engaged) return "engage_check";
    if (!extras.consumo_medio) return "ask_consumo";
    if (!extras.estado) return "ask_estado";
    if (!extras.distribuidora) return "ask_distribuidora";
    // Após capturar distribuidora+estado, simular desconto oficial antes de pedir fatura.
    if (!extras.discount_lookup_done) return "simulate_discount";
    return "request_invoice";
  }

  if (etapa === "fatura_enviada") {
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