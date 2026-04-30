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

    // Campo inactivity_hours é reinterpretado como MINUTOS na UI/lógica do suporte
    const inactivityMs = (config.inactivity_hours || 60) * 60 * 1000;
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

/**
 * Agendamento inicial respeitando estritamente as janelas em fuso de São Paulo.
 * Nunca retorna horário fora das janelas configuradas.
 */
function calculateNextSchedule(config: any): string {
  const [mStartH, mStartM] = (config.morning_window_start || "08:00").split(":").map(Number);
  const [mEndH, mEndM] = (config.morning_window_end || "12:00").split(":").map(Number);
  const [eStartH, eStartM] = (config.evening_window_start || "13:00").split(":").map(Number);
  const [eEndH, eEndM] = (config.evening_window_end || "19:00").split(":").map(Number);

  const mStart = mStartH * 60 + mStartM;
  const mEnd = mEndH * 60 + mEndM;
  const eStart = eStartH * 60 + eStartM;
  const eEnd = eEndH * 60 + eEndM;

  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffsetMs = nowBrt.getTime() - Date.now();
  const nowMin = nowBrt.getHours() * 60 + nowBrt.getMinutes();

  const target = new Date(nowBrt);
  let startMin: number;
  let endMin: number;

  if (nowMin < mStart) {
    // antes da manhã → agenda manhã de hoje
    startMin = mStart; endMin = mEnd;
  } else if (nowMin < mEnd - 5) {
    // dentro da janela da manhã → agenda no restante da manhã (mín 5min de buffer)
    startMin = Math.max(mStart, nowMin + 5); endMin = mEnd;
  } else if (nowMin < eStart) {
    // entre janelas → agenda tarde de hoje
    startMin = eStart; endMin = eEnd;
  } else if (nowMin < eEnd - 5) {
    // dentro da janela da tarde → agenda no restante da tarde
    startMin = Math.max(eStart, nowMin + 5); endMin = eEnd;
  } else {
    // após a tarde → agenda manhã de amanhã
    target.setDate(target.getDate() + 1);
    startMin = mStart; endMin = mEnd;
  }

  const range = Math.max(endMin - startMin, 1);
  const r = startMin + Math.floor(Math.random() * range);
  target.setHours(Math.floor(r / 60), r % 60, 0, 0);

  // Converte BRT pseudo-local para UTC real
  const utc = new Date(target.getTime() - tzOffsetMs);
  return utc.toISOString();
}