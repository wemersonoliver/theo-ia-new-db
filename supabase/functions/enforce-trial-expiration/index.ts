import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIAL_POLICY_CUTOFF = new Date("2026-05-06T00:00:00Z");
const GRACE_DAYS = 2;
const TRIAL_EXPIRED_STAGE_NAME = "trial expirado";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function trialDaysFor(createdAt: Date) {
  return createdAt >= TRIAL_POLICY_CUTOFF ? 7 : 15;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    // Carrega contas candidatas (cutoff + grace, sem assinatura ativa, owner não super_admin)
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, owner_user_id, created_at, trial_extra_days")
      .gte("created_at", TRIAL_POLICY_CUTOFF.toISOString());

    if (accErr) throw accErr;

    const processed: any[] = [];
    const now = Date.now();

    for (const acc of accounts ?? []) {
      const created = new Date(acc.created_at as string);
      const extra = (acc.trial_extra_days as number) ?? 0;
      const limitDays = trialDaysFor(created) + extra + GRACE_DAYS;
      const ageDays = Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays < limitDays) continue;

      // Skip super_admin
      const { data: roleRow } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", acc.owner_user_id).eq("role", "super_admin").maybeSingle();
      if (roleRow) continue;

      // Skip se possui assinatura ativa
      const { data: sub } = await supabase
        .from("subscriptions").select("id, expires_at")
        .eq("account_id", acc.id).eq("status", "active").maybeSingle();
      if (sub && (!sub.expires_at || new Date(sub.expires_at as string) > new Date())) continue;

      const result: any = { account_id: acc.id, owner: acc.owner_user_id, actions: [] };

      // 1. Desconectar todas as instâncias WhatsApp da account
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status")
        .eq("account_id", acc.id);

      for (const inst of instances ?? []) {
        if (evolutionUrl && evolutionKey) {
          try {
            await evolutionRequest({
              evolutionUrl, evolutionKey,
              path: `/instance/logout/${inst.instance_name}`,
              method: "DELETE",
            });
          } catch (_) { /* ignora */ }
          try {
            await evolutionRequest({
              evolutionUrl, evolutionKey,
              path: `/instance/delete/${inst.instance_name}`,
              method: "DELETE",
            });
          } catch (_) { /* ignora */ }
        }
        await supabase.from("whatsapp_instances").update({
          status: "disconnected",
          qr_code_base64: null,
          phone_number: null,
          profile_name: null,
          ai_enabled: false,
          followup_enabled: false,
          updated_at: new Date().toISOString(),
        }).eq("id", inst.id);
        result.actions.push(`instance ${inst.instance_name} disconnected`);
      }

      // 2. Desliga IA — whatsapp_ai_config (por account e por owner)
      await supabase.from("whatsapp_ai_config").update({ active: false, updated_at: new Date().toISOString() }).eq("account_id", acc.id);
      await supabase.from("whatsapp_ai_config").update({ active: false, updated_at: new Date().toISOString() }).eq("user_id", acc.owner_user_id);
      result.actions.push("ai disabled");

      // 3. Desativa Follow-Up IA + fluxos personalizados
      await supabase.from("followup_config").update({ enabled: false, updated_at: new Date().toISOString() }).eq("account_id", acc.id);
      await supabase.from("followup_config").update({ enabled: false, updated_at: new Date().toISOString() }).eq("user_id", acc.owner_user_id);
      await supabase.from("custom_followup_flows").update({ enabled: false, updated_at: new Date().toISOString() }).eq("account_id", acc.id);
      result.actions.push("followup disabled");

      // 4. Move card admin_crm_deals para 'Trial expirado'
      const { data: deal } = await supabase
        .from("admin_crm_deals")
        .select("id, stage_id")
        .eq("user_ref_id", acc.owner_user_id)
        .maybeSingle();
      if (deal) {
        const { data: dealStage } = await supabase
          .from("admin_crm_stages").select("pipeline_id").eq("id", deal.stage_id).maybeSingle();
        if (dealStage?.pipeline_id) {
          const { data: targetStage } = await supabase
            .from("admin_crm_stages")
            .select("id")
            .eq("pipeline_id", dealStage.pipeline_id)
            .ilike("name", TRIAL_EXPIRED_STAGE_NAME)
            .maybeSingle();
          if (targetStage) {
            const { data: maxRow } = await supabase
              .from("admin_crm_deals").select("position").eq("stage_id", targetStage.id)
              .order("position", { ascending: false }).limit(1).maybeSingle();
            const newPos = ((maxRow?.position as number) ?? -1) + 1;
            await supabase.from("admin_crm_deals").update({
              stage_id: targetStage.id,
              position: newPos,
              updated_at: new Date().toISOString(),
            }).eq("id", deal.id);
            result.actions.push("deal moved to trial_expirado");
          }
        }
      }

      processed.push(result);
    }

    return json({ success: true, count: processed.length, processed });
  } catch (error) {
    console.error("enforce-trial-expiration error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
