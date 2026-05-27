// Fase 6 — Degradation Detector
// Determina se um provider/model está degradado com base em taxa de erro + latência.

import { getHealth } from "./recorder.ts";

export interface DegradationStatus {
  degraded: boolean;
  reason?: string;
  error_rate: number;
  latency_p95_ms: number;
}

const ERROR_RATE_THRESHOLD = 0.25;
const LATENCY_P95_THRESHOLD_MS = 12_000;

export async function detectDegradation(
  provider: string,
  model: string,
): Promise<DegradationStatus> {
  const h = await getHealth(provider, model);
  if (!h) return { degraded: false, error_rate: 0, latency_p95_ms: 0 };

  const total = (h.success_count ?? 0) + (h.failure_count ?? 0) + (h.timeout_count ?? 0);
  const errors = (h.failure_count ?? 0) + (h.timeout_count ?? 0);
  const error_rate = total > 0 ? errors / total : 0;
  const latency_p95_ms = h.latency_p95_ms ?? 0;

  if (total < 5) {
    return { degraded: false, error_rate, latency_p95_ms };
  }

  if (error_rate >= ERROR_RATE_THRESHOLD) {
    return { degraded: true, reason: "high_error_rate", error_rate, latency_p95_ms };
  }
  if (latency_p95_ms >= LATENCY_P95_THRESHOLD_MS) {
    return { degraded: true, reason: "high_latency", error_rate, latency_p95_ms };
  }
  return { degraded: false, error_rate, latency_p95_ms };
}