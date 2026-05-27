import { recordMetric } from "../analytics/recorder.ts";
export async function timed<T>(module: string, account_id: string, correlation_id: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    await recordMetric({ account_id, correlation_id, metric: `latency.${module}`, value: Date.now() - t0, dims: { ok: true } });
    return r;
  } catch (e) {
    await recordMetric({ account_id, correlation_id, metric: `latency.${module}`, value: Date.now() - t0, dims: { ok: false, error: (e as Error).message?.slice(0, 200) } });
    throw e;
  }
}
