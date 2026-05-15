import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { flow_id, phones, contact_ids, instance_id, source } = body as {
      flow_id: string;
      phones?: string[];
      contact_ids?: string[];
      instance_id?: string | null;
      source?: string;
    };
    if (!flow_id) return jsonResponse({ error: "flow_id required" }, 400);

    const { data: flow } = await supabase
      .from("custom_followup_flows")
      .select("id, account_id, enabled, window_config")
      .eq("id", flow_id).maybeSingle();
    if (!flow) return jsonResponse({ error: "flow not found" }, 404);

    // permission: must be member of account
    const { data: member } = await supabase
      .from("account_members")
      .select("user_id").eq("account_id", flow.account_id).eq("user_id", u.user.id)
      .eq("status", "active").maybeSingle();
    if (!member) return jsonResponse({ error: "Forbidden" }, 403);

    // resolve phones from contacts if provided
    const phoneSet = new Set<string>();
    (phones || []).forEach((p) => phoneSet.add(normalizeBrazilianPhone(p)));
    if (contact_ids?.length) {
      const { data: cs } = await supabase
        .from("contacts").select("phone")
        .eq("account_id", flow.account_id).in("id", contact_ids);
      (cs || []).forEach((c: any) => c.phone && phoneSet.add(normalizeBrazilianPhone(c.phone)));
    }
    if (phoneSet.size === 0) return jsonResponse({ error: "no phones" }, 400);

    // get first step
    const { data: firstStep } = await supabase
      .from("custom_followup_steps")
      .select("id, position, delay_value, delay_unit")
      .eq("flow_id", flow_id)
      .order("position", { ascending: true })
      .limit(1).maybeSingle();
    if (!firstStep) return jsonResponse({ error: "flow has no steps" }, 400);

    let enrolled = 0, skipped = 0;
    for (const phone of phoneSet) {
      // skip if already active
      const { data: existing } = await supabase
        .from("custom_followup_enrollments")
        .select("id").eq("flow_id", flow_id).eq("phone", phone).eq("status", "active").maybeSingle();
      if (existing) { skipped++; continue; }

      const { data: enrollment, error: enErr } = await supabase
        .from("custom_followup_enrollments")
        .insert({
          flow_id,
          account_id: flow.account_id,
          phone,
          current_step: 0,
          status: "active",
          triggered_by: source || "manual",
          metadata: {},
        }).select("id").single();
      if (enErr || !enrollment) { skipped++; continue; }

      const baseTime = addDelay(new Date(), firstStep.delay_value || 0, firstStep.delay_unit || "minutes");
      const scheduled = nextWindowedUtc(baseTime, flow.window_config);

      await supabase.from("custom_followup_queue").insert({
        account_id: flow.account_id,
        flow_id,
        enrollment_id: enrollment.id,
        step_id: firstStep.id,
        step_position: firstStep.position,
        instance_id: instance_id || null,
        phone,
        scheduled_at: scheduled.toISOString(),
      });
      await supabase.from("custom_followup_enrollments").update({
        next_scheduled_at: scheduled.toISOString(),
      }).eq("id", enrollment.id);
      enrolled++;
    }

    return jsonResponse({ enrolled, skipped });
  } catch (e) {
    console.error("enroll error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});