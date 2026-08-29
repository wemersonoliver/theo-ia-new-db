import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";
import { requireInternalKey } from "../_cron_auth.ts";
import { generateScheduleSequence } from "../_followup-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {

  const __authErr = requireInternalKey(req);
  if (__authErr) return __authErr;
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[${runId}] === Starting followup-check-inactive run ===`);

    const { data: configs, error: configError } = await supabase
      .from("followup_config")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      console.error(`[${runId}] Error fetching configs:`, configError);
      throw configError;
    }
    console.log(`[${runId}] Found ${configs?.length || 0} active follow-up configs`);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ created: 0, runId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;
    let totalSkipped = 0;
    const skipReasons: Record<string, number> = {};
    const trackReason = (r: string) => {
      skipReasons[r] = (skipReasons[r] || 0) + 1;
      totalSkipped++;
    };

    for (const config of configs) {
      try {
        const unit = (config.inactivity_unit || "hours") as "minutes" | "hours";
        const value = config.inactivity_hours || (unit === "minutes" ? 60 : 24);
        const inactivityMs =
          unit === "minutes" ? value * 60 * 1000 : value * 60 * 60 * 1000;
        const cutoffTime = new Date(Date.now() - inactivityMs).toISOString();

        let accountId: string;
        try {
          accountId = config.account_id || (await resolveAccountId(supabase, config.user_id));
        } catch (e) {
          console.error(`[${runId}] [user ${config.user_id}] resolveAccountId failed:`, e);
          continue;
        }

        const { data: account, error: accountError } = await supabase
          .from("accounts")
          .select("is_igreen")
          .eq("id", accountId)
          .maybeSingle();
        if (accountError) {
          console.error(`[${runId}] [account ${accountId}] account lookup failed:`, accountError);
          continue;
        }
        if (account?.is_igreen === true) {
          trackReason("igreen_account");
          console.log(`[${runId}] [account ${accountId}] SKIP: iGreen accounts use only iGreen scenarios`);
          continue;
        }

        // Não trazer `messages` aqui: a coluna JSONB é enorme e essa query roda
        // a cada ciclo para todos os usuários. O histórico é buscado só para os
        // candidatos que sobrevivem aos filtros baratos abaixo.
        const { data: conversations, error: convError } = await supabase
          .from("whatsapp_conversations")
          .select("phone, last_message_at, ai_active")
          .eq("user_id", config.user_id)
          .lt("last_message_at", cutoffTime)
          .limit(500);

        if (convError) {
          console.error(`[${runId}] [user ${config.user_id}] conversations query error:`, convError);
          continue;
        }

        console.log(`[${runId}] [user ${config.user_id}] inactivity=${value}${unit} cutoff=${cutoffTime} candidates=${conversations?.length || 0}`);

        if (!conversations || conversations.length === 0) continue;

        const { data: existingTracking, error: trackError } = await supabase
          .from("followup_tracking")
          .select("phone, status")
          .eq("user_id", config.user_id);

        if (trackError) {
          console.error(`[${runId}] [user ${config.user_id}] tracking query error:`, trackError);
        }

        const activePhonesSet = new Set(
          (existingTracking || [])
            .filter((t: any) => t.status === "pending" || t.status === "engaged")
            .map((t: any) => t.phone)
        );

        const completedPhonesSet = new Set(
          (existingTracking || [])
            .filter((t: any) => t.status === "exhausted" || t.status === "declined")
            .map((t: any) => t.phone)
        );

        // Carrega contatos com tags reservadas que BLOQUEIAM follow-up
        const { data: blockedContacts } = await supabase
          .from("contacts")
          .select("phone, tags")
          .eq("account_id", accountId)
          .overlaps("tags", ["agendamento", "sem-interesse"]);

        const blockedPhonesSet = new Set(
          (blockedContacts || []).map((c: any) => c.phone)
        );

        // Filtros baratos primeiro (sem tocar no histórico).
        const candidates = conversations.filter((conv: any) => {
          if (activePhonesSet.has(conv.phone)) {
            trackReason("already_active_tracking");
            return false;
          }
          if (completedPhonesSet.has(conv.phone)) {
            trackReason("cycle_completed");
            return false;
          }
          if (blockedPhonesSet.has(conv.phone)) {
            trackReason("blocked_by_tag");
            return false;
          }
          if (config.exclude_handoff && !conv.ai_active) {
            trackReason("excluded_handoff");
            return false;
          }
          return true;
        });

        if (candidates.length === 0) continue;

        // Só agora buscamos o histórico, e apenas dos candidatos restantes.
        const { data: convMessages } = await supabase
          .from("whatsapp_conversations")
          .select("phone, messages")
          .eq("user_id", config.user_id)
          .in("phone", candidates.map((c: any) => c.phone));

        const messagesByPhone = new Map<string, any[]>(
          (convMessages || []).map((c: any) => [c.phone, (c.messages as any[]) || []])
        );

        for (const conv of candidates) {
          const messages = messagesByPhone.get(conv.phone) || [];
          if (messages.length === 0) {
            trackReason("empty_messages");
            continue;
          }

          const lastMsg = messages[messages.length - 1];
          if (lastMsg.from_me && lastMsg.sent_by === "human") {
            trackReason("last_message_human_operator");
            console.log(`[${runId}] [${conv.phone}] SKIP: last message from human operator`);
            continue;
          }

          const nextScheduledAt = calculateNextSchedule(config);

          const { error: insertError } = await supabase
            .from("followup_tracking")
            .insert({
              user_id: config.user_id,
              account_id: accountId,
              phone: conv.phone,
              current_step: 1,
              status: "pending",
              next_scheduled_at: nextScheduledAt,
              engagement_data: {},
            });

          if (insertError) {
            if (insertError.code === "23505") {
              trackReason("unique_violation");
              console.log(`[${runId}] [${conv.phone}] SKIP: unique violation`);
            } else {
              trackReason("insert_error");
              console.error(`[${runId}] [${conv.phone}] INSERT ERROR:`, insertError);
            }
          } else {
            created++;
            console.log(`[${runId}] [${conv.phone}] CREATED tracking, scheduled at ${nextScheduledAt}`);
          }
        }
      } catch (userError) {
        console.error(`[${runId}] Error processing user ${config.user_id}:`, userError);
      }
    }

    console.log(`[${runId}] === Done. created=${created} skipped=${totalSkipped} reasons=${JSON.stringify(skipReasons)} ===`);

    return new Response(JSON.stringify({ created, skipped: totalSkipped, skipReasons, runId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${runId}] Check inactive error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", runId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextSchedule(config: any): string {
  // BRT-aware: respeita janela 08–19 (default), pula domingo e empurra para
  // amanhã se já passou da janela do dia. Implementado em _followup-window.ts.
  return generateScheduleSequence(config, 1)[0];
}
