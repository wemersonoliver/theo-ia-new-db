// Fase 6 — Provider Health Recorder
// Registra latência e contagem de sucesso/falha/timeout por (provider, model).
// Janela deslizante simples via UPDATE incremental; reset diário externo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supa = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

export type ProviderOutcome = "success" | "failure" | "timeout";

export async function recordProviderResult(opts: {
  provider: string;
  model: string;
  outcome: ProviderOutcome;
  latency_ms?: number;
  error?: string;
}): Promise<void> {
  const client = supa();
  const now = new Date().toISOString();

  // Upsert + incremento.
  const { data: existing } = await client
    .from("igreen_provider_health")
    .select("*")
    .eq("provider", opts.provider)
    .eq("model", opts.model)
    .maybeSingle();

  if (!existing) {
    await client.from("igreen_provider_health").insert({
      provider: opts.provider,
      model: opts.model,
      success_count: opts.outcome === "success" ? 1 : 0,
      failure_count: opts.outcome === "failure" ? 1 : 0,
      timeout_count: opts.outcome === "timeout" ? 1 : 0,
      latency_p50_ms: opts.latency_ms ?? 0,
      latency_p95_ms: opts.latency_ms ?? 0,
      last_error: opts.error ?? null,
      last_success_at: opts.outcome === "success" ? now : null,
      last_failure_at: opts.outcome !== "success" ? now : null,
    });
    return;
  }

  const lat = opts.latency_ms ?? existing.latency_p50_ms ?? 0;
  await client
    .from("igreen_provider_health")
    .update({
      success_count: existing.success_count + (opts.outcome === "success" ? 1 : 0),
      failure_count: existing.failure_count + (opts.outcome === "failure" ? 1 : 0),
      timeout_count: existing.timeout_count + (opts.outcome === "timeout" ? 1 : 0),
      // EWMA simples para p50; p95 = max(p95, lat) (proxy leve)
      latency_p50_ms: Math.round(0.7 * (existing.latency_p50_ms ?? 0) + 0.3 * lat),
      latency_p95_ms: Math.max(existing.latency_p95_ms ?? 0, lat),
      last_error: opts.outcome !== "success" ? (opts.error ?? existing.last_error) : existing.last_error,
      last_success_at: opts.outcome === "success" ? now : existing.last_success_at,
      last_failure_at: opts.outcome !== "success" ? now : existing.last_failure_at,
      updated_at: now,
    })
    .eq("provider", opts.provider)
    .eq("model", opts.model);
}

export async function getHealth(provider: string, model: string) {
  const { data } = await supa()
    .from("igreen_provider_health")
    .select("*")
    .eq("provider", provider)
    .eq("model", model)
    .maybeSingle();
  return data;
}