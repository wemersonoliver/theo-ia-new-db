// Tradutor de tools/mensagens entre formato Gemini e OpenAI.
// Usado pelo fallback do whatsapp-ai-agent que conversa em multi-turn com
// function calling no formato nativo do Gemini.

/** Converte um objeto Gemini { functionDeclarations: [...] } → tools[] OpenAI. */
export function geminiToolsToOpenAI(geminiTools: any): any[] {
  const decls = geminiTools?.functionDeclarations ?? [];
  return decls.map((d: any) => ({
    type: "function",
    function: {
      name: d.name,
      description: d.description ?? "",
      parameters: d.parameters ?? { type: "object", properties: {} },
    },
  }));
}

/** Converte contents[] do Gemini (role:user|model + parts[]) → messages[] OpenAI. */
export function geminiContentsToOpenAI(
  contents: any[],
  systemPrompt: string,
): any[] {
  const out: any[] = [{ role: "system", content: systemPrompt }];
  for (const turn of contents ?? []) {
    const role = turn?.role === "model" ? "assistant" : "user";
    const parts = Array.isArray(turn?.parts) ? turn.parts : [];

    // functionResponse → tool message (precisa tool_call_id, mas como não temos
    // controle, emitimos como user com texto descritivo).
    const fr = parts.find((p: any) => p?.functionResponse);
    if (fr) {
      const name = fr.functionResponse?.name ?? "tool";
      const resp = fr.functionResponse?.response ?? {};
      out.push({
        role: "user",
        content: `[resultado da tool ${name}]\n${JSON.stringify(resp).slice(0, 4000)}`,
      });
      continue;
    }

    // functionCall do assistant → assistant com tool_calls sintético
    const fc = parts.find((p: any) => p?.functionCall);
    if (fc && role === "assistant") {
      const id = `call_${Math.random().toString(36).slice(2, 10)}`;
      out.push({
        role: "assistant",
        content: null,
        tool_calls: [{
          id,
          type: "function",
          function: {
            name: fc.functionCall.name,
            arguments: JSON.stringify(fc.functionCall.args ?? {}),
          },
        }],
      });
      continue;
    }

    // Texto puro
    const textParts = parts
      .filter((p: any) => typeof p?.text === "string")
      .map((p: any) => p.text)
      .join("\n");
    if (textParts) out.push({ role, content: textParts });
  }
  return out;
}

/** Converte resposta OpenAI (text + tool_calls normalizados) → Gemini-shape JSON. */
export function openAIResultToGeminiJson(args: {
  text: string;
  tool_calls?: Array<{ name: string; arguments: any }>;
  model: string;
  raw: any;
}): any {
  const parts: any[] = [];
  if (args.tool_calls && args.tool_calls.length > 0) {
    for (const tc of args.tool_calls) {
      parts.push({ functionCall: { name: tc.name, args: tc.arguments ?? {} } });
    }
  }
  if (args.text && args.text.trim().length > 0) {
    parts.push({ text: args.text });
  }
  if (parts.length === 0) parts.push({ text: "" });

  // Estima tokens a partir do uso OpenAI (se disponível) para logTextUsage.
  const usage = args.raw?.usage ?? {};
  return {
    candidates: [{
      content: { role: "model", parts },
      finishReason: args.raw?.choices?.[0]?.finish_reason ?? "STOP",
    }],
    usageMetadata: {
      promptTokenCount: usage?.prompt_tokens ?? 0,
      candidatesTokenCount: usage?.completion_tokens ?? 0,
      totalTokenCount: usage?.total_tokens ?? 0,
    },
    _fallback_provider: "openai",
    _fallback_model: args.model,
  };
}