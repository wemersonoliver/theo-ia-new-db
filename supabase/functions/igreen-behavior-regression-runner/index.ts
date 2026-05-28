// Igreen Behavior Regression Runner
// Executa a suíte de cenários comportamentais do Green specialist.
// - default: modo mock (rápido, sem custo, determinístico)
// - { mode: "live" }: usa Gemini real via runGreen (mais lento, requer GOOGLE_GEMINI_API_KEY)
// Acesso restrito a super_admin (auth via getClaims).

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { runScenario } from "../_igreen_v2/testing/conversation-runner.ts";
import { SCENARIOS } from "../_igreen_v2/testing/scenarios/index.ts";
import { renderMarkdown, type ScenarioReport } from "../_igreen_v2/testing/report.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPORT_PATH = "/mnt/documents/igreen_behavioral_validation_report.md";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: super_admin obrigatório
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub;

    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "super_admin");
    if (!isAdmin) return json({ error: "Forbidden — super_admin required" }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body = mock */ }
    const mode = body?.mode === "live" ? "live" : "mock";
    const onlyIds: string[] | null = Array.isArray(body?.scenarios) ? body.scenarios : null;

    const scenarios = onlyIds ? SCENARIOS.filter((s) => onlyIds.includes(s.id)) : SCENARIOS;
    const reports: ScenarioReport[] = [];

    for (const sc of scenarios) {
      try {
        const turns = await runScenario(sc.steps, {
          account_id: body?.account_id, phone: body?.phone,
          initialState: sc.initialState,
          mockGreen: mode === "mock",
        });
        const results = sc.run(turns);
        const pass = results.every((r) => r.ok);
        reports.push({ id: sc.id, title: sc.title, pass, results, turns });
      } catch (e) {
        reports.push({
          id: sc.id, title: sc.title, pass: false,
          results: [{ name: "runner_exception", ok: false, reason: (e as Error).message }],
          turns: [],
        });
      }
    }

    const md = renderMarkdown(reports, { mode });
    try {
      await Deno.mkdir("/mnt/documents", { recursive: true });
      await Deno.writeTextFile(REPORT_PATH, md);
    } catch (e) {
      console.warn("[regression-runner] could not write report file", (e as Error).message);
    }

    const pass = reports.filter((r) => r.pass).length;
    const fail = reports.length - pass;
    return json({
      mode, total: reports.length, pass, fail,
      report_path: REPORT_PATH,
      results: reports.map((r) => ({
        id: r.id, title: r.title, pass: r.pass,
        failures: r.results.filter((x) => !x.ok),
      })),
      markdown: md,
    }, 200);
  } catch (e) {
    console.error("[regression-runner] fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}