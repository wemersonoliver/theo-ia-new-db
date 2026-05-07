import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function extractBusiness(
  companyName: string,
  segment: string,
  messages: Array<{ role: string; content: string }>,
  generatedPrompt: string | null,
) {
  let businessName = (companyName || "").trim() || null;
  let businessSegment = (segment || "").trim() || null;
  let businessSummary: string | null = null;
  if (!GEMINI_API_KEY) return { businessName, businessSegment, businessSummary };

  const transcript = (messages || [])
    .slice(-30)
    .map((m) => `${m.role === "assistant" ? "IA" : "Cliente"}: ${m.content}`)
    .join("\n")
    .slice(0, 12000);

  const tool = {
    function_declarations: [{
      name: "registrar_negocio",
      description: "Registra dados estruturados do negócio do cliente",
      parameters: {
        type: "object",
        properties: {
          business_name: { type: "string" },
          segment: { type: "string" },
          summary: { type: "string", description: "Resumo de 2-4 frases focando dor e proposta de valor." },
        },
        required: ["business_name", "segment", "summary"],
      },
    }],
  };
  const prompt = `Extraia dados do negócio com base na entrevista abaixo.\n\nDados informados:\n- Empresa: ${companyName}\n- Segmento: ${segment}\n\nTrecho da entrevista:\n${transcript}\n\n${generatedPrompt ? `Prompt gerado (referência):\n${generatedPrompt.slice(0, 4000)}\n` : ""}\nGere o resumo em português brasileiro, conciso, focado em DOR e PROPOSTA DE VALOR (para uso em follow-up de vendas).`;

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [tool],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["registrar_negocio"] } },
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const fnCall = parts.find((p: any) => p.functionCall)?.functionCall;
      const args = fnCall?.args || {};
      if (args.business_name) businessName = String(args.business_name).trim();
      if (args.segment) businessSegment = String(args.segment).trim();
      if (args.summary) businessSummary = String(args.summary).trim().slice(0, 2000);
    } else {
      console.error("Gemini failed", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("Gemini error", e);
  }
  return { businessName, businessSegment, businessSummary };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: require super_admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const overwrite: boolean = !!body?.overwrite;
    const limit: number = Math.min(Number(body?.limit) || 100, 200);

    // Find completed interviews
    const { data: interviews, error: ie } = await admin
      .from("entrevistas_config")
      .select("user_id, company_name, segment, messages, generated_prompt, updated_at")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (ie) throw ie;

    const userIds = [...new Set((interviews || []).map((i) => i.user_id))];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0, updated: 0, skipped: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: deals } = await admin
      .from("admin_crm_deals")
      .select("id, user_ref_id, business_name, business_summary")
      .in("user_ref_id", userIds);
    const dealsByUser = new Map<string, any>();
    (deals || []).forEach((d) => { if (d.user_ref_id) dealsByUser.set(d.user_ref_id, d); });

    let processed = 0, updated = 0, skipped = 0, missing = 0;
    const errors: any[] = [];

    for (const itv of interviews || []) {
      processed++;
      const deal = dealsByUser.get(itv.user_id);
      if (!deal) { missing++; continue; }
      if (!overwrite && deal.business_name && deal.business_summary) { skipped++; continue; }

      const messages = Array.isArray(itv.messages) ? itv.messages as any[] : [];
      const { businessName, businessSegment, businessSummary } = await extractBusiness(
        itv.company_name || "",
        itv.segment || "",
        messages,
        itv.generated_prompt,
      );

      const { error: ue } = await admin
        .from("admin_crm_deals")
        .update({
          business_name: businessName,
          business_segment: businessSegment,
          business_summary: businessSummary,
          business_data_updated_at: new Date().toISOString(),
        })
        .eq("id", deal.id);
      if (ue) { errors.push({ user: itv.user_id, error: ue.message }); continue; }

      await admin.from("admin_crm_activities").insert({
        deal_id: deal.id,
        type: "business_update",
        content: "Dados do negócio preenchidos via backfill da entrevista",
        metadata: { source: "backfill" },
        created_by: userId,
      });
      updated++;
    }

    return new Response(JSON.stringify({ processed, updated, skipped, missing, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});