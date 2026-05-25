// Registro central de automações. Nome duplicado quebra o boot.

import { handoffAutomation } from "./handoff.ts";
import { taggingAutomation } from "./tagging.ts";
import { mediaDispatchAutomation } from "./media-dispatch.ts";

export interface AutomationDispatchContext {
  account_id: string;
  phone: string;
  correlation_id?: string | null;
  state: import("../types.ts").IgreenConversationState;
}

export type AutomationFn = (
  ctx: AutomationDispatchContext,
  args: Record<string, unknown>,
) => Promise<import("../types.ts").AutomationResult>;

const REGISTRY = new Map<string, AutomationFn>();

function register(name: string, fn: AutomationFn) {
  if (REGISTRY.has(name)) throw new Error(`[automations] já registrada: ${name}`);
  REGISTRY.set(name, fn);
}

let _registered = false;
export function registerAllAutomations(): void {
  if (_registered) return;
  register("handoff", (ctx, a) => handoffAutomation({
    account_id: ctx.account_id, phone: ctx.phone,
    correlation_id: ctx.correlation_id,
    reason: String(a.reason ?? "unspecified"),
  }));
  register("tagging", (ctx, a) => taggingAutomation({
    account_id: ctx.account_id, phone: ctx.phone,
    correlation_id: ctx.correlation_id,
    tag: String(a.tag ?? ""),
  }));
  register("media-dispatch", (ctx, a) => mediaDispatchAutomation({
    account_id: ctx.account_id, phone: ctx.phone,
    correlation_id: ctx.correlation_id,
    media_key: String(a.media_key ?? ""),
    state: ctx.state,
  }));
  _registered = true;
}

export function getAutomation(name: string): AutomationFn | undefined {
  return REGISTRY.get(name);
}

export function listAutomations(): string[] {
  return Array.from(REGISTRY.keys());
}