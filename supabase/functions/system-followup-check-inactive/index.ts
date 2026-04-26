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

    // Carrega config singleton
    const { data: config } = await supabase
      .from("system_followup_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ created: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inactivityMs = (config.inactivity_hours || 24) * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - inactivityMs).toISOString();

    const { data: conversations } = await supabase
      .from("system_whatsapp_conversations")
      .select("phone, messages, last_message_at, ai_active")
      .lt("last_message_at", cutoffTime);

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingTracking } = await supabase
      .from("system_followup_tracking")
      .select("phone, status");

    const activePhones = new Set(
      (existingTracking || [])
        .filter((t: any) => t.status === "pending" || t.status === "engaged")
        .map((t: any) => t.phone),
    );
    const completedPhones = new Set(
      (existingTracking || [])
        .filter((t: any) => t.status === "exhausted" || t.status === "declined")
        .map((t: any) => t.phone),
    );

    let created = 0;

    for (const conv of conversations) {
      if (activePhones.has(conv.phone) || completedPhones.has(conv.phone)) continue;

      // Pula handoffs (IA desativada manualmente) se configurado
      if (config.exclude_handoff && conv.ai_active === false) continue;

      const messages = (conv.messages as any[]) || [];
      if (messages.length === 0) continue;

      const lastMsg = messages[messages.length - 1];
      // Não fazer follow-up se a última mensagem foi de operador humano
      if (lastMsg.from_me && lastMsg.sent_by === "human") continue;

      const nextScheduledAt = calculateNextSchedule(config);

      const { error: insertError } = await supabase
        .from("system_followup_tracking")
        .insert({
          phone: conv.phone,
          current_step: 1,
          status: "pending",
          next_scheduled_at: nextScheduledAt,
          engagement_data: {},
        });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error(`Error tracking ${conv.phone}:`, insertError);
        }
      } else {
        created++;
        console.log(`[support-followup] tracked ${conv.phone} → ${nextScheduledAt}`);
      }
    }

    return new Response(JSON.stringify({ created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("system-followup-check-inactive error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function calculateNextSchedule(config: any): string {
  const now = new Date();
  const [mStartH, mStartM] = (config.morning_window_start || "08:00").split(":").map(Number);
  const [mEndH, mEndM] = (config.morning_window_end || "12:00").split(":").map(Number);
  const [eStartH, eStartM] = (config.evening_window_start || "13:00").split(":").map(Number);
  const [eEndH, eEndM] = (config.evening_window_end || "19:00").split(":").map(Number);

  const mStart = mStartH * 60 + mStartM;
  const mEnd = mEndH * 60 + mEndM;
  const eStart = eStartH * 60 + eStartM;
  const eEnd = eEndH * 60 + eEndM;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const date = new Date(now);

  if (nowMin < mEnd) {
    const start = Math.max(mStart, nowMin + 10);
    if (start < mEnd) {
      const r = start + Math.floor(Math.random() * (mEnd - start));
      date.setHours(Math.floor(r / 60), r % 60, 0, 0);
      return date.toISOString();
    }
  }
  if (nowMin < eEnd) {
    const start = Math.max(eStart, nowMin + 10);
    if (start < eEnd) {
      const r = start + Math.floor(Math.random() * (eEnd - start));
      date.setHours(Math.floor(r / 60), r % 60, 0, 0);
      return date.toISOString();
    }
  }

  date.setDate(date.getDate() + 1);
  const r = mStart + Math.floor(Math.random() * Math.max(mEnd - mStart, 1));
  date.setHours(Math.floor(r / 60), r % 60, 0, 0);
  return date.toISOString();
}