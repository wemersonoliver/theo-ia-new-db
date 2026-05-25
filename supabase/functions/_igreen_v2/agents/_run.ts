// Wrapper de execução de specialist com timeout hard de 15s.
// Em throw ou timeout → degrada para failsafe.

import type { AgentContext, AgentResult, AgentRunner } from "./_types.ts";
import { trace } from "../observability/trace.ts";
import { runFailsafe } from "./failsafe/run.ts";

const SPECIALIST_TIMEOUT_MS = 15000;

export async function runAgent(args: {
  specialist: string;
  runner: AgentRunner;
  ctx: AgentContext;
}): Promise<AgentResult> {
  const { specialist, runner, ctx } = args;
  const t0 = Date.now();

  await trace({
    account_id: ctx.account_id,
    phone: ctx.phone,
    step: "specialist_started",
    level: "standard",
    payload: { specialist },
  });

  try {
    const result = await Promise.race([
      runner(ctx),
      new Promise<AgentResult>((_, reject) =>
        setTimeout(() => reject(new Error("specialist_timeout")), SPECIALIST_TIMEOUT_MS),
      ),
    ]);

    await trace({
      account_id: ctx.account_id,
      phone: ctx.phone,
      step: "specialist_completed",
      level: "standard",
      duration_ms: Date.now() - t0,
      payload: {
        specialist,
        specialist_latency_ms: Date.now() - t0,
        messages_count: result.messages.length,
        tools_requested: result.tool_calls.map((t) => t.name),
      },
    });
    return result;
  } catch (e) {
    const isTimeout = (e as Error).message === "specialist_timeout";
    await trace({
      account_id: ctx.account_id,
      phone: ctx.phone,
      step: isTimeout ? "agent_timeout" : "specialist_error",
      level: "standard",
      duration_ms: Date.now() - t0,
      payload: { specialist, error: (e as Error).message },
    });
    return runFailsafe({ ...ctx, intent: isTimeout ? "timeout" : "error" });
  }
}