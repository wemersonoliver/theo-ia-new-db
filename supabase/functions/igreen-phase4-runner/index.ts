// Phase 4 operational validation harness (server-side, service-role).
// Purpose: deterministically exercise the 14 scenarios using mock:// URLs
// and tool-mode invocations of whatsapp-igreen-agent-v2. Test-only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACCOUNT_ID = "1aae0245-dbe0-4c9f-9050-8572ac1d894f";
const BASE_PHONE = "5599900040"; // suffixes 001..014

const svc = createClient(SUPABASE_URL, SVC, { auth: { persistSession: false } });

function ph(n: number) { return BASE_PHONE + String(n).padStart(3, "0"); }

async function callAgent(body: Record<string, unknown>) {
  const t0 = Date.now();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-igreen-agent-v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SVC}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ms: Date.now() - t0, body: j };
}

async function reset(n: number) {
  const p = ph(n);
  await svc.from("igreen_conversation_state").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_lead_data").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_tool_locks").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_document_validations").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_automation_executions").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_state_snapshots").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_traces").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
  await svc.from("igreen_state_events").delete().eq("account_id", ACCOUNT_ID).eq("phone", p);
}

async function seedStateFaturaEnviada(n: number) {
  const p = ph(n);
  await svc.from("igreen_conversation_state").upsert({
    account_id: ACCOUNT_ID, phone: p, etapa_funil: "fatura_enviada",
  }, { onConflict: "account_id,phone" });
}

async function seedLead(n: number, nome: string) {
  await svc.from("igreen_lead_data").upsert({
    account_id: ACCOUNT_ID, phone: ph(n), nome_cliente: nome,
  }, { onConflict: "account_id,phone" });
}

function mockUrl(q: Record<string, string | number>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) sp.append(k, String(v));
  return "mock://?" + sp.toString();
}

async function evidence(n: number) {
  const p = ph(n);
  const [traces, events, snaps, autos, vals, state, locks] = await Promise.all([
    svc.from("igreen_traces").select("step,correlation_id,duration_ms").eq("account_id", ACCOUNT_ID).eq("phone", p).order("created_at", { ascending: false }).limit(50),
    svc.from("igreen_state_events").select("event_type,event_priority,correlation_id,payload").eq("account_id", ACCOUNT_ID).eq("phone", p).order("created_at", { ascending: false }).limit(50),
    svc.from("igreen_state_snapshots").select("reason,state").eq("account_id", ACCOUNT_ID).eq("phone", p).order("created_at", { ascending: false }).limit(10),
    svc.from("igreen_automation_executions").select("automation,correlation_id,idempotency_key,result,executed_at").eq("account_id", ACCOUNT_ID).eq("phone", p).order("executed_at", { ascending: false }).limit(20),
    svc.from("igreen_document_validations").select("classification,confidence,threshold_decision,valid,reject_reason,extracted,correlation_id,pipeline_version").eq("account_id", ACCOUNT_ID).eq("phone", p).order("created_at", { ascending: false }).limit(10),
    svc.from("igreen_conversation_state").select("document_status,document_confidence,holder_match_status,validation_attempts,validation_version,etapa_funil,fatura_valida").eq("account_id", ACCOUNT_ID).eq("phone", p).maybeSingle(),
    svc.from("igreen_tool_locks").select("tool,lock_key,expires_at").eq("account_id", ACCOUNT_ID).eq("phone", p),
  ]);
  return { traces: traces.data, events: events.data, snapshots: snaps.data, automations: autos.data, validations: vals.data, state: state.data, locks: locks.data };
}

const SCENARIOS: Array<{ n: number; name: string; kind: string; setup?: () => Promise<void>; run: () => Promise<any>; expectFn: (ev: any, exec: any) => { pass: boolean; why: string } }> = [
  // 1) MIME inválido (text/html) → media-guard rejeita
  { n: 1, name: "MIME inválido text/html", kind: "SYNTHETIC-LIVE",
    setup: async () => seedStateFaturaEnviada(1),
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(1), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.95 }), mime_type: "text/html", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "rejected" && ev.events?.some((e:any)=>e.event_type==="media_rejected"), why: `status=${ev.state?.document_status}` }) },
  // 2) PDF muito pequeno → too_small
  { n: 2, name: "PDF muito pequeno (<50KB)", kind: "SYNTHETIC-LIVE",
    setup: async () => seedStateFaturaEnviada(2),
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(2), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.95 }), mime_type: "application/pdf", byte_size: 1024 } }),
    expectFn: (ev) => ({ pass: ev.events?.some((e:any)=>e.event_type==="media_rejected" && e.payload?.reason==="too_small"), why: "media_rejected too_small" }) },
  // 3) Confidence 0.65 → request_resend → rejected low_confidence
  { n: 3, name: "Confidence 0.65 (resend)", kind: "MOCKED-PROVIDER",
    setup: async () => seedStateFaturaEnviada(3),
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(3), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.65 }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "rejected" && ev.validations?.[0]?.reject_reason === "reject_low_confidence", why: `reject=${ev.validations?.[0]?.reject_reason}` }) },
  // 4) Confidence 0.82 + holder match → soft_confirm
  { n: 4, name: "Confidence 0.82 + holder match (soft)", kind: "MOCKED-PROVIDER",
    setup: async () => { await seedLead(4, "João da Silva"); await seedStateFaturaEnviada(4); },
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(4), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.82, holder: "Joao da Silva", doc: "12345678901" }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "awaiting_soft_confirm" && ev.state?.holder_match_status === "match", why: `status=${ev.state?.document_status} hm=${ev.state?.holder_match_status}` }) },
  // 5) Confidence 0.95 + holder match → approve
  { n: 5, name: "Confidence 0.95 + holder match (approve)", kind: "MOCKED-PROVIDER",
    setup: async () => { await seedLead(5, "Maria Souza"); await seedStateFaturaEnviada(5); },
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(5), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Maria Souza", doc: "98765432100" }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "validated" && ev.state?.fatura_valida === true && ev.state?.holder_match_status === "match", why: `status=${ev.state?.document_status} hm=${ev.state?.holder_match_status}` }) },
  // 6) Holder mismatch bloqueando aprovação
  { n: 6, name: "Holder mismatch bloqueia", kind: "MOCKED-PROVIDER",
    setup: async () => { await seedLead(6, "Carlos Pereira"); await seedStateFaturaEnviada(6); },
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(6), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.97, holder: "Outro Nome", doc: "11122233344" }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "rejected" && ev.validations?.[0]?.reject_reason === "reject_holder_mismatch", why: `reject=${ev.validations?.[0]?.reject_reason}` }) },
  // 7) Soft confirmation "sim" via fast-path
  { n: 7, name: "Soft-confirm sim via fast-path", kind: "SYNTHETIC-LIVE",
    setup: async () => { await seedLead(7, "Ana Lima"); await seedStateFaturaEnviada(7); },
    run: async () => {
      // primeiro: gera soft-confirm
      await callAgent({ account_id: ACCOUNT_ID, phone: ph(7), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.80, holder: "Ana Lima", doc: "22233344455" }), mime_type: "image/jpeg", byte_size: 200_000 } });
      // segundo: usuário responde "sim"
      return callAgent({ account_id: ACCOUNT_ID, phone: ph(7), message: "sim" });
    },
    expectFn: (ev) => ({ pass: ev.state?.document_status === "validated" && ev.state?.fatura_valida === true, why: `final=${ev.state?.document_status}` }) },
  // 8) Concorrência: 5 chamadas simultâneas → lock idempotente
  { n: 8, name: "5 concurrent invoices (lock)", kind: "SYNTHETIC-LIVE",
    setup: async () => { await seedLead(8, "Pedro Concorrente"); await seedStateFaturaEnviada(8); },
    run: async () => {
      const url = mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Pedro Concorrente", doc: "33344455566", delay_ms: 800 });
      const calls = Array.from({ length: 5 }, () => callAgent({ account_id: ACCOUNT_ID, phone: ph(8), tool: "validate_green_invoice", tool_args: { media_url: url, mime_type: "image/jpeg", byte_size: 200_000 } }));
      const results = await Promise.all(calls);
      return { count: results.length, statuses: results.map(r => r.body?.result?.skipped ? "skipped" : "executed") };
    },
    expectFn: (ev, exec) => {
      const skipped = exec.statuses?.filter((s:string)=>s==="skipped").length ?? 0;
      const executed = exec.statuses?.filter((s:string)=>s==="executed").length ?? 0;
      return { pass: executed === 1 && skipped === 4 && ev.validations?.length === 1, why: `exec=${executed} skip=${skipped} validations=${ev.validations?.length}` };
    } },
  // 9) Validator timeout simulado (delay > 12s? não — não dá em 60s); usamos force_error
  { n: 9, name: "Validator error → unreadable", kind: "MOCKED-PROVIDER",
    setup: async () => seedStateFaturaEnviada(9),
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(9), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ force_error: 1, error: "gemini_timeout", attempts: 3 }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.state?.document_status === "rejected" && ev.events?.some((e:any)=>e.event_type==="validation_failed"), why: `events have validation_failed` }) },
  // 10) Validator HTTP error (mock force_error 500-like)
  { n: 10, name: "Validator forced error path", kind: "MOCKED-PROVIDER",
    setup: async () => seedStateFaturaEnviada(10),
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(10), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ force_error: 1, error: "gemini_500", attempts: 3 }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => ({ pass: ev.validations?.[0]?.classification === "unreadable", why: `class=${ev.validations?.[0]?.classification}` }) },
  // 11) Duplicate media (same URL, sequential) → lock conflict on 2nd
  { n: 11, name: "Duplicate media sequential", kind: "SYNTHETIC-LIVE",
    setup: async () => { await seedLead(11, "Lucas Dup"); await seedStateFaturaEnviada(11); },
    run: async () => {
      const url = mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Lucas Dup", doc: "44455566677", delay_ms: 1500 });
      const a = callAgent({ account_id: ACCOUNT_ID, phone: ph(11), tool: "validate_green_invoice", tool_args: { media_url: url, mime_type: "image/jpeg", byte_size: 200_000 } });
      // Fire second immediately to hit lock
      await new Promise(r => setTimeout(r, 100));
      const b = await callAgent({ account_id: ACCOUNT_ID, phone: ph(11), tool: "validate_green_invoice", tool_args: { media_url: url, mime_type: "image/jpeg", byte_size: 200_000 } });
      const aa = await a;
      return { a: aa.body?.result?.skipped ?? false, b: b.body?.result?.skipped ?? false };
    },
    expectFn: (ev, exec) => ({ pass: (exec.a === false && exec.b === true) || (exec.a === true && exec.b === false), why: `a_skip=${exec.a} b_skip=${exec.b}` }) },
  // 12) Duplicate automation idempotency — invoke approve twice, expect 1 automation row per type
  { n: 12, name: "Duplicate automation idempotency", kind: "SYNTHETIC-LIVE",
    setup: async () => { await seedLead(12, "Rita Idem"); await seedStateFaturaEnviada(12); },
    run: async () => {
      const url = mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Rita Idem", doc: "55566677788" });
      await callAgent({ account_id: ACCOUNT_ID, phone: ph(12), tool: "validate_green_invoice", tool_args: { media_url: url, mime_type: "image/jpeg", byte_size: 200_000 } });
      // Re-fire: tool lock conflict on same URL is expected, but force a new url so tool runs again and emits the same event class
      const url2 = mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Rita Idem", doc: "55566677788", attempts: 2 });
      return callAgent({ account_id: ACCOUNT_ID, phone: ph(12), tool: "validate_green_invoice", tool_args: { media_url: url2, mime_type: "image/jpeg", byte_size: 200_000 } });
    },
    expectFn: (ev) => {
      // automation 'tagging' (approve event) should only have one successful per idempotency_key class
      const tags = (ev.automations ?? []).filter((a:any)=>a.automation==="tagging");
      const uniqueKeys = new Set(tags.map((t:any)=>t.idempotency_key));
      return { pass: tags.length >= 1 && tags.length === uniqueKeys.size, why: `tagging_rows=${tags.length} unique_keys=${uniqueKeys.size}` };
    } },
  // 13) Duplicate webhook simulation (same message body twice) → idempotency at agent level (no specific guarantee — observational)
  { n: 13, name: "Duplicate webhook observability", kind: "SYNTHETIC-LIVE",
    run: async () => {
      const msg = "Olá quero saber sobre energia";
      const a = await callAgent({ account_id: ACCOUNT_ID, phone: ph(13), message: msg });
      const b = await callAgent({ account_id: ACCOUNT_ID, phone: ph(13), message: msg });
      return { a_cid: a.body?.correlation_id, b_cid: b.body?.correlation_id };
    },
    expectFn: (ev, exec) => ({ pass: exec.a_cid !== exec.b_cid && /^igr_\d+_[0-9a-f]{6}$/.test(exec.a_cid ?? ""), why: `distinct cids ok` }) },
  // 14) Snapshot before/after exists for a real validation
  { n: 14, name: "Snapshots before+after", kind: "SYNTHETIC-LIVE",
    setup: async () => { await seedLead(14, "Snap Test"); await seedStateFaturaEnviada(14); },
    run: async () => callAgent({ account_id: ACCOUNT_ID, phone: ph(14), tool: "validate_green_invoice", tool_args: { media_url: mockUrl({ classification: "green_invoice", confidence: 0.95, holder: "Snap Test", doc: "66677788899" }), mime_type: "image/jpeg", byte_size: 200_000 } }),
    expectFn: (ev) => {
      const reasons = (ev.snapshots ?? []).map((s:any)=>s.reason);
      return { pass: reasons.includes("before_document_validation") && reasons.includes("after_document_validation"), why: `reasons=${reasons.join(",")}` };
    } },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const cleanup = url.searchParams.get("cleanup") === "1";

  if (cleanup) {
    for (let i = 1; i <= 14; i++) await reset(i);
    return new Response(JSON.stringify({ ok: true, cleaned: 14 }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const sc of SCENARIOS) {
    if (only && only !== String(sc.n)) continue;
    await reset(sc.n);
    if (sc.setup) await sc.setup();
    const t0 = Date.now();
    let exec: any = null, runError: string | null = null;
    try { exec = await sc.run(); } catch (e) { runError = (e as Error).message; }
    const latency_ms = Date.now() - t0;
    // wait briefly for async writes
    await new Promise(r => setTimeout(r, 600));
    const ev = await evidence(sc.n);
    let verdict = { pass: false, why: "no_exec" };
    try { verdict = sc.expectFn(ev, exec); } catch (e) { verdict = { pass: false, why: `expect_threw:${(e as Error).message}` }; }
    const cidsAll = [
      ...(ev.traces ?? []).map((x:any)=>x.correlation_id),
      ...(ev.events ?? []).map((x:any)=>x.correlation_id),
      ...(ev.automations ?? []).map((x:any)=>x.correlation_id),
      ...(ev.validations ?? []).map((x:any)=>x.correlation_id),
    ].filter(Boolean);
    const cid_coverage = cidsAll.length === 0 ? 0 : (cidsAll.filter(c => /^igr_\d+_[0-9a-f]{6}$/.test(c)).length / cidsAll.length);
    results.push({
      n: sc.n, name: sc.name, kind: sc.kind,
      status: verdict.pass ? "PASS" : "FAIL", why: verdict.why,
      latency_ms, runError,
      counts: { traces: ev.traces?.length, events: ev.events?.length, snapshots: ev.snapshots?.length, automations: ev.automations?.length, validations: ev.validations?.length, locks: ev.locks?.length },
      cid_coverage,
      state: ev.state,
      validations: ev.validations,
      snapshot_reasons: (ev.snapshots ?? []).map((s:any)=>s.reason),
      automations: ev.automations,
    });
  }

  return new Response(JSON.stringify({ ok: true, results, summary: { total: results.length, pass: results.filter(r=>r.status==="PASS").length, fail: results.filter(r=>r.status==="FAIL").length } }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});