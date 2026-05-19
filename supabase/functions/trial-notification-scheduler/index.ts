import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRIAL_POLICY_CUTOFF = new Date("2026-05-06T00:00:00Z");
const TRIAL_DAYS_NEW = 7;
const TRIAL_DAYS_LEGACY = 15;

function trialDaysFor(createdAt: Date): number {
  return createdAt >= TRIAL_POLICY_CUTOFF ? TRIAL_DAYS_NEW : TRIAL_DAYS_LEGACY;
}

function pickWindowSlot(config: any, base: Date): Date {
  // Distribui dentro da janela da manhã (alvo 10h local) usando UTC offset BR -3
  const d = new Date(base);
  const [h, m] = (config.morning_window_start || "09:00").split(":").map(Number);
  d.setUTCHours(h + 3, m, 0, 0); // BR = UTC-3 → manhã ~12h UTC
  return d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config } = await supabase
      .from("trial_notification_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ created: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offsets: number[] = config.step_offsets || [-3, -2, -1, 2, 4, 6, 7, 9, 11];

    // Busca todas as accounts ativas (não bloqueadas, sem subscription)
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, owner_user_id, created_at, trial_extra_days");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pré-carrega trackings existentes para evitar duplicidade
    const { data: existing } = await supabase
      .from("trial_notification_tracking")
      .select("account_id");
    const trackedAccounts = new Set((existing || []).map((t: any) => t.account_id));

    let created = 0;
    let skipped = 0;

    for (const acc of accounts) {
      if (trackedAccounts.has(acc.id)) continue;

      // Pula super_admin
      const { data: superRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", acc.owner_user_id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (superRole) { skipped++; continue; }

      // Pula se tem subscription ativa
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, expires_at")
        .eq("account_id", acc.id)
        .eq("status", "active")
        .maybeSingle();
      if (sub && (!sub.expires_at || new Date(sub.expires_at) > new Date())) {
        skipped++;
        continue;
      }

      // Profile + telefone
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, created_at")
        .eq("user_id", acc.owner_user_id)
        .maybeSingle();
      if (!profile || !profile.phone) { skipped++; continue; }

      const phone = normalizeBrazilianPhone(profile.phone);
      if (!phone || phone.length < 12) { skipped++; continue; }

      // Calcula trial_ends_at
      const created_at = new Date(profile.created_at || acc.created_at);
      const baseDays = trialDaysFor(created_at) + (acc.trial_extra_days || 0);
      const trialEnds = new Date(created_at.getTime() + baseDays * 86400000);

      // Se já passou D+11, ignora
      const lastOffsetDays = offsets[offsets.length - 1];
      const flowEnd = new Date(trialEnds.getTime() + lastOffsetDays * 86400000);
      if (flowEnd < new Date()) { skipped++; continue; }

      // Business context do CRM
      const { data: deal } = await supabase
        .from("admin_crm_deals")
        .select("business_summary, business_name, business_segment")
        .eq("user_ref_id", acc.owner_user_id)
        .maybeSingle();
      const businessContext =
        deal?.business_summary?.slice(0, 200) ||
        [deal?.business_name, deal?.business_segment].filter(Boolean).join(" — ") ||
        "seu negócio";

      // Cria tracking
      const { data: track, error: trackErr } = await supabase
        .from("trial_notification_tracking")
        .insert({
          account_id: acc.id,
          owner_user_id: acc.owner_user_id,
          phone,
          trial_ends_at: trialEnds.toISOString(),
          status: "scheduled",
          business_context: businessContext,
        })
        .select("id")
        .maybeSingle();

      if (trackErr || !track) {
        if (trackErr?.code !== "23505") console.error("track err:", trackErr);
        continue;
      }

      // Agenda todas as mensagens futuras
      const now = new Date();
      const rows: any[] = [];
      for (let i = 0; i < offsets.length; i++) {
        const step = i + 1;
        const offsetDays = offsets[i];
        const scheduled = pickWindowSlot(
          config,
          new Date(trialEnds.getTime() + offsetDays * 86400000),
        );
        if (scheduled < now) continue;
        const phase = offsetDays < 0 ? "pre" : "post";
        rows.push({
          tracking_id: track.id,
          phone,
          step,
          phase,
          content: "", // renderizado no dispatch (template pode mudar)
          scheduled_at: scheduled.toISOString(),
          status: "scheduled",
        });
      }

      if (rows.length > 0) {
        await supabase.from("trial_notification_messages").insert(rows);
        await supabase
          .from("trial_notification_tracking")
          .update({ next_scheduled_at: rows[0].scheduled_at })
          .eq("id", track.id);
      }

      created++;
      console.log(`[trial-sched] ${acc.owner_user_id} → ${rows.length} steps`);
    }

    return new Response(JSON.stringify({ created, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trial-notification-scheduler error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});