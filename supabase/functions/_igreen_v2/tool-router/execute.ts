// Pipeline canônico de execução de tool (D4 + D14).
//
//  1. emite tool_execution_started
//  2. valida args
//  3. acquire lock (skip se ocupado)
//  4. tool.execute() → ToolResult
//  5. se success && suggested_state_patch → state-engine.applyPatch (ÚNICO writer)
//  6. emite tool_execution_finished (sempre, success ou fail)

import type { ToolResult } from "../types.ts";
import type { ToolContext, ToolDefinition } from "./types.ts";
import { applyPatch } from "../state-engine/update.ts";
import { emitEvents, trace } from "../observability/trace.ts";
import { acquireLock, releaseLock } from "./_guard.ts";
import { getTool } from "./registry.ts";

export async function executeTool(args: {
  ctx: ToolContext;
  tool_name: string;
  args: unknown;
}): Promise<ToolResult> {
  const { ctx, tool_name } = args;
  const tool = getTool(tool_name) as ToolDefinition<any> | undefined;

  if (!tool) {
    const err: ToolResult = { success: false, error: `tool_not_found:${tool_name}` };
    await emitEvents(ctx.account_id, ctx.phone, [
      { type: "tool_execution_finished", priority: "high", source: "tool",
        payload: { tool: tool_name, success: false, error: err.error } },
    ]);
    return err;
  }

  let parsedArgs: any = args.args ?? {};
  try {
    if (tool.validate) parsedArgs = tool.validate(args.args);
  } catch (e) {
    const err: ToolResult = { success: false, error: `invalid_args:${(e as Error).message}` };
    await emitEvents(ctx.account_id, ctx.phone, [
      { type: "tool_execution_finished", priority: "high", source: "tool",
        payload: { tool: tool_name, success: false, error: err.error } },
    ]);
    return err;
  }

  const lock_key = tool.idempotencyKey(parsedArgs, ctx);

  await emitEvents(ctx.account_id, ctx.phone, [
    { type: "tool_execution_started", priority: "low", source: "tool",
      payload: { tool: tool_name, lock_key } },
  ]);

  const t0 = Date.now();
  const lock = await acquireLock({
    account_id: ctx.account_id,
    phone: ctx.phone,
    tool: tool_name,
    lock_key,
  });

  if (!lock) {
    const skipped: ToolResult = { success: true, skipped: true, skip_reason: "lock_conflict" };
    await emitEvents(ctx.account_id, ctx.phone, [
      { type: "tool_execution_finished", priority: "medium", source: "tool",
        payload: { tool: tool_name, success: true, skipped: true, reason: "lock_conflict" } },
    ]);
    return skipped;
  }

  let result: ToolResult;
  try {
    result = await tool.execute(ctx, parsedArgs);
  } catch (e) {
    result = { success: false, error: (e as Error).message };
  }

  // D14 — único writer
  if (result.success && !result.skipped && result.suggested_state_patch) {
    await applyPatch({
      account_id: ctx.account_id,
      phone: ctx.phone,
      patch: result.suggested_state_patch,
      events: result.events,
      source: `tool:${tool_name}`,
    });
  } else if (result.events?.length) {
    await emitEvents(ctx.account_id, ctx.phone, result.events);
  }

  await releaseLock(lock);

  await trace({
    account_id: ctx.account_id,
    phone: ctx.phone,
    step: `tool.${tool_name}.done`,
    level: "standard",
    duration_ms: Date.now() - t0,
    payload: { success: result.success, skipped: result.skipped ?? false, error: result.error ?? null },
  });

  await emitEvents(ctx.account_id, ctx.phone, [
    { type: "tool_execution_finished", priority: result.success ? "low" : "high", source: "tool",
      payload: {
        tool: tool_name,
        success: result.success,
        skipped: result.skipped ?? false,
        error: result.error ?? null,
        duration_ms: Date.now() - t0,
      } },
  ]);

  return result;
}