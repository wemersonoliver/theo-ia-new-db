// OpenAI fallback wrapper — usado quando Gemini falha (429, 5xx, timeout, safety).
// Mantém superfície minimalista: JSON-mode text + vision (image base64).
//
// NÃO chama direto do cliente. Apenas edge functions usam.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type OpenAIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
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
}

export interface OpenAIResult {
  text: string;
  raw: any;
  model: string;
}

/** Texto / JSON simples. */
export async function callOpenAI(opts: OpenAICallOptions): Promise<OpenAIResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("openai_no_api_key");

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
      throw new Error(`openai_${res.status}:${errText.slice(0, 200)}`);
    }
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    return { text, raw: j, model };
  } finally {
    clearTimeout(timer);
  }
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
