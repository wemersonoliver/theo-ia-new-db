// Lê de system_ai_provider qual provedor de IA é o padrão do sistema.
// Resultado em cache por 30s para não fazer query a cada mensagem.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AIProvider = "gemini" | "openai";

let _cache: { value: AIProvider; until: number } | null = null;
const TTL_MS = 30_000;

export async function getPrimaryProvider(): Promise<AIProvider> {
  const now = Date.now();
  if (_cache && _cache.until > now) return _cache.value;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "gemini";

  try {
    const supa = createClient(url, key);
    const { data, error } = await supa
      .from("system_ai_provider")
      .select("primary_provider")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[ai-provider] erro lendo system_ai_provider:", error.message);
      _cache = { value: "gemini", until: now + TTL_MS };
      return "gemini";
    }
    const value: AIProvider = (data?.primary_provider === "openai") ? "openai" : "gemini";
    _cache = { value, until: now + TTL_MS };
    return value;
  } catch (e) {
    console.warn("[ai-provider] exception:", (e as Error).message);
    _cache = { value: "gemini", until: now + TTL_MS };
    return "gemini";
  }
}

export function invalidatePrimaryProviderCache() {
  _cache = null;
}
