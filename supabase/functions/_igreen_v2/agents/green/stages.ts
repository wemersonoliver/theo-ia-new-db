// Heurísticas determinísticas do Green specialist (D1: LLM não controla fluxo).
// Decide qual sub-passo rodar com base em etapa_funil + última mensagem.
// LLM só gera texto curto DENTRO do molde escolhido aqui.

import type { IgreenConversationState } from "../../types.ts";

export type GreenStage =
  | "greet"
  | "explain_solution"
  | "send_video"
  | "ask_consumo"
  | "ask_cidade"
  | "ask_name"
  | "request_invoice"
  | "waiting_invoice"
  | "validate_invoice"
  | "soft_confirm_ask"
  | "ask_full_name_cpf"
  | "idle";

const INVOICE_KEYWORDS = [
  "fatura", "conta de luz", "boleto", "mando", "vou mandar", "enviar fatura",
];

export function decideGreenStage(
  state: Pick<IgreenConversationState, "etapa_funil" | "produto" | "extras">,
  message: string,
  hasMedia: boolean = false,
  documentStatus?: string | null,
): GreenStage {
  const etapa = (state.etapa_funil ?? "novo").toLowerCase();
  const msg = (message ?? "").toLowerCase();
  const extras = (state.extras ?? {}) as Record<string, unknown>;

  if (hasMedia && (etapa === "qualificacao" || etapa === "fatura_enviada" || etapa === "fatura_rejeitada")) {
    return "validate_invoice";
  }
  if (documentStatus === "awaiting_soft_confirm") {
    return "soft_confirm_ask";
  }

  if (etapa === "novo") {
    if (!extras.greeted) return "greet";
    return "explain_solution";
  }

  if (etapa === "qualificacao") {
    if (!extras.video_sent) return "send_video";
    if (!extras.consumo_medio) return "ask_consumo";
    if (!extras.cidade) return "ask_cidade";
    if (!extras.client_name) return "ask_name";
    return "request_invoice";
  }

  if (etapa === "fatura_enviada") {
    if (INVOICE_KEYWORDS.some((k) => msg.includes(k))) return "waiting_invoice";
    return "waiting_invoice";
  }

  if (etapa === "fatura_validada") {
    if (!extras.full_name || !extras.cpf) return "ask_full_name_cpf";
    return "idle";
  }

  return "idle";
}