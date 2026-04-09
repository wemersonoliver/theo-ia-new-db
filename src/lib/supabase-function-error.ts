export async function toFunctionError(error: unknown): Promise<Error> {
  if (!error || typeof error !== "object") {
    return new Error("Erro inesperado ao chamar a função");
  }

  const context = "context" in error ? (error as { context?: Response }).context : undefined;
  if (!context) {
    return error instanceof Error ? error : new Error("Erro inesperado ao chamar a função");
  }

  try {
    const response = typeof context.clone === "function" ? context.clone() : context;
    const payload = await response.json().catch(async () => {
      const text = await response.text();
      return text ? { error: text } : null;
    });

    const message = payload?.error || payload?.message || (error instanceof Error ? error.message : "Erro ao chamar a função");
    const resolvedError = new Error(message);
    if (payload?.diagnostics) {
      (resolvedError as Error & { diagnostics?: unknown }).diagnostics = payload.diagnostics;
    }
    return resolvedError;
  } catch {
    return error instanceof Error ? error : new Error("Erro inesperado ao chamar a função");
  }
}