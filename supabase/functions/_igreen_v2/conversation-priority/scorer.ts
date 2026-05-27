import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type Tier = "hot" | "warm" | "cold";
export interface ScoreInput { account_id: string; phone: string; state: any; last_message_at?: string | null }
export interface ScoreResult { score: number; tier: Tier; reasons: string[] }

export function computeScore(input: ScoreInput): ScoreResult {
  const reasons: string[] = []; let score = 0;
  const st = input.state ?? {}; const etapa = String(st.etapa_funil ?? "").toLowerCase();
  if (etapa.includes("pagamento") || etapa.includes("fechamento")) { score += 50; reasons.push("payment_stage"); }
  if (etapa.includes("fatura") || etapa.includes("validacao") || st.document_status === "pending") { score += 35; reasons.push("doc_validation"); }
  if (etapa.includes("onboarding")) { score += 20; reasons.push("onboarding"); }
  if (st.fatura_valida === true) { score += 25; reasons.push("invoice_validated"); }
  const lastMs = input.last_message_at ? Date.now() - new Date(input.last_message_at).getTime() : 0;
  if (input.last_message_at && lastMs < 2 * 60_000) { score += 30; reasons.push("recent_reply"); }
  else if (input.last_message_at && lastMs > 24 * 3600_000) { score -= 20; reasons.push("stale"); }
  const tier: Tier = score >= 60 ? "hot" : score >= 20 ? "warm" : "cold";
  return { score, tier, reasons };
}
export async function scoreAndPersist(input: ScoreInput): Promise<ScoreResult> {
  const r = computeScore(input);
  try {
    await supa().from("igreen_conversation_priority").upsert({
      account_id: input.account_id, phone: input.phone,
      score: r.score, tier: r.tier, reasons: r.reasons,
      last_scored_at: new Date().toISOString(),
    }, { onConflict: "account_id,phone" });
  } catch (e) { console.error("[conv-priority] persist failed", e); }
  return r;
}
