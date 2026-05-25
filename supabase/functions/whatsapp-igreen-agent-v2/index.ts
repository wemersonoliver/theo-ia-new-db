// whatsapp-igreen-agent-v2 — Edge function principal da vertical Igreen V2.
//
// FASE 1 (Fundação):
//   - roteamento estrito por accounts.is_igreen (D13)
//   - cria/carrega state via state-engine (D9 + D14)
//   - emite trace minimal (D5)
//   - resposta de eco para validar o pipeline
//
// As fases seguintes plugam: fast-path, supervisor, specialists, tools,
// automações, RAG, document validator, humanização, failsafe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isIgreenAccount } from "../_igreen_v2/routing/is-igreen.ts";
import { applyPatch, ensureState } from "../_igreen_v2/state-engine/update.ts";
import { trace } from "../_igreen_v2/observability/trace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingPayload {
  account_id?: string;
  phone?: string;
  message?: string;
  ping?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: IncomingPayload = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (body.ping) {
    return json({ ok: true, service: "whatsapp-igreen-agent-v2", phase: 1 });
  }

  const account_id = (body.account_id ?? "").trim();
  const phone = (body.phone ?? "").trim();

  if (!account_id || !phone) {
    return json({ error: "account_id and phone are required" }, 400);
  }

  // D13 — roteamento estrito
  const isIgreen = await isIgreenAccount(account_id);
  if (!isIgreen) {
    return json(
      {
        routed: false,
        reason: "account_not_igreen",
        hint: "Esta edge atende apenas contas com accounts.is_igreen = true.",
      },
      403,
    );
  }

  const t0 = Date.now();
  await trace({
    account_id,
    phone,
    step: "agent.received",
    level: "minimal",
    payload: { has_message: !!body.message },
  });

  // D9 + D14 — garante estado canônico e aplica patch via único writer
  await ensureState(account_id, phone);
  await applyPatch({
    account_id,
    phone,
    patch: { last_event_at: new Date().toISOString() },
    events: [
      {
        type: "message_received",
        priority: "low",
        source: "fast_path",
        payload: { message_preview: (body.message ?? "").slice(0, 80) },
      },
    ],
    source: "agent",
  });

  await trace({
    account_id,
    phone,
    step: "agent.completed",
    level: "minimal",
    duration_ms: Date.now() - t0,
    payload: { phase: 1 },
  });

  return json({
    ok: true,
    phase: 1,
    routed: true,
    note: "Fase 1 (Fundação) operacional. Pipeline cognitivo será plugado nas próximas fases.",
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}