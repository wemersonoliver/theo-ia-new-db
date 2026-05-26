// Phase 5 — Timeout orchestrator.
// Wrappa promessas com timeout determinístico. Fallback registrado em traces.

export interface TimeoutBudgets {
  toolMs: number;
  agentMs: number;
  transportMs: number;
  ragMs: number;
}

export const DEFAULT_TIMEOUTS: TimeoutBudgets = {
  toolMs: 12_000,
  agentMs: 25_000,
  transportMs: 8_000,
  ragMs: 4_000,
};

export class TimeoutError extends Error {
  constructor(public label: string, public ms: number) {
    super(`Timeout: ${label} exceeded ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  fallback?: () => Promise<T> | T,
): Promise<T> {
  const ctrl = new AbortController();
  let to: number | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      to = setTimeout(() => {
        ctrl.abort();
        reject(new TimeoutError(label, ms));
      }, ms) as unknown as number;
      fn(ctrl.signal).then(resolve, reject);
    });
  } catch (e) {
    if (e instanceof TimeoutError && fallback) {
      return await fallback();
    }
    throw e;
  } finally {
    if (to !== undefined) clearTimeout(to);
  }
}