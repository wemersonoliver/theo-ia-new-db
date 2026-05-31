// Tool get_distributor_discount — consulta tabela oficial igreen_distributor_discounts.
// NUNCA inventa: found=false quando não houver linha.

import type { ToolDefinition } from "../tool-router/types.ts";
import type { ToolResult } from "../types.ts";
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

interface Args { state: string; distributor: string }

function norm(s: string): string {
  return (s ?? "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export const getDistributorDiscountTool: ToolDefinition<Args> = {
  name: "get_distributor_discount",
  description: "Consulta faixa oficial de desconto por estado+distribuidora (tabela igreen_distributor_discounts).",
  idempotencyKey: (a) => `discount:${(a.state ?? "").toUpperCase()}:${norm(a.distributor)}`,
  validate: (raw) => {
    const r = (raw ?? {}) as Args;
    if (!r.state) throw new Error("state required");
    if (!r.distributor) throw new Error("distributor required");
    return {
      state: String(r.state).toUpperCase().slice(0, 2),
      distributor: String(r.distributor).slice(0, 80),
    };
  },
  execute: async (ctx, args): Promise<ToolResult> => {
    let found = false;
    let row: Record<string, unknown> | null = null;
    try {
      const { data, error } = await svc()
        .from("igreen_distributor_discounts")
        .select("state,distributor,distributor_aliases,discount_min_percent,discount_max_percent,modalidade,min_bill_brl,notes,enabled")
        .eq("state", args.state)
        .eq("enabled", true);
      if (error) throw error;
      const needle = norm(args.distributor);
      const match = (data ?? []).find((r: any) => {
        if (norm(r.distributor).includes(needle) || needle.includes(norm(r.distributor))) return true;
        const aliases = Array.isArray(r.distributor_aliases) ? r.distributor_aliases : [];
        return aliases.some((a: string) => norm(a).includes(needle) || needle.includes(norm(a)));
      });
      if (match) { found = true; row = match; }
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        events: [{ type: "discount_lookup_failed", priority: "medium", source: "tool",
          payload: { state: args.state, distributor: args.distributor, error: (e as Error).message } }],
        data: { found: false },
      };
    }

    const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;
    const data = found && row ? {
      found: true,
      state: row.state,
      distributor: row.distributor,
      discount_min_percent: row.discount_min_percent,
      discount_max_percent: row.discount_max_percent,
      modalidade: row.modalidade,
      min_bill_brl: row.min_bill_brl,
      notes: row.notes,
    } : { found: false, state: args.state, distributor: args.distributor };

    return {
      success: true,
      events: [{
        type: "distributor_discount_resolved", priority: "low", source: "tool",
        payload: data,
      }],
      suggested_state_patch: {
        extras: {
          ...currentExtras,
          discount_lookup_done: true,
          discount_found: found,
          discount_min_percent: found ? (row?.discount_min_percent ?? null) : null,
          discount_max_percent: found ? (row?.discount_max_percent ?? null) : null,
        },
      },
      data,
    };
  },
};