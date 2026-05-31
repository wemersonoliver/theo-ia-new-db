// Automation router — lê events da rodada e dispara automações idempotentes.
// Único caminho que executa automações na vertical Igreen V2.
// Patches aplicados pelas automações passam pelo state-engine (D14).

import type { IgreenConversationState, IgreenEvent } from "../types.ts";
import { getAutomation, registerAllAutomations } from "../automations/_register-all.ts";
import { applyPatch } from "../state-engine/update.ts";
import { trace } from "../observability/trace.ts";

registerAllAutomations();

interface DispatchInput {
  account_id: string;
  phone: string;
  correlation_id?: string | null;
  state: IgreenConversationState;
  events: IgreenEvent[];
}

interface PlannedAutomation {
  name: string;
  args: Record<string, unknown>;
}

function planFromEvents(events: IgreenEvent[]): PlannedAutomation[] {
  const plan: PlannedAutomation[] = [];
  for (const ev of events) {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    switch (ev.type) {
      case "handoff_requested":
      case "failsafe_triggered":
        plan.push({ name: "handoff", args: { reason: String(p.reason ?? ev.type) } });
        break;
      case "invoice_approved":
        plan.push({ name: "tagging", args: { tag: "fatura_ok" } });
        break;
      case "invoice_rejected":
        plan.push({ name: "tagging", args: { tag: "fatura_rejeitada" } });
        break;
      case "contact_tag_added":
        plan.push({ name: "tagging", args: { tag: String(p.tag ?? "") } });
        break;
      // NOTA: 'discovery_video_sent' NÃO dispara mais 'media-dispatch'.
      // O envio do vídeo é feito apenas pela tool send_discovery_video.
      // Anteriormente, isso causava envio duplicado.
    }
  }
  return plan;
}

export async function dispatchAutomations(input: DispatchInput): Promise<Array<{ name: string; result: unknown }>> {
  const plan = planFromEvents(input.events);
  const out: Array<{ name: string; result: unknown }> = [];
  for (const p of plan) {
    const fn = getAutomation(p.name);
    if (!fn) { out.push({ name: p.name, result: { skipped: true, reason: "not_registered" } }); continue; }
    const t0 = Date.now();
    const result = await fn(
      { account_id: input.account_id, phone: input.phone, correlation_id: input.correlation_id, state: input.state },
      p.args,
    );
    // Patches/events das automações sobem pelo state-engine (D14).
    if ((result.suggested_state_patch && Object.keys(result.suggested_state_patch).length) || result.events?.length) {
      await applyPatch({
        account_id: input.account_id,
        phone: input.phone,
        patch: result.suggested_state_patch,
        events: result.events,
        source: `automation:${p.name}`,
        correlation_id: input.correlation_id,
      });
    }
    await trace({
      account_id: input.account_id, phone: input.phone,
      step: `automation.${p.name}.done`, level: "standard",
      duration_ms: Date.now() - t0,
      payload: { skipped: result.skipped ?? false, success: result.success ?? false, error: result.error ?? null },
      correlation_id: input.correlation_id,
    });
    out.push({ name: p.name, result });
  }
  return out;
}