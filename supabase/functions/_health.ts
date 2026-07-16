// Helper compartilhado para reportar saúde de APIs externas (Evolution, Gemini, Groq, ElevenLabs).
// Uso: chame reportApiSuccess('evolution_api') após sucesso e reportApiFailure('evolution_api', errMsg) após falha.
// O alerta WhatsApp para super_admins é disparado automaticamente respeitando o cooldown de 15 minutos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ApiName = "evolution_api" | "gemini" | "groq" | "elevenlabs";
export type ApiHealthContext = Record<string, unknown>;

const COOLDOWN_MINUTES = 15;
// Só dispara alerta após N falhas consecutivas — evita flapping em erros transientes
// (ex.: Evolution API "Connection Closed" que se resolve na próxima chamada).
const FAILURE_THRESHOLD = 3;
// Além da quantidade de falhas, exige que a API fique sem sucesso por um tempo mínimo.
// Isso evita alertas quando várias requisições simultâneas falham no mesmo segundo.
const MIN_DOWN_SECONDS_BEFORE_ALERT = 60;
// Após um alerta de queda, só envia "restabelecida" quando a API estiver estável
// por este tempo (sem novas falhas). Evita mensagens "caiu/voltou" com segundos de diferença.
const MIN_STABLE_OK_SECONDS_BEFORE_RECOVERY = 300;

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
      .select("status, recovery_alert_sent, last_alert_sent_at, last_error_at, incident_started_at")
      .eq("api_name", apiName)
      .maybeSingle();

    const now = new Date();
    const hadFailureAlert = !!row?.last_alert_sent_at && row?.recovery_alert_sent === false;

    // Sempre marca a API como OK e zera falhas, mas NÃO limpa last_alert_sent_at
    // enquanto a recuperação não for confirmada. Isso permite medir o tempo estável ok.
    await supabase
      .from("system_api_health")
      .update({
        status: "ok",
        last_ok_at: now.toISOString(),
        consecutive_failures: 0,
        // recovery_alert_sent só vira true quando de fato enviamos a mensagem abaixo.
        recovery_alert_sent: hadFailureAlert ? false : true,
        // Se nunca houve alerta, o sucesso encerra o incidente transitório.
        // Se houve alerta, só limpamos quando a recuperação estável for confirmada.
        incident_started_at: hadFailureAlert ? (row?.incident_started_at ?? null) : null,
      })
      .eq("api_name", apiName);

    let shouldSendRecoveryAlert = false;

    if (hadFailureAlert) {
      // Só envia "restabelecida" quando a API está estável há X segundos sem novos erros.
      const lastErrMs = row?.last_error_at ? new Date(row.last_error_at).getTime() : 0;
      const stableForMs = lastErrMs ? now.getTime() - lastErrMs : Number.POSITIVE_INFINITY;

      if (stableForMs >= MIN_STABLE_OK_SECONDS_BEFORE_RECOVERY * 1000) {
        // Claim atômico: só uma execução consegue marcar recovery_alert_sent=true
        const { data: claimed } = await supabase
          .from("system_api_health")
          .update({
            recovery_alert_sent: true,
            last_alert_sent_at: null,
            incident_started_at: null,
          })
          .eq("api_name", apiName)
          .eq("recovery_alert_sent", false)
          .not("last_alert_sent_at", "is", null)
          .select("api_name");

        shouldSendRecoveryAlert = (claimed?.length ?? 0) > 0;
      }
    }

    if (shouldSendRecoveryAlert) {
      // Dispara alerta de recuperação (não-bloqueante)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-api-failure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-internal-key": Deno.env.get("INTERNAL_CRON_SECRET") ?? "",
        },
        body: JSON.stringify({ api_name: apiName, kind: "recovery" }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error(`[health] reportApiSuccess(${apiName}) failed:`, e);
  }
}

export async function reportApiFailure(
  apiName: ApiName,
  errorMessage: string,
  context: ApiHealthContext = {},
): Promise<void> {
  try {
    const supabase = admin();
    const now = new Date();

    const { data: row } = await supabase
      .from("system_api_health")
      .select("consecutive_failures, last_alert_sent_at, last_ok_at, status, incident_started_at, recovery_alert_sent")
      .eq("api_name", apiName)
      .maybeSingle();

    const newFailures = (row?.consecutive_failures ?? 0) + 1;
    const trimmedError = (errorMessage || "Unknown error").slice(0, 500);
    const isUnresolvedAlert = !!row?.last_alert_sent_at && row?.recovery_alert_sent === false;
    const isNewIncident = row?.status !== "down" && !isUnresolvedAlert;
    const incidentStartedAt = isNewIncident || !row?.incident_started_at
      ? now.toISOString()
      : row.incident_started_at;

    await supabase
      .from("system_api_health")
      .update({
        status: "down",
        last_error_at: now.toISOString(),
        last_error_message: trimmedError,
        last_error_context: context,
        incident_started_at: incidentStartedAt,
        consecutive_failures: newFailures,
        recovery_alert_sent: false,
        // Limpa alerta antigo quando começa uma nova queda.
        // Assim, uma falha transitória após uma queda real anterior não dispara
        // mensagem falsa de recuperação.
        last_alert_sent_at: isNewIncident ? null : row?.last_alert_sent_at,
      })
      .eq("api_name", apiName);

    // Só alerta após N falhas consecutivas (evita flapping em erros transientes).
    if (newFailures < FAILURE_THRESHOLD) {
      return;
    }

    // Também exige tempo mínimo sem sucesso. Várias chamadas simultâneas podem
    // acumular 3+ falhas em 1-2 segundos, mas isso não significa API fora do ar.
    // Mede a duração da queda pelo primeiro erro do incidente atual, não pelo
    // último sucesso global. Sem isso, 3 erros simultâneos horas após o último
    // sucesso eram interpretados como "API fora há horas".
    const incidentStartMs = incidentStartedAt ? new Date(incidentStartedAt).getTime() : 0;
    const downForMs = incidentStartMs ? now.getTime() - incidentStartMs : Number.POSITIVE_INFINITY;
    if (downForMs < MIN_DOWN_SECONDS_BEFORE_ALERT * 1000) {
      return;
    }

    // Cooldown: só dispara alerta se passaram >= 15min do último alerta
    const lastAlert = row?.last_alert_sent_at ? new Date(row.last_alert_sent_at).getTime() : 0;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const shouldAlert = now.getTime() - lastAlert >= cooldownMs;

    if (shouldAlert) {
      // Claim atômico simples: só uma execução consegue trocar o mesmo
      // last_alert_sent_at antigo pelo timestamp atual. Evita alertas duplicados
      // quando várias Edge Functions falham ao mesmo tempo.
      let update = supabase
        .from("system_api_health")
        .update({ last_alert_sent_at: now.toISOString() })
        .eq("api_name", apiName);

      update = row?.last_alert_sent_at
        ? update.eq("last_alert_sent_at", row.last_alert_sent_at)
        : update.is("last_alert_sent_at", null);

      const { data: claimed } = await update.select("api_name");
      const claimedAlert = (claimed?.length ?? 0) > 0;

      if (!claimedAlert) {
        return;
      }

      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-api-failure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-internal-key": Deno.env.get("INTERNAL_CRON_SECRET") ?? "",
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