// Fase 6 — Circuit Breaker por (provider, model)
// Estados: closed | open | half_open
// Threshold: 5 falhas consecutivas abre; cooldown 60s; half_open testa 1 chamada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { trace } from "../observability/trace.ts";

const supa = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const FAIL_THRESHOLD = 5;
const COOLDOWN_MS = 60_000;

export type BreakerState = "closed" | "open" | "half_open";

export async function getBreakerState(
  provider: string,
  model: string,
): Promise<BreakerState> {
  const client = supa();
  const { data } = await client
    .from("igreen_provider_circuit_breakers")
    .select("*")
    .eq("provider", provider)
    .eq("model", model)
    .maybeSingle();

  if (!data) return "closed";
  if (data.state === "open") {
    const now = Date.now();
    const cooldownEnd = data.cooldown_until ? new Date(data.cooldown_until).getTime() : 0;
    if (now >= cooldownEnd) {
      await client
        .from("igreen_provider_circuit_breakers")
        .update({ state: "half_open", updated_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("model", model);
      return "half_open";
    }
    return "open";
  }
  return data.state as BreakerState;
}

export async function recordBreakerOutcome(opts: {
  provider: string;
  model: string;
  success: boolean;
  reason?: string;
  correlation_id?: string;
}): Promise<void> {
  const client = supa();
  const { data: existing } = await client
    .from("igreen_provider_circuit_breakers")
    .select("*")
    .eq("provider", opts.provider)
    .eq("model", opts.model)
    .maybeSingle();

  const now = new Date();

  if (!existing) {
    await client.from("igreen_provider_circuit_breakers").insert({
      provider: opts.provider,
      model: opts.model,
      state: "closed",
      consecutive_failures: opts.success ? 0 : 1,
    });
    return;
  }

  if (opts.success) {
    await client
      .from("igreen_provider_circuit_breakers")
      .update({
        state: "closed",
        consecutive_failures: 0,
        opened_at: null,
        cooldown_until: null,
        reason: null,
        updated_at: now.toISOString(),
      })
      .eq("provider", opts.provider)
      .eq("model", opts.model);
    return;
  }

  const newFails = existing.consecutive_failures + 1;
  const shouldOpen = newFails >= FAIL_THRESHOLD;

  await client
    .from("igreen_provider_circuit_breakers")
    .update({
      state: shouldOpen ? "open" : existing.state,
      consecutive_failures: newFails,
      opened_at: shouldOpen ? now.toISOString() : existing.opened_at,
      cooldown_until: shouldOpen
        ? new Date(now.getTime() + COOLDOWN_MS).toISOString()
        : existing.cooldown_until,
      reason: opts.reason ?? existing.reason,
      updated_at: now.toISOString(),
    })
    .eq("provider", opts.provider)
    .eq("model", opts.model);

  if (shouldOpen) {
    await trace({
      account_id: "system",
      phone: "system",
      step: "provider.circuit_open",
      level: "minimal",
      payload: { provider: opts.provider, model: opts.model, reason: opts.reason },
      correlation_id: opts.correlation_id,
    });
  }
}