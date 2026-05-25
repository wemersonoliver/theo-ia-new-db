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
  holder_match: HolderMatchStatus;
}

export function decideInvoiceFinal(input: InvoiceFinalInput): InvoiceFinalDecision {
  const c = (input.classification ?? "").toLowerCase();
  if (c === "unreadable") return "reject_unreadable";
  if (c !== "green_invoice" && c !== "other_invoice") return "reject_not_invoice";
  if (input.threshold === "request_resend") return "reject_low_confidence";
  // Holder mismatch BLOQUEIA, mesmo com auto_approve.
  if (input.holder_match === "mismatch") return "reject_holder_mismatch";
  if (input.threshold === "request_soft_confirmation") return "soft_confirm";
  return "approve";
}