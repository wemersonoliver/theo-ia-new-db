import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        // Find conversations where last message is from the client and older than inactivity_hours
        const { data: conversations } = await supabase
          .from("whatsapp_conversations")
          .select("phone, messages, last_message_at, ai_active")
          .eq("user_id", config.user_id)
          .lt("last_message_at", cutoffTime);

        if (!conversations || conversations.length === 0) continue;

        // Get existing tracking for this user to avoid duplicates
        const { data: existingTracking } = await supabase
          .from("followup_tracking")
          .select("phone, status")
          .eq("user_id", config.user_id)
          .in("status", ["pending", "engaged"]);

        const existingPhones = new Set(
          (existingTracking || []).map((t: any) => t.phone)
        );

        for (const conv of conversations) {
          // Skip if already being tracked
          if (existingPhones.has(conv.phone)) continue;

          // Skip handoffs if configured
          if (config.exclude_handoff && !conv.ai_active) continue;

          // Check if last message was from client (not from us)
          const messages = (conv.messages as any[]) || [];
          if (messages.length === 0) continue;

          const lastMsg = messages[messages.length - 1];
          // Only follow up if the last message was from the client (they're waiting)
          // OR if our last message was unanswered
          if (lastMsg.from_me && lastMsg.sent_by !== "followup_ai") {
            // We sent the last message and it wasn't a follow-up - client may still respond
            continue;
          }

          // Schedule first follow-up in a random time within morning window
          const now = new Date();
          const [startH, startM] = (config.morning_window_start || "08:00").split(":").map(Number);
          const [endH, endM] = (config.morning_window_end || "12:00").split(":").map(Number);

          const scheduledDate = new Date();
          // If it's past the morning window, schedule for tomorrow
          if (now.getHours() >= endH) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
          }

          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const randomMinutes = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));
          scheduledDate.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);

          // Don't schedule in the past
          if (scheduledDate.getTime() < Date.now()) {
            // Use evening window instead
            const [eStartH, eStartM] = (config.evening_window_start || "13:00").split(":").map(Number);
            const [eEndH, eEndM] = (config.evening_window_end || "19:00").split(":").map(Number);
            const eStartMinutes = eStartH * 60 + eStartM;
            const eEndMinutes = eEndH * 60 + eEndM;
            const eRandomMinutes = eStartMinutes + Math.floor(Math.random() * (eEndMinutes - eStartMinutes));

            const todayEvening = new Date();
            todayEvening.setHours(Math.floor(eRandomMinutes / 60), eRandomMinutes % 60, 0, 0);

            if (todayEvening.getTime() > Date.now()) {
              scheduledDate.setTime(todayEvening.getTime());
            } else {
              // Schedule for tomorrow morning
              scheduledDate.setDate(new Date().getDate() + 1);
              scheduledDate.setHours(Math.floor(randomMinutes / 60), randomMinutes % 60, 0, 0);
            }
          }

          const { error: insertError } = await supabase
            .from("followup_tracking")
            .upsert(
              {
                user_id: config.user_id,
                phone: conv.phone,
                current_step: 1,
                status: "pending",
                next_scheduled_at: scheduledDate.toISOString(),
                engagement_data: {},
              },
              { onConflict: "user_id,phone" }
            );

          if (insertError) {
            console.error(`Error creating tracking for ${conv.phone}:`, insertError);
          } else {
            created++;
            console.log(`Follow-up tracking created for ${conv.phone}, scheduled at ${scheduledDate.toISOString()}`);
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
