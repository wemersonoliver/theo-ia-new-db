// Helper compartilhado para registrar uso de IA por usuário.
// Chamado pelas edge functions whatsapp-ai-agent, support-ai-agent,
// transcribe-audio e process-image-ocr.

type SupabaseClientLike = {
  from: (t: string) => any;
};

let cachedPricing: any = null;
let cachedAt = 0;

async function getPricing(supabase: SupabaseClientLike) {
  // cache simples por 60s para evitar select a cada chamada
  if (cachedPricing && Date.now() - cachedAt < 60_000) return cachedPricing;
  const { data } = await supabase
    .from("ai_pricing_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  cachedPricing = data || {
    gemini_text_input_per_1k_cents: 0.075,
    gemini_text_output_per_1k_cents: 0.3,
    gemini_vision_per_image_cents: 1.5,
    groq_audio_per_minute_cents: 0.5,
  };
  cachedAt = Date.now();
  return cachedPricing;
}

export async function logTextUsage(
  supabase: SupabaseClientLike,
  params: {
    userId: string;
    source: string;
    tokensInput: number;
    tokensOutput: number;
    referenceId?: string;
  }
) {
  if (!params.userId) return;
  try {
    const pricing = await getPricing(supabase);
    const cost =
      (params.tokensInput / 1000) * Number(pricing.gemini_text_input_per_1k_cents) +
      (params.tokensOutput / 1000) * Number(pricing.gemini_text_output_per_1k_cents);
    await supabase.from("ai_usage_log").insert({
      user_id: params.userId,
      kind: "text",
      source: params.source,
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      cost_cents: cost,
      reference_id: params.referenceId || null,
    });
  } catch (e) {
    console.error("logTextUsage error:", e);
  }
}

export async function logAudioUsage(
  supabase: SupabaseClientLike,
  params: { userId: string; source: string; seconds: number; referenceId?: string }
) {
  if (!params.userId) return;
  try {
    const pricing = await getPricing(supabase);
    const cost = (params.seconds / 60) * Number(pricing.groq_audio_per_minute_cents);
    await supabase.from("ai_usage_log").insert({
      user_id: params.userId,
      kind: "audio",
      source: params.source,
      audio_seconds: Math.round(params.seconds),
      cost_cents: cost,
      reference_id: params.referenceId || null,
    });
  } catch (e) {
    console.error("logAudioUsage error:", e);
  }
}

export async function logImageUsage(
  supabase: SupabaseClientLike,
  params: { userId: string; source: string; images: number; referenceId?: string }
) {
  if (!params.userId) return;
  try {
    const pricing = await getPricing(supabase);
    const cost = params.images * Number(pricing.gemini_vision_per_image_cents);
    await supabase.from("ai_usage_log").insert({
      user_id: params.userId,
      kind: "image",
      source: params.source,
      image_count: params.images,
      cost_cents: cost,
      reference_id: params.referenceId || null,
    });
  } catch (e) {
    console.error("logImageUsage error:", e);
  }
}

/** Extrai usageMetadata padrão da resposta do Gemini. */
export function extractGeminiTokens(geminiData: any): { input: number; output: number } {
  const u = geminiData?.usageMetadata || {};
  return {
    input: Number(u.promptTokenCount) || 0,
    output: Number(u.candidatesTokenCount) || 0,
  };
}