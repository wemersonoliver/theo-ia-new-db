// Tool validate_green_identity — Etapa 6 do roteiro Igreen.
// Espelha validate_green_invoice porém para documento de identidade (RG/CNH).
// Implementação mínima funcional: classifica via igreen-document-validator com kind="identity".

import type { ToolDefinition } from "../tool-router/types.ts";
import type { ToolResult } from "../types.ts";
import { snapshot } from "../state-engine/snapshot.ts";
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

interface Args { media_url: string; mime_type: string; byte_size: number }

function firstName(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

export const validateGreenIdentityTool: ToolDefinition<Args> = {
  name: "validate_green_identity",
  description: "Valida documento de identidade (RG/CNH) do titular da fatura.",
  idempotencyKey: (a) => `validate_identity:${a.media_url}`,
  validate: (raw) => {
    const r = (raw ?? {}) as Args;
    if (!r.media_url) throw new Error("media_url required");
    return {
      media_url: String(r.media_url),
      mime_type: String(r.mime_type ?? ""),
      byte_size: Number(r.byte_size ?? 0),
    };
  },
  execute: async (ctx, args): Promise<ToolResult> => {
    const correlation_id = ctx.correlation_id ?? null;
    await snapshot({
      account_id: ctx.account_id, phone: ctx.phone,
      label: "before_identity_validation", correlation_id,
      extra: { media_url_hash: args.media_url.slice(-12) },
    });

    let validator: any = { classification: "unreadable", confidence: 0, extracted: {}, error: "no_response" };
    try {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/igreen-document-validator`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          correlation_id,
          account_id: ctx.account_id,
          phone: ctx.phone,
          kind: "identity",
          media_url: args.media_url,
          mime_type: args.mime_type,
          byte_size: args.byte_size,
        }),
      });
      validator = await r.json();
    } catch (e) {
      validator.error = (e as Error).message;
    }

    const classification = String(validator.classification ?? "unreadable");
    const confidence = Number(validator.confidence ?? 0);
    const extracted = (validator.extracted ?? {}) as Record<string, unknown>;
    const docName = (extracted.holder_name as string | undefined) ?? (extracted.full_name as string | undefined) ?? null;

    const isIdDoc = classification === "rg" || classification === "cnh" || classification === "identity";

    // Holder match: compara nome do documento com nome_titular_fatura ou nome_cliente do lead.
    let titularName: string | null = null;
    try {
      const { data: lead } = await svc()
        .from("igreen_lead_data")
        .select("nome_titular_fatura, nome_cliente")
        .eq("account_id", ctx.account_id)
        .eq("phone", ctx.phone)
        .maybeSingle();
      titularName = (lead?.nome_titular_fatura as string | undefined)
        ?? (lead?.nome_cliente as string | undefined)
        ?? null;
    } catch { /* non-blocking */ }

    const match = isIdDoc && titularName != null && docName != null
      && firstName(docName) === firstName(titularName);

    const events: ToolResult["events"] = [{
      type: "identity_validated", priority: "high", source: "tool",
      payload: { is_id_document: isIdDoc, match, classification, confidence },
    }];

    const patch: Record<string, unknown> = {
      identidade_validada: !!match,
    };
    if (match) {
      patch.etapa_funil = "documento_validado";
    } else if (isIdDoc) {
      patch.etapa_funil = "documento_enviado";
    }

    try {
      if (isIdDoc && docName) {
        await svc().from("igreen_lead_data").upsert(
          {
            account_id: ctx.account_id,
            phone: ctx.phone,
            nome_documento: docName.slice(0, 120),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id,phone" },
        );
      }
    } catch { /* non-blocking */ }

    await snapshot({
      account_id: ctx.account_id, phone: ctx.phone,
      label: "after_identity_validation", correlation_id,
      extra: { is_id_document: isIdDoc, match },
    });

    return {
      success: true,
      events,
      suggested_state_patch: patch as any,
      data: { is_id_document: isIdDoc, match, extracted_name: docName, classification, confidence },
    };
  },
};