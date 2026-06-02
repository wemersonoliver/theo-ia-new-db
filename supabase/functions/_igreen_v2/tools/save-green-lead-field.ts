// Tool save_green_lead_field — persiste captura de campo do lead Green.
// Upsert em igreen_lead_data por (account_id, phone). Idempotente por (phone, field, value).

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

const ALLOWED_FIELDS = new Set([
  "nome_cliente",
  "estado",
  "distribuidora",
  "valor_fatura",
  "nome_titular_fatura",
  "tipo_conta",
]);

interface Args {
  field: string;
  value: string;
}

function normalize(field: string, value: string): { col: string; payload: Record<string, unknown>; extrasValue?: unknown } | null {
  const v = (value ?? "").toString().trim();
  if (!v) return null;
  switch (field) {
    case "valor_fatura": {
      const digits = v.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
      const num = Number.parseFloat(digits);
      if (!Number.isFinite(num) || num <= 0) return null;
      // Persistimos centavos no banco mas devolvemos o valor em REAIS para
      // o extras (extras.valor_fatura deve ser sempre em reais). Sem isso o
      // patch gravava 50000 em extras quando o cliente dizia "500".
      return {
        col: "valor_fatura_cents",
        payload: { valor_fatura_cents: Math.round(num * 100) },
        extrasValue: num,
      };
    }
    case "estado": {
      const uf = v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
      return { col: "estado", payload: { estado: uf || v.slice(0, 60) } };
    }
    default:
      return { col: field, payload: { [field]: v.slice(0, 120) } };
  }
}

export const saveGreenLeadFieldTool: ToolDefinition<Args> = {
  name: "save_green_lead_field",
  description: "Persiste campo do lead Green (nome, distribuidora, estado, valor da fatura, titular).",
  idempotencyKey: (a, ctx) => `save_lead:${ctx.phone}:${a.field}:${String(a.value).slice(0, 40)}`,
  validate: (raw) => {
    const r = (raw ?? {}) as Args;
    if (!r.field || !ALLOWED_FIELDS.has(r.field)) {
      throw new Error(`field must be one of: ${[...ALLOWED_FIELDS].join(", ")}`);
    }
    if (r.value === undefined || r.value === null) throw new Error("value required");
    return { field: r.field, value: String(r.value) };
  },
  execute: async (ctx, args): Promise<ToolResult> => {
    const norm = normalize(args.field, args.value);
    if (!norm) {
      return { success: true, skipped: true, skip_reason: "invalid_value" };
    }
    try {
      // Upsert por (account_id, phone). Tabela tem unique nesses dois.
      const { error } = await svc()
        .from("igreen_lead_data")
        .upsert(
          { account_id: ctx.account_id, phone: ctx.phone, ...norm.payload, updated_at: new Date().toISOString() },
          { onConflict: "account_id,phone" },
        );
      if (error) {
        return {
          success: false,
          error: error.message,
          events: [{ type: "lead_field_persist_failed", priority: "medium", source: "tool",
            payload: { field: args.field, error: error.message } }],
        };
      }
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        events: [{ type: "lead_field_persist_failed", priority: "medium", source: "tool",
          payload: { field: args.field, error: (e as Error).message } }],
      };
    }

    const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;
    return {
      success: true,
      events: [{
        type: "lead_field_saved", priority: "low", source: "tool",
        payload: { field: args.field },
      }],
      suggested_state_patch: {
        extras: {
          ...currentExtras,
          [args.field]: norm.extrasValue !== undefined
            ? norm.extrasValue
            : norm.payload[Object.keys(norm.payload)[0]],
        },
      },
      data: { field: args.field, persisted: true },
    };
  },
};