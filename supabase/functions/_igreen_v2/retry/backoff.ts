// Phase 5 — Retry/backoff exponencial com jitter.
// base=400ms, factor=2, max=8s, attempts=3
// Classes: transient (retry), provider_4xx (no-retry), budget (no-retry)

export type RetryClass = "transient" | "provider_4xx" | "budget";

export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  factor?: number;
  maxMs?: number;
  classify?: (err: unknown) => RetryClass;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

const defaultClassify = (err: unknown): RetryClass => {
  const msg = String((err as Error)?.message ?? err ?? "");
  if (/4\d\d|invalid|unauthor|forbid/i.test(msg)) return "provider_4xx";
  if (/budget|quota|cap/i.test(msg)) return "budget";
  return "transient";
};

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseMs ?? 400;
  const factor = opts.factor ?? 2;
  const max = opts.maxMs ?? 8000;
  const classify = opts.classify ?? defaultClassify;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const cls = classify(err);
      if (cls !== "transient" || i === attempts - 1) throw err;
      const exp = Math.min(max, base * Math.pow(factor, i));
      const jitter = Math.random() * 0.3 * exp;
      const delay = Math.floor(exp + jitter);
      opts.onRetry?.(i + 1, err, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}