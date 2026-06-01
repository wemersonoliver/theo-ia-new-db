// Tool validate_green_invoice — Fase 4.
// Pipeline interno (D14: única escrita via state-engine, sem mensagens):
//
//   snapshot("before_document_validation")
//   → media-guard
//   → chamar igreen-document-validator (edge isolada)
//   → confidence-thresholds
//   → holder-match
//   → invoice-rules
//   snapshot("after_document_validation")
//   → devolve suggested_state_patch + events
//
// Lock por sha1(media_url), TTL 120s (definido em tool-router/execute.ts).

import type { ToolDefinition } from "../tool-router/types.ts";
import type { ToolResult } from "../types.ts";
import { checkMedia } from "../document-rules-engine/media-guard.ts";
import { decideByConfidence } from "../document-rules-engine/confidence-thresholds.ts";
import { matchHolder } from "../document-rules-engine/holder-match.ts";
import { decideInvoiceFinal } from "../document-rules-engine/invoice-rules.ts";
import { CURRENT_VALIDATION_VERSION } from "../document-rules-engine/version.ts";
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

interface Args {
  media_url: string;
  mime_type: string;
  byte_size: number;
}

async function sha1Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskDocId(doc: string | undefined): string | null {
  if (!doc) return null;
  const digits = doc.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return digits.slice(0, 3).replace(/./g, "*") + "." + digits.slice(3, 6) + ".***-" + digits.slice(-2);
}

export const validateGreenInvoiceTool: ToolDefinition<Args> = {
  name: "validate_green_invoice",
  description: "Valida fatura de energia: media-guard → validator → thresholds → holder-match → suggested_state_patch.",
  // Lock determinístico por media_url (best-effort sync — hash será re-derivado abaixo no execute).
  idempotencyKey: (a, _ctx) => `validate_invoice:${a.media_url}`,
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
    const attempt = (ctx.state.validation_attempts ?? 0) + 1;

    await snapshot({
      account_id: ctx.account_id,
      phone: ctx.phone,
      label: "before_document_validation",
      correlation_id,
      extra: { attempt, validation_version: CURRENT_VALIDATION_VERSION },
    });

    // 1) media-guard
    let effectiveByteSize = Number(args.byte_size ?? 0);
    let effectiveMime = String(args.mime_type ?? "");
    if (!effectiveByteSize || !effectiveMime) {
      // Fallback: HEAD na URL para obter Content-Length / Content-Type.
      // Cobre faturas que vieram do webhook sem media_size persistido.
      try {
        const head = await fetch(args.media_url, { method: "HEAD" });
        if (head.ok) {
          if (!effectiveByteSize) {
            const cl = Number(head.headers.get("content-length") ?? 0);
            if (Number.isFinite(cl) && cl > 0) effectiveByteSize = cl;
          }
          if (!effectiveMime) {
            const ct = (head.headers.get("content-type") ?? "").split(";")[0].trim();
            if (ct) effectiveMime = ct;
          }
        }
      } catch (e) {
        console.error("[validate_green_invoice] HEAD fallback failed", e);
      }
    }
    const guard = checkMedia({ media_url: args.media_url, mime_type: effectiveMime, byte_size: effectiveByteSize });
    if (!guard.ok) {
      const res: ToolResult = {
        success: true,
        events: [{
          type: "media_rejected", priority: "high", source: "tool",
          payload: { reason: guard.reason, detail: guard.detail ?? {} },
        }],
        suggested_state_patch: {
          validation_attempts: attempt,
          document_status: "rejected",
          validation_version: CURRENT_VALIDATION_VERSION,
          extras: {
            ...((ctx.state.extras ?? {}) as Record<string, unknown>),
            last_media_reject_reason: guard.reason,
            invoice_rejected_notified: false,
          },
        },
        data: { stage: "media_guard", reason: guard.reason },
      };
      await snapshot({
        account_id: ctx.account_id, phone: ctx.phone,
        label: "after_document_validation",
        correlation_id,
        extra: { attempt, outcome: "media_rejected", reason: guard.reason },
      });
      return res;
    }

    // 2) chama validator isolado
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/igreen-document-validator`;
    let validator: any = { classification: "unreadable", confidence: 0, extracted: {}, attempts: 0, error: "no_response" };
    try {
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
          kind: "invoice",
          media_url: args.media_url,
          mime_type: effectiveMime || args.mime_type,
          byte_size: effectiveByteSize || args.byte_size,
          pipeline_version: CURRENT_VALIDATION_VERSION,
        }),
      });
      validator = await r.json();
    } catch (e) {
      validator.error = (e as Error).message;
    }

    const confidence = Number(validator.confidence ?? 0);
    const classification = String(validator.classification ?? "unreadable");
    const extracted = (validator.extracted ?? {}) as Record<string, unknown>;
    const holderName = (extracted.holder_name as string | undefined) ?? null;

    // 3) thresholds
    const threshold = decideByConfidence(confidence);

    // 4) holder-match — usa nome do lead se existir (lead_data.client_name), senão "unknown"
    let clientName: string | null = null;
    try {
      const { data: lead } = await svc()
        .from("igreen_lead_data")
        .select("nome_cliente")
        .eq("account_id", ctx.account_id)
        .eq("phone", ctx.phone)
        .maybeSingle();
      clientName = (lead?.nome_cliente as string | undefined) ?? null;
    } catch { /* non-blocking */ }
    const holder = matchHolder(holderName, clientName);

    // 5) decisão final
    const final = decideInvoiceFinal({ classification: classification as any, threshold, holder_match: holder.status });

    // log mínimo (sem raw, sem payload Gemini completo)
    try {
      await svc().from("igreen_document_validations").insert({
        account_id: ctx.account_id,
        phone: ctx.phone,
        kind: "invoice",
        provider: validator.provider ?? "gemini",
        classification,
        confidence,
        threshold_decision: threshold,
        extracted: {
          holder_name: holderName,
          document_id_masked: maskDocId(extracted.document_id as string | undefined),
          distributor: extracted.distributor ?? null,
          energy_consumption_kwh: extracted.energy_consumption_kwh ?? null,
        },
        valid: final === "approve" || final === "soft_confirm",
        reject_reason: final.startsWith("reject_") ? final : null,
        media_url: args.media_url,
        correlation_id,
        pipeline_version: CURRENT_VALIDATION_VERSION,
      });
    } catch (e) {
      console.error("[validate_green_invoice] log insert failed", e);
    }

    // 6) patch + events conforme decisão
    const events: ToolResult["events"] = [{
      type: "document_validated", priority: "medium", source: "tool",
      payload: {
        classification, confidence, threshold,
        holder_match: holder.status, holder_score: holder.score,
        final, attempts: validator.attempts ?? 0,
        validator_error: validator.error ?? null,
      },
    }];

    const patch: Record<string, unknown> = {
      validation_attempts: attempt,
      document_confidence: confidence,
      holder_match_status: holder.status,
      validation_version: CURRENT_VALIDATION_VERSION,
    };

    switch (final) {
      case "approve":
        patch.document_status = "validated";
        patch.etapa_funil = "fatura_validada";
        patch.fatura_valida = true;
        patch.holder_match = holder.status === "match";
        events.push({ type: "invoice_approved", priority: "high", source: "tool", payload: {} });
        break;
      case "soft_confirm":
        patch.document_status = "awaiting_soft_confirm";
        events.push({ type: "invoice_soft_confirm_requested", priority: "high", source: "tool",
          payload: { holder_name: holderName } });
        break;
      case "reject_holder_mismatch":
        patch.document_status = "rejected";
        patch.etapa_funil = "fatura_rejeitada";
        patch.fatura_valida = false;
        patch.holder_match = false;
        events.push({ type: "invoice_rejected", priority: "high", source: "tool",
          payload: { reason: "holder_mismatch" } });
        break;
      case "reject_low_confidence":
      case "reject_unreadable":
      case "reject_not_invoice":
        patch.document_status = "rejected";
        patch.etapa_funil = "fatura_rejeitada";
        events.push({ type: "invoice_rejected", priority: "high", source: "tool",
          payload: { reason: final } });
        break;
    }

    if (validator.error) {
      events.push({ type: "validation_failed", priority: "high", source: "tool",
        payload: { error: validator.error, attempts: validator.attempts ?? 0 } });
    }

    await snapshot({
      account_id: ctx.account_id, phone: ctx.phone,
      label: "after_document_validation",
      correlation_id,
      extra: { attempt, outcome: final, classification, confidence, holder_match: holder.status },
    });

    return {
      success: true,
      events,
      suggested_state_patch: patch as any,
      data: { final, classification, confidence, threshold, holder_match: holder.status, holder_name: holderName },
    };
  },
};

// re-export para testes
export { sha1Hex as _sha1Hex };