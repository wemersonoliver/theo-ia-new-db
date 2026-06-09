import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternalKey } from "../_cron_auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const SILENCE_MINUTES = 60;
const LOOKBACK_HOURS = 24;
const BATCH_LIMIT = 100;
const TRIGGER_TAG = "CENARIO1";
const PRODUCT_KEY = "green";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const unauth = requireInternalKey(req);
  if (unauth) return unauth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalKey = Deno.env.get("INTERNAL_CRON_SECRET") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const silenceCutoff = new Date(now.getTime() - SILENCE_MINUTES * 60_000).toISOString();
  const lookbackCutoff = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000).toISOString();

  // 1. Candidatos: produto=green, sem vídeo enviado, sem handoff, silêncio >= 60 min,
  //    dentro da janela de 24h, sem matrícula prévia (extras.pre_video_enrolled_at vazio).
  const { data: candidates, error } = await supabase
    .from("igreen_conversation_state")
    .select("id, account_id, phone, extras, last_event_at, handoff_ativo")
    .eq("produto", PRODUCT_KEY)
    .lt("last_event_at", silenceCutoff)
    .gt("last_event_at", lookbackCutoff)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[pre-video-sweeper] query error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let enrolled = 0,
    skipped = 0,
    failed = 0,
    examined = 0;

  for (const row of candidates || []) {
    examined++;
    try {
      const extras = (row.extras as Record<string, unknown> | null) || {};

      // filtros que não dá pra fazer no SELECT (jsonb)
      if (extras["video_sent"] === true) {
        skipped++;
        continue;
      }
      if (extras["pre_video_enrolled_at"]) {
        skipped++;
        continue;
      }
      if (row.handoff_ativo === true) {
        skipped++;
        continue;
      }

      // 2. Conversa: confirma que a última msg foi do AI (from_me=true) e não está fechada
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("messages, closed_at, outcome")
        .eq("account_id", row.account_id)
        .eq("phone", row.phone)
        .maybeSingle();

      if (!conv) {
        skipped++;
        continue;
      }
      if (conv.closed_at || conv.outcome) {
        await markSkipped(supabase, row.id, extras, "conversation_closed");
        skipped++;
        continue;
      }
      const msgs = Array.isArray(conv.messages) ? (conv.messages as any[]) : [];
      if (msgs.length === 0) {
        skipped++;
        continue;
      }
      const last = msgs[msgs.length - 1];
      if (last && last.from_me !== true) {
        // cliente foi quem mandou por último → ainda está conversando
        skipped++;
        continue;
      }

      // 3. Já passou pelo fluxo do vídeo? então não é caso deste sweeper
      const { data: videoFu } = await supabase
        .from("igreen_product_video_followups")
        .select("id")
        .eq("account_id", row.account_id)
        .eq("phone", row.phone)
        .limit(1)
        .maybeSingle();
      if (videoFu) {
        await markSkipped(supabase, row.id, extras, "video_flow_active");
        skipped++;
        continue;
      }

      // 4. Já tem enrollment ativo?
      const { data: existing } = await supabase
        .from("igreen_scenario_enrollments")
        .select("id, status")
        .eq("account_id", row.account_id)
        .eq("contact_phone", row.phone)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (existing) {
        await markSkipped(supabase, row.id, extras, "already_enrolled");
        skipped++;
        continue;
      }

      // 5. Cenário CENARIO1 habilitado na conta?
      const { data: scenario } = await supabase
        .from("igreen_scenarios")
        .select("id, enabled")
        .eq("account_id", row.account_id)
        .ilike("trigger_tag", TRIGGER_TAG)
        .eq("product_key", PRODUCT_KEY)
        .maybeSingle();
      if (!scenario || !scenario.enabled) {
        await markSkipped(supabase, row.id, extras, "scenario_disabled");
        skipped++;
        continue;
      }

      // 6. contact_id (best effort)
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", row.account_id)
        .eq("phone", row.phone)
        .maybeSingle();

      // 7. Chama o enroll
      const enrollRes = await fetch(`${supabaseUrl}/functions/v1/igreen-scenario-enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        },
        body: JSON.stringify({
          account_id: row.account_id,
          phone: row.phone,
          contact_id: contact?.id ?? null,
          trigger_tag: TRIGGER_TAG,
        }),
      });

      if (!enrollRes.ok) {
        const txt = await enrollRes.text();
        console.error("[pre-video-sweeper] enroll failed", row.id, enrollRes.status, txt);
        failed++;
        continue; // sem marcar pre_video_enrolled_at → tenta de novo no próximo ciclo
      }

      // 8. Marca idempotência em extras
      await supabase
        .from("igreen_conversation_state")
        .update({
          extras: {
            ...extras,
            pre_video_enrolled_at: new Date().toISOString(),
            pre_video_enrolled_via: "sweeper",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      enrolled++;
    } catch (e) {
      console.error("[pre-video-sweeper] row error", row.id, e);
      failed++;
    }
  }

  const summary = { ok: true, examined, enrolled, skipped, failed };
  console.log("[pre-video-sweeper] done", summary);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function markSkipped(
  supabase: ReturnType<typeof createClient>,
  stateId: string,
  extras: Record<string, unknown>,
  reason: string,
) {
  await supabase
    .from("igreen_conversation_state")
    .update({
      extras: { ...extras, pre_video_skipped_reason: reason, pre_video_skipped_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", stateId);
}