// Compara titular da fatura com nome do cliente.
// Normaliza (lowercase + sem acento), calcula Jaccard de tokens + Levenshtein.
// Mismatch bloqueia aprovação mesmo com confidence alta.

export type HolderMatchStatus = "match" | "mismatch" | "unknown";

export interface HolderMatchResult {
  status: HolderMatchStatus;
  score: number;
  normalized_holder?: string;
  normalized_client?: string;
}

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return s.split(" ").filter((t) => t.length >= 2);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export function matchHolder(
  holderName: string | null | undefined,
  clientName: string | null | undefined,
): HolderMatchResult {
  const nh = normalize(holderName);
  const nc = normalize(clientName);
  if (!nh || !nc) {
    return { status: "unknown", score: 0, normalized_holder: nh, normalized_client: nc };
  }
  const th = tokens(nh);
  const tc = tokens(nc);
  const j = jaccard(th, tc);
  const primaryH = th[0] ?? "";
  const primaryC = tc[0] ?? "";
  const lev = levenshteinSimilarity(primaryH, primaryC);
  // Combinação simples: peso 0.6 jaccard + 0.4 levenshtein do token principal.
  const score = Math.max(0, Math.min(1, 0.6 * j + 0.4 * lev));
  const status: HolderMatchStatus = score >= 0.6 ? "match" : "mismatch";
  return { status, score, normalized_holder: nh, normalized_client: nc };
}