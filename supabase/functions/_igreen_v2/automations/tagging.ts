import type { AutomationResult } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

// Fallback: padrões de nome de etapa por tag quando não houver
// configuração em crm_tag_automations.
const TAG_STAGE_PATTERNS: Record<string, RegExp[]> = {
  "em atendimento": [/iniciou\s*atendimento/i, /em\s*atendimento/i],
  "enviou fatura": [/enviou\s*fatura/i, /fatura\s*de\s*energia/i],
  "enviou documento": [/enviou\s*documento/i, /documento\s*do\s*titular/i],
  "atendimento humano": [/atendimento\s*humano/i, /humano/i],
  "assinou contrato": [/assinou\s*contrato/i, /fechado.?ganho/i, /ganho/i],
};

async function resolveTargetStageId(
  account_id: string,
  tag: string,
): Promise<string | null> {
  // 1) configuração explícita
  try {
    const { data: cfg } = await svc()
      .from("crm_tag_automations")
      .select("target_stage_id, enabled")
      .eq("account_id", account_id)
      .eq("tag", tag)
      .eq("enabled", true)
      .maybeSingle();
    if ((cfg as any)?.target_stage_id) return (cfg as any).target_stage_id as string;
  } catch (e) {
    console.error("[tagging] crm_tag_automations lookup failed", e);
  }
  // 2) fallback por padrão de nome de etapa no primeiro pipeline da account
  const patterns = TAG_STAGE_PATTERNS[tag.toLowerCase()];
  if (!patterns) return null;
  try {
    const { data: pipelines } = await svc()
      .from("crm_pipelines")
      .select("id, created_at")
      .eq("account_id", account_id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!pipelines || pipelines.length === 0) return null;
    const { data: stages } = await svc()
      .from("crm_stages")
      .select("id, name, position")
      .eq("pipeline_id", (pipelines[0] as any).id)
      .order("position", { ascending: true });
    if (!stages) return null;
    const target = (stages as any[]).find((s) => patterns.some((re) => re.test(String(s.name || ""))));
    return target?.id ?? null;
  } catch (e) {
    console.error("[tagging] fallback stage lookup failed", e);
    return null;
  }
}

async function moveCardForPhone(
  account_id: string,
  phone: string,
  target_stage_id: string,
): Promise<{ moved: boolean; deal_id?: string; reason?: string }> {
  try {
    const { data: contact } = await svc()
      .from("contacts")
      .select("id")
      .eq("account_id", account_id)
      .eq("phone", phone)
      .maybeSingle();
    if (!contact) return { moved: false, reason: "contact_not_found" };
    const { data: deals } = await svc()
      .from("crm_deals")
      .select("id, stage_id")
      .eq("account_id", account_id)
      .eq("contact_id", (contact as any).id)
      .is("won_at", null)
      .is("lost_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (!deals || deals.length === 0) return { moved: false, reason: "deal_not_found" };
    const deal = deals[0] as any;
    if (deal.stage_id === target_stage_id) return { moved: false, reason: "already_in_stage", deal_id: deal.id };
    const { error } = await svc()
      .from("crm_deals")
      .update({ stage_id: target_stage_id, updated_at: new Date().toISOString() })
      .eq("id", deal.id);
    if (error) return { moved: false, reason: `update_error:${error.message}`, deal_id: deal.id };
    return { moved: true, deal_id: deal.id };
  } catch (e) {
    return { moved: false, reason: (e as Error).message };
  }
}

export async function taggingAutomation(args: {
  account_id: string;
  phone: string;
  tag: string;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "tagging",
      idempotency_key: `tag:${args.account_id}:${args.phone}:${args.tag}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      try {
        await svc().rpc("tag_contact_reserved", {
          _account_id: args.account_id,
          _phone: args.phone,
          _tag: args.tag,
          _add: true,
        });
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
      // Mover o card no CRM para a etapa correspondente à tag.
      let moveResult: { moved: boolean; deal_id?: string; reason?: string } = { moved: false, reason: "no_target" };
      const target = await resolveTargetStageId(args.account_id, args.tag);
      if (target) {
        moveResult = await moveCardForPhone(args.account_id, args.phone, target);
      }
      return {
        success: true,
        events: [{
          type: "contact_tagged", priority: "low", source: "automation",
          payload: { tag: args.tag, crm_moved: moveResult.moved, crm_reason: moveResult.reason ?? null, deal_id: moveResult.deal_id ?? null, target_stage_id: target },
        }],
      };
    },
  );
}