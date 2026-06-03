// OpenAI fallback wrapper — usado quando Gemini falha (429, 5xx, timeout, safety).
// Mantém superfície minimalista: JSON-mode text + vision (image base64).
//
// NÃO chama direto do cliente. Apenas edge functions usam.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// ===== Circuit breaker para "sem créditos" =====
// Quando um provedor responde "insufficient_quota" / 402, marcamos como esgotado
// por CREDIT_BREAKER_MS. Próximas chamadas pulam direto para o outro provedor.
const CREDIT_BREAKER_MS = 5 * 60_000;
const _creditBlocked: Record<string, number> = {};
export function markProviderOutOfCredits(provider: "openai" | "gemini") {
  _creditBlocked[provider] = Date.now() + CREDIT_BREAKER_MS;
  console.warn(`[ai-fallback] circuit breaker: ${provider} out of credits for ${CREDIT_BREAKER_MS / 1000}s`);
}
export function isProviderOutOfCredits(provider: "openai" | "gemini"): boolean {
  const until = _creditBlocked[provider] ?? 0;
  return Date.now() < until;
}
export function detectCreditError(status: number, body: string): boolean {
  if (status === 402) return true;
  const low = (body || "").toLowerCase();
  return /insufficient[_ ]quota|exceeded.*quota|billing|payment required|out of credits|no credits/.test(low);
}

export type OpenAIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: any[] }
  | { role: "tool"; tool_call_id: string; content: string }
  | { role: "user"; content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > };

export interface OpenAICallOptions {
  model?: string;            // default por tarefa
  messages: OpenAIMessage[];
  json?: boolean;            // response_format json_object (prompt precisa mencionar "json")
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;        // default 20s
  tools?: any[];             // OpenAI-format tools
  tool_choice?: any;
}

export interface OpenAIResult {
  text: string;
  raw: any;
  model: string;
  tool_calls?: Array<{ id: string; name: string; arguments: any }>;
}

/** Texto / JSON simples. */
export async function callOpenAI(opts: OpenAICallOptions): Promise<OpenAIResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("openai_no_api_key");
  if (isProviderOutOfCredits("openai")) throw new Error("openai_circuit_open_credits");

  const model = opts.model ?? "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  try {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
      if (opts.tool_choice) body.tool_choice = opts.tool_choice;
    }

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (detectCreditError(res.status, errText)) {
        markProviderOutOfCredits("openai");
        throw new Error(`openai_credits_exhausted:${errText.slice(0, 200)}`);
      }
      throw new Error(`openai_${res.status}:${errText.slice(0, 200)}`);
    }
    const j = await res.json();
    const msg = j?.choices?.[0]?.message ?? {};
    const text = msg?.content ?? "";
    const tool_calls = Array.isArray(msg?.tool_calls) ? msg.tool_calls.map((t: any) => ({
      id: t.id,
      name: t?.function?.name,
      arguments: safeJsonParse(t?.function?.arguments),
    })) : undefined;
    return { text, raw: j, model, tool_calls };
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse(s: any): any {
  if (typeof s !== "string") return s ?? {};
  try { return JSON.parse(s); } catch { return {}; }
}

/** Vision: imagem em base64 (sem prefixo data:) + mime, mais texto opcional. */
export async function callOpenAIVision(args: {
  systemPrompt: string;
  userPrompt: string;
  imageBase64: string;
  mime: string;
  extraText?: string | null;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<OpenAIResult> {
  const dataUrl = `data:${args.mime};base64,${args.imageBase64}`;
  const userContent: Array<any> = [{ type: "text", text: args.userPrompt }];
  if (args.extraText && args.extraText.length > 0) {
    userContent.push({ type: "text", text: args.extraText });
  }
  userContent.push({ type: "image_url", image_url: { url: dataUrl } });

  return callOpenAI({
    model: args.model ?? "gpt-4o",
    timeoutMs: args.timeoutMs ?? 30_000,
    maxTokens: args.maxTokens ?? 800,
    json: true,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: userContent as any },
    ],
  });
}
