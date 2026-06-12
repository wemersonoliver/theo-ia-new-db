// Regras adicionais aplicadas APÓS o validator + thresholds + holder-match.
// Combina sinais em uma decisão final para fatura de energia (Green).

import type { ThresholdDecision } from "./confidence-thresholds.ts";
import type { HolderMatchStatus } from "./holder-match.ts";

export type InvoiceFinalDecision =
  | "approve"
  | "soft_confirm"
  | "reject_holder_mismatch"
  | "reject_not_invoice"
  | "reject_low_confidence"
  | "reject_unreadable";

export interface InvoiceFinalInput {
  classification: string;
  threshold: ThresholdDecision;
  holder_match?: HolderMatchStatus;
}

// Regra simplificada (jun/2026): só checa que é uma fatura de energia legível.
// A IA não tenta mais validar titularidade aqui — quem garante isso é o
// próprio cliente, que recebe instrução explícita de enviar o RG/CNH do
// titular da fatura mais adiante. Mantemos o tipo de retorno antigo para
// compatibilidade com código a jusante, mas nunca devolvemos
// "reject_holder_mismatch" nem "soft_confirm".
export function decideInvoiceFinal(input: InvoiceFinalInput): InvoiceFinalDecision {
  const c = (input.classification ?? "").toLowerCase();
  if (c === "unreadable") return "reject_unreadable";
  if (c !== "green_invoice" && c !== "other_invoice") return "reject_not_invoice";
  if (input.threshold === "request_resend") return "reject_low_confidence";
  return "approve";
}