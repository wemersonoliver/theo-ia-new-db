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
  | "early_discount_tease"
  | "confirm_signup"
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
  | "waiting_identity"
  | "family_authorization_check"
  | "objection_security"
  | "send_autocadastro_link"
  | "handoff_human"
  | "ask_full_name_cpf"
  | "soft_close"
  | "out_of_scope_clarify"
  | "objection_reply"
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

// Cliente declina educadamente / pede pra parar. NÃO é objeção a ser
// rebatida — é hora de soltar o lead com gentileza.
const SOFT_DECLINE_RX = /(n[aã]o quero(?:\s+(?:agora|por enquanto|mais|n[aã]o))?|por enquanto n[aã]o|agora n[aã]o|depois (?:eu )?(?:vejo|penso|falo|retorno)|fica pra depois|deixa pra (?:depois|l[aá])|vou pensar|s[oó] (?:queria|quero|tava querendo) saber|s[oó] tava (?:vendo|olhando|curioso)|era s[oó] (?:isso|pra saber)|t[aá] (?:bom|ok)(?:\s+assim)?(?:,?\s*obrigad[oa])?|pode deixar|obrigad[oa](?:[\s,.!]|$)|valeu(?:[\s,.!]|$)|n[aã]o tenho interesse|n[aã]o me interessa|deixa)/i;
export function isSoftDecline(msg: string): boolean {
  return SOFT_DECLINE_RX.test(msg ?? "");
}

// Intenção fora do escopo da Igreen (assinatura de energia limpa com desconto).
export type GreenOutOfScopeTopic =
  | "emprestimo"
  | "placa_propria"
  | "segunda_via"
  | "religar"
  | "troca_titular";
export function detectOutOfScope(msg: string): GreenOutOfScopeTopic | null {
  const m = (msg ?? "").toLowerCase();
  if (!m) return null;
  if (/\b(empr[eé]stimo|consignado|cr[eé]dito\s+(?:na|em|da)\s+(?:conta|luz|energia)|antecipa(?:r|c|ç)[aã]?o\s+(?:da|de)\s+(?:conta|fatura)|grana\s+(?:na|pela)\s+(?:conta|luz))\b/.test(m)) return "emprestimo";
  if (/\b(?:instalar?|colocar?|comprar?|or(?:c|ç)amento\s+de)\s+(?:placa|painel|sistema)\s+(?:solar|fotovoltaic[ao])\b|\b(?:placa|painel)\s+solar\s+(?:no|em)\s+(?:meu|minha|casa|telhado)\b/.test(m)) return "placa_propria";
  if (/\b(?:segunda\s+via|2[aª]\s+via|2\s*via)\b.*\b(?:conta|fatura|boleto|luz)\b|\bfatura\s+(?:atrasad|vencid)/.test(m)) return "segunda_via";
  if (/\b(?:religar?|religa(?:c|ç)[aã]o|ligar?\s+(?:de\s+novo\s+)?a\s+luz|luz\s+(?:foi\s+)?cortad|cortaram\s+(?:a\s+)?(?:luz|energia))\b/.test(m)) return "religar";
  if (/\b(?:trocar?|mudar?|passar?)\s+(?:o\s+)?(?:nome|titular(?:idade)?)\s+(?:da\s+)?(?:conta|fatura|luz)\b/.test(m)) return "troca_titular";
  return null;
}

// Pergunta genuína "como funciona / o que é isso" — diferente de afirmação.
const HOW_RX = /\b(como\s+(?:funciona|que\s+funciona|isso\s+funciona)|o\s+que\s+(?:é|eh)\s+(?:isso|isto)|me\s+explica|n[aã]o\s+entendi)\b/i;
export function isQuestionAboutHow(msg: string): boolean {
  return HOW_RX.test(msg ?? "");
}

// Objeção genérica que o cliente faz quando estamos cobrando um dado.
// Não confunde com "não" puro (já tratado por soft_decline) nem com afirmação.
const GENERIC_OBJECTION_RX = /\b(t[aá]\s+caro|muito\s+caro|n[aã]o\s+confio|n[aã]o\s+acredito|minha\s+conta\s+(?:é|eh)\s+baixa|conta\s+baixa|moro\s+(?:de\s+)?aluguel|alugada?|n[aã]o\s+(?:é|eh)\s+(?:minha|meu)|(?:é|eh)\s+do\s+(?:meu|minha)\s+(?:pai|m[aã]e|marido|esposa|irm[aã]o?|filh[oa]|sogr[oa])|t[aá]\s+complicado|t[aá]\s+dif[ií]cil|n[aã]o\s+pode\s+agora|sem\s+tempo)\b/i;
export function isGenericObjection(msg: string): boolean {
  return GENERIC_OBJECTION_RX.test(msg ?? "");
}

// Stages que estavam prestes a cobrar um dado do cliente. Se a mensagem
// dele for objeção em vez de resposta, devemos pivotar para objection_reply.
const DATA_COLLECTING_STAGES = new Set<GreenStage>([
  "ask_valor_fatura",
  "ask_consumo",
  "ask_estado",
  "ask_distribuidora",
  "request_invoice",
  "confirm_signup",
]);

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

// Cliente pergunta direto sobre desconto/economia/percentual sem ter dado
// estado nem valor. Usado pelo stage `early_discount_tease` para responder
// com a faixa qualitativa (10–20%) e pedir o estado.
const DISCOUNT_QUESTION_RX = /\b(qual[\s\S]{0,15}(percentual|porcentagem|desconto|economia)|quanto[\s\S]{0,20}(desconto|economiz|por\s*cento|porcento|%)|qual[\s\S]{0,20}minha[\s\S]{0,15}economia|meu[\s\S]{0,10}desconto|meu[\s\S]{0,10}percentual|qual[\s\S]{0,5}(?:o\s+)?desconto|tem\s+desconto\s+de\s+quanto|desconto\s+(?:é|eh)\s+de\s+quanto)\b/i;
export function isDiscountQuestion(msg: string): boolean {
  return !!msg && DISCOUNT_QUESTION_RX.test(msg);
}

export function decideGreenStage(
  state: Pick<IgreenConversationState, "etapa_funil" | "produto" | "extras">,
  message: string,
  hasMedia: boolean = false,
  documentStatus?: string | null,
): GreenStage {
  const intended = _decideGreenStageInner(state, message, hasMedia, documentStatus);
  const extras = (state.extras ?? {}) as Record<string, unknown>;
  // PRIORIDADE 0.7 — se íamos cobrar um dado/fatura, mas o cliente trouxe uma
  // objeção genérica (não é número, UF, distribuidora nem afirmação), trata
  // a objeção primeiro. Uma única objeção por turno; controle de repetição
  // é feito por last_objection_topic no run.ts.
  if (
    DATA_COLLECTING_STAGES.has(intended) &&
    !hasMedia &&
    extras.greeted &&
    isGenericObjection(message) &&
    !isAffirmation(message)
  ) {
    return "objection_reply";
  }
  return intended;
}

function _decideGreenStageInner(
  state: Pick<IgreenConversationState, "etapa_funil" | "produto" | "extras">,
  message: string,
  hasMedia: boolean = false,
  documentStatus?: string | null,
): GreenStage {
  const etapa = (state.etapa_funil ?? "novo").toLowerCase();
  const msg = (message ?? "").toLowerCase();
  const extras = (state.extras ?? {}) as Record<string, unknown>;
  const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

  // PRIORIDADE -1 — pedido explícito de humano: handoff imediato.
  if (isHandoffRequest(message) && !extras.handoff_done) {
    return "handoff_human";
  }

  // PRIORIDADE 0 — objeção de golpe (válida em qualquer etapa, desde que já tenha saudado).
  if (isObjectionSecurity(message) && !extras.objection_security_handled && extras.greeted) {
    return "objection_security";
  }

  // PRIORIDADE 0.5 — intenção fora do escopo (empréstimo, placa, segunda via…).
  // Esclarecemos uma única vez por tópico para não virar disco riscado.
  const oos = detectOutOfScope(message);
  if (oos && !hasMedia) {
    const handled = (extras.out_of_scope_handled_topics as string[] | undefined) ?? [];
    if (!handled.includes(oos)) return "out_of_scope_clarify";
  }

  // PRIORIDADE 0.6 — cliente declinou educadamente após já estar engajado.
  // Solta com leveza, sem repetir pedido de dado/fatura.
  if (isSoftDecline(message) && extras.greeted && !extras.soft_closed && !hasMedia) {
    return "soft_close";
  }

  // PRIORIDADE 0.65 — cliente pergunta direto sobre desconto/economia antes
  // de termos estado + valor. Não devolvemos número exato (não temos), mas
  // também não enrolamos: damos a faixa qualitativa (10–20%) e pedimos o
  // estado. Só dispara uma vez para não virar disco riscado.
  if (
    !hasMedia &&
    isDiscountQuestion(message) &&
    !extras.early_discount_tease_sent &&
    (!hasValue(extras.estado) || !hasValue(extras.valor_fatura))
  ) {
    return "early_discount_tease";
  }

  // Após objeção, se cliente aceitar, enviar link de auto-cadastro (1 vez).
  if (extras.objection_security_handled && !extras.autocadastro_sent && acceptsAutoCadastro(message)) {
    return "send_autocadastro_link";
  }

  // Mídia recebida APÓS fatura validada → é o documento de identidade (RG/CNH).
  const awaitingIdentityMedia = etapa === "fatura_validada";
  if (hasMedia && awaitingIdentityMedia) {
    return "validate_identity";
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

  if (etapa === "novo") {
    if (!extras.client_name) return "ask_name";
    if (!extras.explained) return "explain_solution";
    if (extras.video_sent) return "ask_valor_fatura";
    return "send_video";
  }

  if (etapa === "qualificacao") {
    if (!extras.video_sent) return "send_video";
    // Logo depois do vídeo, dar um respiro (1 vez) — capta reação real
    // antes de cobrar valor da fatura.
    if (extras.video_sent && !extras.engaged && !hasValue(extras.valor_fatura)) {
      // Se a mensagem do cliente já é uma objeção genérica, deixa o bloco
      // de PRIORIDADE 0.7 (abaixo) cuidar; caso contrário, faz engage_check.
      if (!isGenericObjection(message)) return "engage_check";
    }
    // Antes de simular precisamos OBRIGATORIAMENTE de estado + valor.
    if (!hasValue(extras.valor_fatura)) return "ask_valor_fatura";
    if (!hasValue(extras.estado)) return "ask_estado";
    if (!hasValue(extras.distribuidora)) {
      if (!hasValue(extras.distributors_presented)) return "present_distributors";
      return "ask_distribuidora";
    }
    if (!hasValue(extras.discount_lookup_done)) return "simulate_discount_concreto";
    // Documentos só são pedidos depois que o cliente confirma "quer começar".
    if (!extras.signup_confirmed) {
      if (isAffirmation(message)) {
        // Resposta afirmativa no turno em que aguardávamos confirmação:
        // libera o pedido de fatura imediatamente.
        return "request_invoice";
      }
      return "confirm_signup";
    }
    return "request_invoice";
  }

  if (etapa === "fatura_enviada") {
    if (extras.invoice_search_ack) return "waiting_invoice";
    if (INVOICE_KEYWORDS.some((k) => msg.includes(k))) return "waiting_invoice";
    return "waiting_invoice";
  }

  if (etapa === "fatura_validada") {
    // Após fatura aprovada, pedimos RG/CNH do titular (responsabilidade do
    // cliente garantir que é do titular — não comparamos mais o nome).
    if (!extras.identity_validated) {
      if (!extras.identity_requested) return "request_identity";
      return hasMedia ? "validate_identity" : "waiting_identity";
    }
    if (!extras.full_name || !extras.cpf) return "ask_full_name_cpf";
    return "idle";
  }

  return "idle";
}