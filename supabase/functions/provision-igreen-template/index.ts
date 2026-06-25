import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULTS = [
  { key: "CENARIO1", name: "Cenário 1" },
  { key: "CENARIO2", name: "Cenário 2" },
  { key: "CENARIO3", name: "Cenário 3" },
];

// Conta-modelo Igreen: o conteúdo dos cenários (dias/mensagens/vídeos)
// é clonado a partir desta conta para toda nova conta Igreen provisionada.
// Para trocar a conta-modelo, basta atualizar este UUID.
const IGREEN_TEMPLATE_ACCOUNT_ID =
  Deno.env.get("IGREEN_TEMPLATE_ACCOUNT_ID") ||
  "3f304fb6-fd4e-46d0-9831-b23fabd37b7a";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca a conta como Igreen — isso libera a injeção do contexto Igreen
    // (Jhulia, Conexão Green/Telecom/Expansão, descontos) no agente IA.
    await supabase.from("accounts").update({ is_igreen: true }).eq("id", account_id);

    // Garante que os 3 produtos Igreen padrão existam para a conta.
    await supabase.from("igreen_account_products").upsert(
      [
        { account_id, key: "green",    name: "Conexão Green",    description: "Energia por assinatura", position: 1 },
        { account_id, key: "telecom",  name: "Conexão Telecom",  description: "Telecomunicações",       position: 2 },
        { account_id, key: "expansao", name: "Conexão Expansão", description: "Expansão de negócios",   position: 3 },
      ],
      { onConflict: "account_id,key", ignoreDuplicates: true },
    );

    // Cria os 3 cenários padrão do produto "Conexão Green" (idempotente)
    const rows = DEFAULTS.map((d) => ({
      account_id,
      scenario_key: d.key,
      product_key: "green",
      trigger_tag: d.key,
      name: d.name,
      enabled: true,
    }));
    await supabase.from("igreen_scenarios").upsert(rows, {
      onConflict: "account_id,scenario_key",
      ignoreDuplicates: true,
    });

    // Clona o conteúdo (dias, mensagens e itens) da conta-modelo para esta conta.
    // O RPC só copia para cenários que ainda estão vazios — não sobrescreve nada.
    let cloned: any = null;
    if (IGREEN_TEMPLATE_ACCOUNT_ID && IGREEN_TEMPLATE_ACCOUNT_ID !== account_id) {
      try {
        const { data: cloneRes, error: cloneErr } = await supabase.rpc(
          "clone_igreen_scenario_content",
          {
            _source_account: IGREEN_TEMPLATE_ACCOUNT_ID,
            _target_account: account_id,
          },
        );
        if (cloneErr) console.warn("clone_igreen_scenario_content failed", cloneErr);
        else cloned = cloneRes;
      } catch (e) {
        console.warn("clone_igreen_scenario_content threw", e);
      }
    }

    // Provisiona pipeline CRM Igreen (etapas + automações por tag)
    try {
      await supabase.rpc("provision_igreen_pipeline", { _account_id: account_id });
    } catch (e) {
      console.warn("provision_igreen_pipeline failed", e);
    }

    // Aplica prompt padrão Igreen no whatsapp_ai_config do owner da conta
    let aiApplied = false;
    try {
      const { data: acc } = await supabase
        .from("accounts")
        .select("owner_user_id")
        .eq("id", account_id)
        .maybeSingle();
      const ownerId = acc?.owner_user_id;
      if (ownerId) {
        const { data: tmpl } = await supabase
          .from("igreen_default_ai_config")
          .select("custom_prompt, business_description, business_niche, agent_name")
          .eq("singleton", true)
          .maybeSingle();
        if (tmpl?.custom_prompt) {
          const { data: existing } = await supabase
            .from("whatsapp_ai_config")
            .select("id, custom_prompt")
            .eq("user_id", ownerId)
            .maybeSingle();
          const isEmpty = !existing?.custom_prompt || existing.custom_prompt.trim().length === 0;
          if (!existing) {
            await supabase.from("whatsapp_ai_config").insert({
              user_id: ownerId,
              custom_prompt: tmpl.custom_prompt,
              business_description: tmpl.business_description,
              business_niche: tmpl.business_niche,
              agent_name: tmpl.agent_name ?? "Assistente Virtual",
              active: true,
            });
            aiApplied = true;
          } else if (isEmpty) {
            await supabase.from("whatsapp_ai_config").update({
              custom_prompt: tmpl.custom_prompt,
              business_description: tmpl.business_description,
              business_niche: tmpl.business_niche,
              agent_name: tmpl.agent_name ?? "Assistente Virtual",
              active: true,
            }).eq("id", existing.id);
            aiApplied = true;
          }
        }
      }
    } catch (e) {
      console.warn("apply igreen default ai failed", e);
    }

    return new Response(JSON.stringify({ ok: true, scenarios: DEFAULTS.length, ai_applied: aiApplied, cloned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});