import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Próximo slot na janela manhã (08:00–12:00) ou tarde (12:00–19:55) em BRT,
// SEMPRE no dia seguinte. O cenário não deve disparar no mesmo dia em que o
// cliente teve conversa — Day 1 sai aproximadamente 24h depois.
function nextSlot(period: "morning" | "evening", minDate?: Date): Date {
  const now = minDate ?? new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const tzOffset = local.getTime() - now.getTime();
  const startH = period === "morning" ? 8 : 12;
  const endH = period === "morning" ? 12 : 19;
  const endM = period === "morning" ? 0 : 55;

  const target = new Date(local);
  // SEMPRE avança para o próximo dia.
  target.setDate(target.getDate() + 1);
  const startMin = startH * 60;
  const endMin = endH * 60 + endM;
  const slot = startMin + Math.floor(Math.random() * (endMin - startMin));
  target.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
  return new Date(target.getTime() - tzOffset);
}

// Última mensagem humana (sent_by='human' / from_me=false) nas últimas N horas?
async function hasRecentHumanActivity(
  supabase: any, account_id: string, phone: string, hours: number,
): Promise<Date | null> {
  try {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("messages")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .maybeSingle();
    const msgs = (conv?.messages as any[]) || [];
    const cutoff = Date.now() - hours * 3_600_000;
    let latest: Date | null = null;
    for (const m of msgs) {
      if (m?.from_me) continue;
      const t = m?.timestamp ? new Date(m.timestamp) : null;
      if (!t || isNaN(t.getTime())) continue;
      if (t.getTime() < cutoff) continue;
      if (!latest || t > latest) latest = t;
    }
    return latest;
  } catch (_) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { account_id, phone, contact_id } = body;
    // Aceita trigger_tag (novo) ou scenario_key (legado)
    const triggerTag: string | undefined = body.trigger_tag ?? body.tag;
    const legacyKey: string | undefined = body.scenario_key;

    if (!account_id || !phone || (!triggerTag && !legacyKey)) {
      return new Response(JSON.stringify({ error: "account_id, phone e trigger_tag (ou scenario_key) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Para qualquer cenário ativo anterior deste contato (tag exclusiva)
    await supabase.rpc("igreen_stop_for_phone", {
      p_account_id: account_id,
      p_phone: phone,
      p_reason: `replaced_by_${triggerTag ?? legacyKey}`,
    });

    // 2. Localiza o cenário pela trigger_tag (case-insensitive) ou scenario_key (legado)
    let scenarioQ = supabase
      .from("igreen_scenarios")
      .select("id, enabled, product_key, scenario_key, trigger_tag")
      .eq("account_id", account_id);

    if (triggerTag) {
      scenarioQ = scenarioQ.ilike("trigger_tag", triggerTag);
    } else {
      scenarioQ = scenarioQ.eq("scenario_key", legacyKey!);
    }

    const { data: scenario } = await scenarioQ.maybeSingle();

    if (!scenario || !scenario.enabled) {
      return new Response(JSON.stringify({ error: "scenario not found or disabled" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante intervalo mínimo de 24h após a última mensagem humana.
    const lastHuman = await hasRecentHumanActivity(supabase, account_id, phone, 24);
    const minDate = lastHuman
      ? new Date(lastHuman.getTime() + 24 * 3_600_000)
      : undefined;
    const next_run_at = nextSlot("morning", minDate).toISOString();

    const { data: enrollment, error } = await supabase
      .from("igreen_scenario_enrollments")
      .insert({
        account_id,
        scenario_id: scenario.id,
        scenario_key: scenario.scenario_key ?? scenario.trigger_tag ?? triggerTag ?? legacyKey,
        contact_phone: phone,
        contact_id: contact_id ?? null,
        current_day: 1,
        current_period: "morning",
        status: "active",
        next_run_at,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, enrollment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});