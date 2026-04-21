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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all users with follow-up enabled
    const { data: configs, error: configError } = await supabase
      .from("followup_config")
      .select("*")
      .eq("enabled", true);

    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;

    for (const config of configs) {
      try {
        const inactivityMs = (config.inactivity_hours || 24) * 60 * 60 * 1000;
        const cutoffTime = new Date(Date.now() - inactivityMs).toISOString();

        // Find conversations where last message is older than inactivity_hours
        const { data: conversations } = await supabase
          .from("whatsapp_conversations")
          .select("phone, messages, last_message_at, ai_active")
          .eq("user_id", config.user_id)
          .lt("last_message_at", cutoffTime);

        if (!conversations || conversations.length === 0) continue;

        // Get ALL existing tracking for this user (any status) to avoid re-enrolling
        const { data: existingTracking } = await supabase
          .from("followup_tracking")
          .select("phone, status")
          .eq("user_id", config.user_id);

        // Phones with active tracking (pending/engaged) should be skipped entirely
        const activePhonesSet = new Set(
          (existingTracking || [])
            .filter((t: any) => t.status === "pending" || t.status === "engaged")
            .map((t: any) => t.phone)
        );

        // Phones that already completed a cycle (exhausted/declined) should NOT be re-enrolled
        const completedPhonesSet = new Set(
          (existingTracking || [])
            .filter((t: any) => t.status === "exhausted" || t.status === "declined")
            .map((t: any) => t.phone)
        );

        for (const conv of conversations) {
          // Skip if already being tracked or already completed a cycle
          if (activePhonesSet.has(conv.phone) || completedPhonesSet.has(conv.phone)) continue;

          // Skip handoffs if configured
          if (config.exclude_handoff && !conv.ai_active) continue;

          // Check if last message was from client (not from us)
          const messages = (conv.messages as any[]) || [];
          if (messages.length === 0) continue;

          const lastMsg = messages[messages.length - 1];
          // Only follow up if the last message was NOT a human-sent outgoing message
          // (follow-up AI messages are ok to follow up on since they're automated)
          if (lastMsg.from_me && lastMsg.sent_by !== "followup_ai") {
            continue;
          }

          // Calculate scheduled time
          const nextScheduledAt = calculateNextSchedule(config);

          const { error: insertError } = await supabase
            .from("followup_tracking")
            .insert({
              user_id: config.user_id,
              phone: conv.phone,
              current_step: 1,
              status: "pending",
              next_scheduled_at: nextScheduledAt,
              engagement_data: {},
            });

          if (insertError) {
            // Unique constraint violation means it already exists - skip
            if (insertError.code === "23505") {
              console.log(`Tracking already exists for ${conv.phone}, skipping`);
            } else {
              console.error(`Error creating tracking for ${conv.phone}:`, insertError);
            }
          } else {
            created++;
            console.log(`Follow-up tracking created for ${conv.phone}, scheduled at ${nextScheduledAt}`);
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${config.user_id}:`, userError);
      }
    }

    return new Response(JSON.stringify({ created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Check inactive error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
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

  // Try morning window today
  if (nowMinutes < mEndMinutes) {
    const start = Math.max(mStartMinutes, nowMinutes + 10); // at least 10min from now
    if (start < mEndMinutes) {
      const randomMin = start + Math.floor(Math.random() * (mEndMinutes - start));
      scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
      return scheduledDate.toISOString();
    }
  }

  // Try evening window today
  if (nowMinutes < eEndMinutes) {
    const start = Math.max(eStartMinutes, nowMinutes + 10);
    if (start < eEndMinutes) {
      const randomMin = start + Math.floor(Math.random() * (eEndMinutes - start));
      scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
      return scheduledDate.toISOString();
    }
  }

  // Schedule for tomorrow morning
  scheduledDate.setDate(scheduledDate.getDate() + 1);
  const randomMin = mStartMinutes + Math.floor(Math.random() * (mEndMinutes - mStartMinutes));
  scheduledDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);
  return scheduledDate.toISOString();
}
