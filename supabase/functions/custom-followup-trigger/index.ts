import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseHM(s: string | undefined, fb: string): number {
  const [h, m] = (s || fb).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function nextWindowedUtc(from: Date, win: any): Date {
  const skipSundays = win?.skip_sundays !== false;
  const startMin = parseHM(win?.morning_start, "08:00");
  const endMin = parseHM(win?.evening_end, "19:00");
  const local = new Date(from.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffsetMs = local.getTime() - from.getTime();
  const minutes = local.getHours() * 60 + local.getMinutes();
  const wd = local.getDay();
  let cursor = new Date(local);
  if (skipSundays && wd === 0) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return new Date(cursor.getTime() - tzOffsetMs);
  }
  if (minutes < startMin) {
    cursor.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return new Date(cursor.getTime() - tzOffsetMs);
  }
  if (minutes > endMin) {
    cursor.setDate(cursor.getDate() + 1);
    if (skipSundays && cursor.getDay() === 0) cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return new Date(cursor.getTime() - tzOffsetMs);
  }
  return from;
}
function addDelay(from: Date, value: number, unit: string): Date {
  const ms =
    unit === "days" ? value * 86_400_000 :
    unit === "hours" ? value * 3_600_000 :
    value * 60_000;
  return new Date(from.getTime() + ms);
}
function inactivityMs(cfg: any): number {
  const v = Number(cfg?.value || 0);
  const u = cfg?.unit || "hours";
  return u === "days" ? v * 86_400_000 : u === "minutes" ? v * 60_000 : v * 3_600_000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Get all enabled inactivity flows
  const { data: flows } = await supabase
    .from("custom_followup_flows")
    .select("id, account_id, trigger_config, window_config, exclude_handoff, filters")
    .eq("enabled", true)
    .eq("trigger_type", "inactivity");

  let totalEnrolled = 0;

  for (const flow of flows || []) {
    const idleMs = inactivityMs((flow as any).trigger_config);
    if (!idleMs) continue;
    const cutoff = new Date(Date.now() - idleMs).toISOString();

    // Find conversations idle for >= cutoff (last_message_at <= cutoff)
    const { data: convs } = await supabase
      .from("whatsapp_conversations")
      .select("phone, last_message_at, ai_active, messages")
      .eq("account_id", (flow as any).account_id)
      .lte("last_message_at", cutoff)
      .limit(500);

    for (const conv of convs || []) {
      const phone = (conv as any).phone;
      if (!phone) continue;
      if ((flow as any).exclude_handoff && (conv as any).ai_active === false) continue;

      // Skip if last message is from us already (no idle from contact)
      const msgs = ((conv as any).messages || []) as any[];
      const last = msgs[msgs.length - 1];
      if (!last || last.from_me) continue; // only enroll when last message is from contact

      // Already active enrollment?
      const { data: existing } = await supabase
        .from("custom_followup_enrollments")
        .select("id").eq("flow_id", (flow as any).id).eq("phone", phone).eq("status", "active").maybeSingle();
      if (existing) continue;

      const { data: firstStep } = await supabase
        .from("custom_followup_steps")
        .select("id, position, delay_value, delay_unit")
        .eq("flow_id", (flow as any).id)
        .order("position", { ascending: true })
        .limit(1).maybeSingle();
      if (!firstStep) continue;

      const { data: enr } = await supabase
        .from("custom_followup_enrollments")
        .insert({
          flow_id: (flow as any).id,
          account_id: (flow as any).account_id,
          phone,
          current_step: 0,
          status: "active",
          triggered_by: "inactivity",
        }).select("id").single();
      if (!enr) continue;

      const baseTime = addDelay(new Date(), firstStep.delay_value || 0, firstStep.delay_unit || "minutes");
      const scheduled = nextWindowedUtc(baseTime, (flow as any).window_config);
      await supabase.from("custom_followup_queue").insert({
        account_id: (flow as any).account_id,
        flow_id: (flow as any).id,
        enrollment_id: enr.id,
        step_id: firstStep.id,
        step_position: firstStep.position,
        phone,
        scheduled_at: scheduled.toISOString(),
      });
      await supabase.from("custom_followup_enrollments").update({
        next_scheduled_at: scheduled.toISOString(),
      }).eq("id", enr.id);
      totalEnrolled++;
    }
  }

  return new Response(JSON.stringify({ enrolled: totalEnrolled }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});