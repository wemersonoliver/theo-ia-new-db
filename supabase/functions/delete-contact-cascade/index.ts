import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tabelas scoped por (account_id, <phoneCol>)
const PHONE_TABLES: Array<{ table: string; phoneCol: string }> = [
  { table: "whatsapp_conversations", phoneCol: "phone" },
  { table: "whatsapp_ai_sessions", phoneCol: "phone" },
  { table: "whatsapp_pending_responses", phoneCol: "phone" },
  { table: "attendance_flow_runs", phoneCol: "phone" },
  { table: "igreen_lead_data", phoneCol: "phone" },
  { table: "igreen_product_video_followups", phoneCol: "phone" },
  { table: "igreen_scenario_enrollments", phoneCol: "contact_phone" },
  { table: "custom_followup_enrollments", phoneCol: "phone" },
  { table: "custom_followup_events", phoneCol: "phone" },
  { table: "custom_followup_queue", phoneCol: "phone" },
  { table: "followup_tracking", phoneCol: "phone" },
  { table: "roulette_assignments", phoneCol: "phone" },
  { table: "appointments", phoneCol: "phone" },
  { table: "ai_voice_usage", phoneCol: "phone" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "missing token" }, 401);

    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const contactId: string | undefined = body.contact_id;
    if (!contactId) return json({ error: "contact_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: contact, error: cErr } = await admin
      .from("contacts")
      .select("id, account_id, phone")
      .eq("id", contactId)
      .maybeSingle();
    if (cErr || !contact) return json({ error: "contact not found" }, 404);

    // Verifica membership do usuário na account
    const { data: membership } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", contact.account_id)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    const accountId = contact.account_id;
    const phone = contact.phone;
    const results: Record<string, number | string> = {};

    // Apaga deals do CRM ligados ao contato (cascateia activities/products via FK)
    const { error: dealsErr, count: dealsCount } = await admin
      .from("crm_deals")
      .delete({ count: "exact" })
      .eq("contact_id", contactId);
    results["crm_deals"] = dealsErr ? `err: ${dealsErr.message}` : (dealsCount ?? 0);

    // Tabelas por phone + account
    for (const { table, phoneCol } of PHONE_TABLES) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: "exact" })
        .eq("account_id", accountId)
        .eq(phoneCol, phone);
      results[table] = error ? `err: ${error.message}` : (count ?? 0);
    }

    // Finalmente apaga o contato
    const { error: delErr } = await admin.from("contacts").delete().eq("id", contactId);
    if (delErr) return json({ error: delErr.message, partial: results }, 500);

    return json({ success: true, deleted: results });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}