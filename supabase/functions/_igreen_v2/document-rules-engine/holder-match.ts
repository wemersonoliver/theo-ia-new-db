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

// Stopwords comuns em rótulos de faturas brasileiras que o OCR costuma
// concatenar ao nome do titular ("WEMERSON LEITE OLIVEIRA UNIDADE CONSUMIDORA",
// "FULANO DE TAL TITULAR DA CONTA", etc.). Removemos para não penalizar o jaccard.
const HOLDER_STOPWORDS = new Set([
  "de","da","do","das","dos","e",
  "unidade","consumidora","consumidor","titular","cliente","contrato","conta","fatura",
  "endereco","endereço","rua","avenida","av","numero","número","cep","cpf","cnpj","rg",
  "identificacao","identificação","instalacao","instalação","ucs","uc","cod","codigo","código",
  "nome","sr","sra","mc","cia","ltda","me","eireli","sa","s","a",
  "distribuidora","distribuidor","fornecimento","leitura","referencia","referência",
]);

function cleanHolderTokens(toks: string[]): string[] {
  return toks.filter((t) => !HOLDER_STOPWORDS.has(t));
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
  const thRaw = tokens(nh);
  const tcRaw = tokens(nc);
  // Remove rótulos de fatura (UNIDADE CONSUMIDORA, TITULAR, etc.) que o OCR cola no nome.
  const th = cleanHolderTokens(thRaw);
  const tc = cleanHolderTokens(tcRaw);
  if (th.length === 0 || tc.length === 0) {
    return { status: "unknown", score: 0, normalized_holder: nh, normalized_client: nc };
  }
  const j = jaccard(th, tc);
  const primaryH = th[0] ?? "";
  const primaryC = tc[0] ?? "";
  const lev = levenshteinSimilarity(primaryH, primaryC);
  // Combinação simples: peso 0.6 jaccard + 0.4 levenshtein do token principal.
  let score = Math.max(0, Math.min(1, 0.6 * j + 0.4 * lev));
  let status: HolderMatchStatus = score >= 0.6 ? "match" : "mismatch";

  // Caso comum no onboarding: cliente foi cadastrado apenas com o primeiro nome
  // (ex.: "Wemerson") e a fatura traz o nome completo ("Wemerson Leite Oliveira").
  // Se o primeiro nome bater exatamente, consideramos match — não há como exigir
  // sobrenomes do cliente quando só o primeiro nome foi coletado.
  if (status !== "match" && tc.length === 1 && primaryH && primaryC && primaryH === primaryC) {
    status = "match";
    score = Math.max(score, 0.8);
  }

  // Reforço: se TODOS os tokens do client_name aparecem no holder_name (subset match),
  // tratamos como match — cobre casos com nome do meio etc.
  if (status !== "match") {
    const setH = new Set(th);
    const allIn = tc.every((t) => setH.has(t));
    if (allIn && primaryH === primaryC) {
      status = "match";
      score = Math.max(score, 0.75);
    }
  }

  return { status, score, normalized_holder: nh, normalized_client: nc };
}