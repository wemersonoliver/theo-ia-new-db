import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAccountId } from "../_account.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

        const { data: conversations, error: convError } = await supabase
          .from("whatsapp_conversations")
          .select("phone, messages, last_message_at, ai_active")
          .eq("user_id", config.user_id)
          .lt("last_message_at", cutoffTime);

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

        for (const conv of conversations) {
          if (activePhonesSet.has(conv.phone)) {
            trackReason("already_active_tracking");
            console.log(`[${runId}] [${conv.phone}] SKIP: active tracking exists`);
            continue;
          }
          if (completedPhonesSet.has(conv.phone)) {
            trackReason("cycle_completed");
            console.log(`[${runId}] [${conv.phone}] SKIP: cycle completed`);
            continue;
          }
          if (blockedPhonesSet.has(conv.phone)) {
            trackReason("blocked_by_tag");
            console.log(`[${runId}] [${conv.phone}] SKIP: blocked by tag (agendamento/sem-interesse)`);
            continue;
          }

          if (config.exclude_handoff && !conv.ai_active) {
            trackReason("excluded_handoff");
            console.log(`[${runId}] [${conv.phone}] SKIP: excluded handoff (ai_active=false)`);
            continue;
          }

          const messages = (conv.messages as any[]) || [];
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
  const now = new Date();
  const [mStartH, mStartM] = (config.morning_window_start || "08:00").split(":").map(Number);
  const [mEndH, mEndM] = (config.morning_window_end || "12:00").split(":").map(Number);
  const [eStartH, eStartM] = (config.evening_window_start || "13:00").split(":").map(Number);
  const [eEndH, eEndM] = (config.evening_window_end || "19:00").split(":").map(Number);

  const mStartMinutes = mStartH * 60 + mStartM;
  const mEndMinutes = mEndH * 60 + mEndM;
  const eStartMinutes = eStartH * 60 + eStartM;
  const eEndMinutes = eEndH * 60 + eEndM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const scheduledDate = new Date(now);

  if (nowMinutes < mEndMinutes) {
    const start = Math.max(mStartMinutes, nowMinutes + 10);
    if (start < mEndMinutes) {
      const randomMin = start + Math.floor(Math.random() * (mEndMinutes - start));
      scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
      return scheduledDate.toISOString();
    }
  }

  if (nowMinutes < eEndMinutes) {
    const start = Math.max(eStartMinutes, nowMinutes + 10);
    if (start < eEndMinutes) {
      const randomMin = start + Math.floor(Math.random() * (eEndMinutes - start));
      scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
      return scheduledDate.toISOString();
    }
  }

  scheduledDate.setDate(scheduledDate.getDate() + 1);
  const randomMin = mStartMinutes + Math.floor(Math.random() * (mEndMinutes - mStartMinutes));
  scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
  return scheduledDate.toISOString();
}
