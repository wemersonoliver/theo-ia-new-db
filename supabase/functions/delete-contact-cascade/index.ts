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
  // Igreen v2 pipeline state (account_id, phone)
  { table: "igreen_conversation_state", phoneCol: "phone" },
  { table: "igreen_conversation_priority", phoneCol: "phone" },
  { table: "igreen_state_events", phoneCol: "phone" },
  { table: "igreen_state_snapshots", phoneCol: "phone" },
  { table: "igreen_traces", phoneCol: "phone" },
  { table: "igreen_transport_events", phoneCol: "phone" },
  { table: "igreen_memory_window", phoneCol: "phone" },
  { table: "igreen_memory_summaries", phoneCol: "phone" },
  { table: "igreen_tool_locks", phoneCol: "phone" },
  { table: "igreen_timeouts", phoneCol: "phone" },
  { table: "igreen_token_usage", phoneCol: "phone" },
  { table: "igreen_model_routing", phoneCol: "phone" },
  { table: "igreen_automation_executions", phoneCol: "phone" },
  { table: "igreen_document_validations", phoneCol: "phone" },
  { table: "igreen_cancellations", phoneCol: "phone" },
  { table: "custom_followup_events", phoneCol: "phone" },
  { table: "custom_followup_queue", phoneCol: "phone" },
  { table: "custom_followup_enrollments", phoneCol: "phone" },
  { table: "followup_tracking", phoneCol: "phone" },
  { table: "roulette_assignments", phoneCol: "phone" },
  { table: "appointments", phoneCol: "phone" },
  { table: "ai_voice_usage", phoneCol: "phone" },
];

const GREEN_FLOW_TAGS = ["em atendimento", "enviou fatura", "enviou documento", "sem-interesse"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "missing token" }, 401);

    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    let userId: string | null = null;
    try {
      const { data: claimsData } = await authClient.auth.getClaims(token);
      userId = (claimsData?.claims as any)?.sub ?? null;
    } catch (_) { /* fallback below */ }
    if (!userId) {
      const { data: userData } = await authClient.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }
    if (!userId) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const contactId: string | undefined = body.contact_id;
    const phoneFromBody: string | undefined = body.phone;
    const accountIdFromBody: string | undefined = body.account_id;
    const deleteContact = body.delete_contact !== false;
    if (!contactId && (!phoneFromBody || !accountIdFromBody)) {
      return json({ error: "contact_id ou phone+account_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let contact: any = null;
    if (contactId) {
      const { data, error: cErr } = await admin
        .from("contacts")
        .select("id, account_id, phone")
        .eq("id", contactId)
        .maybeSingle();
      if (cErr || !data) return json({ error: "contact not found" }, 404);
      contact = data;
    } else {
      contact = { id: null, account_id: accountIdFromBody, phone: phoneFromBody };
    }

    // Verifica membership do usuário na account
    const { data: membership } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", contact.account_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    const accountId = contact.account_id;
    const phone = contact.phone;
    const results: Record<string, number | string> = {};

    const { data: contactsForPhone } = await admin
      .from("contacts")
      .select("id, tags")
      .eq("account_id", accountId)
      .eq("phone", phone);
    const contactIds = (contactsForPhone || []).map((c: any) => c.id).filter(Boolean);

    const { data: dealsForPhone } = contactIds.length
      ? await admin.from("crm_deals").select("id").eq("account_id", accountId).in("contact_id", contactIds)
      : { data: [] as any[] };
    const dealIds = (dealsForPhone || []).map((d: any) => d.id).filter(Boolean);

    if (dealIds.length) {
      const childTables = ["crm_activities", "crm_deal_products", "crm_deal_tasks"];
      for (const table of childTables) {
        const { error, count } = await admin.from(table).delete({ count: "exact" }).in("deal_id", dealIds);
        results[table] = error ? `err: ${error.message}` : (count ?? 0);
      }
    }

    // Apaga deals do CRM ligados ao telefone dentro da account.
    const dealDeleteQuery = admin.from("crm_deals").delete({ count: "exact" }).eq("account_id", accountId);
    const { error: dealsErr, count: dealsCount } = contactIds.length
      ? await dealDeleteQuery.in("contact_id", contactIds)
      : await dealDeleteQuery.eq("contact_id", "00000000-0000-0000-0000-000000000000");
    results["crm_deals"] = dealsErr ? `err: ${dealsErr.message}` : (dealsCount ?? 0);

    const { data: scenarioEnrollments } = await admin
      .from("igreen_scenario_enrollments")
      .select("id")
      .eq("account_id", accountId)
      .eq("contact_phone", phone);
    const scenarioEnrollmentIds = (scenarioEnrollments || []).map((e: any) => e.id).filter(Boolean);
    if (scenarioEnrollmentIds.length) {
      const { error, count } = await admin.from("igreen_scenario_events").delete({ count: "exact" }).in("enrollment_id", scenarioEnrollmentIds);
      results["igreen_scenario_events"] = error ? `err: ${error.message}` : (count ?? 0);
    }

    const { data: followupTrackings } = await admin
      .from("followup_tracking")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone", phone);
    const followupTrackingIds = (followupTrackings || []).map((t: any) => t.id).filter(Boolean);
    if (followupTrackingIds.length) {
      const { error, count } = await admin.from("followup_messages").delete({ count: "exact" }).in("tracking_id", followupTrackingIds);
      results["followup_messages"] = error ? `err: ${error.message}` : (count ?? 0);
    }

    // Tabelas por phone + account
    for (const { table, phoneCol } of PHONE_TABLES) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: "exact" })
        .eq("account_id", accountId)
        .eq(phoneCol, phone);
      results[table] = error ? `err: ${error.message}` : (count ?? 0);
    }

    if (deleteContact && contactId) {
      const { error: delErr } = await admin.from("contacts").delete().eq("id", contactId);
      if (delErr) return json({ error: delErr.message, partial: results }, 500);
    } else if (contactIds.length) {
      for (const c of contactsForPhone || []) {
        const currentTags = Array.isArray(c.tags) ? c.tags : [];
        const tags = currentTags.filter((tag: string) => !GREEN_FLOW_TAGS.includes(String(tag).toLowerCase()));
        await admin.from("contacts").update({ tags, updated_at: new Date().toISOString() }).eq("id", c.id);
      }
      results["contacts_reset"] = contactIds.length;
    }

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