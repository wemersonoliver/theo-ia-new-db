// Thresholds de confidence em código puro (sem LLM, sem prompt).
// >= 0.90  → auto_approve
// 0.70..0.899 → request_soft_confirmation
// <  0.70  → request_resend

export type ThresholdDecision = "auto_approve" | "request_soft_confirmation" | "request_resend";

export const AUTO_APPROVE_MIN = 0.90;
export const SOFT_CONFIRM_MIN = 0.70;

export function decideByConfidence(confidence: number): ThresholdDecision {
  const c = Number.isFinite(confidence) ? confidence : 0;
  if (c >= AUTO_APPROVE_MIN) return "auto_approve";
  if (c >= SOFT_CONFIRM_MIN) return "request_soft_confirmation";
  return "request_resend";
}