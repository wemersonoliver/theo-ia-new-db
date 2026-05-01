// Helper compartilhado para reportar saúde de APIs externas (Evolution, Gemini, Groq, ElevenLabs).
// Uso: chame reportApiSuccess('evolution_api') após sucesso e reportApiFailure('evolution_api', errMsg) após falha.
// O alerta WhatsApp para super_admins é disparado automaticamente respeitando o cooldown de 15 minutos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ApiName = "evolution_api" | "gemini" | "groq" | "elevenlabs";

const COOLDOWN_MINUTES = 15;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function reportApiSuccess(apiName: ApiName): Promise<void> {
  try {
    const supabase = admin();
    const { data: row } = await supabase
      .from("system_api_health")
      .select("status, recovery_alert_sent")
      .eq("api_name", apiName)
      .maybeSingle();

    const wasDown = row?.status === "down";
    const needsRecoveryAlert = wasDown && row?.recovery_alert_sent === false;

    await supabase
      .from("system_api_health")
      .update({
        status: "ok",
        last_ok_at: new Date().toISOString(),
        consecutive_failures: 0,
        recovery_alert_sent: true,
      })
      .eq("api_name", apiName);

    if (needsRecoveryAlert) {
      // Dispara alerta de recuperação (não-bloqueante)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-api-failure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ api_name: apiName, kind: "recovery" }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error(`[health] reportApiSuccess(${apiName}) failed:`, e);
  }
}

export async function reportApiFailure(apiName: ApiName, errorMessage: string): Promise<void> {
  try {
    const supabase = admin();
    const now = new Date();

    const { data: row } = await supabase
      .from("system_api_health")
      .select("consecutive_failures, last_alert_sent_at, status")
      .eq("api_name", apiName)
      .maybeSingle();

    const newFailures = (row?.consecutive_failures ?? 0) + 1;
    const trimmedError = (errorMessage || "Unknown error").slice(0, 500);

    await supabase
      .from("system_api_health")
      .update({
        status: "down",
        last_error_at: now.toISOString(),
        last_error_message: trimmedError,
        consecutive_failures: newFailures,
        recovery_alert_sent: false,
      })
      .eq("api_name", apiName);

    // Cooldown: só dispara alerta se passaram >= 15min do último alerta
    const lastAlert = row?.last_alert_sent_at ? new Date(row.last_alert_sent_at).getTime() : 0;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const shouldAlert = now.getTime() - lastAlert >= cooldownMs;

    if (shouldAlert) {
      await supabase
        .from("system_api_health")
        .update({ last_alert_sent_at: now.toISOString() })
        .eq("api_name", apiName);

      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-api-failure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          api_name: apiName,
          kind: "failure",
          error_message: trimmedError,
          consecutive_failures: newFailures,
        }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error(`[health] reportApiFailure(${apiName}) failed:`, e);
  }
}