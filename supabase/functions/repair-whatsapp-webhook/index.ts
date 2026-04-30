import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"];

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeInstanceState(payload: Record<string, any> | null | undefined) {
  return String(payload?.state ?? payload?.status ?? payload?.instance?.state ?? payload?.instance?.status ?? "unknown").toLowerCase();
}

async function requireSuperAdmin(authHeader: string, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) return null;

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub)
    .eq("role", "super_admin")
    .maybeSingle();

  return roleData ? adminClient : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return jsonResponse({ error: "Evolution API não configurada" }, 500);
    }

    const supabase = await requireSuperAdmin(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!supabase) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const userCode = Number(body?.userCode);
    const requestedUserId = typeof body?.userId === "string" ? body.userId : null;

    if (!userCode && !requestedUserId) {
      return jsonResponse({ error: "Informe userCode ou userId" }, 400);
    }

    let targetUserId = requestedUserId;
    if (!targetUserId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_code", userCode)
        .maybeSingle();

      if (profileError) throw profileError;
      targetUserId = profile?.user_id ?? null;
    }

    if (!targetUserId) {
      return jsonResponse({ error: "Usuário não encontrado" }, 404);
    }

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, user_id, instance_name, status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (instanceError) throw instanceError;
    if (!instance?.instance_name) {
      return jsonResponse({ error: "Instância WhatsApp não encontrada" }, 404);
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    const webhookPayload = {
      enabled: true,
      url: webhookUrl,
      events: WEBHOOK_EVENTS,
      webhookByEvents: false,
      webhookBase64: true,
      byEvents: false,
      base64: true,
    };

    let webhookResponse = await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: `/webhook/set/${instance.instance_name}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok && webhookResponse.status === 400) {
      webhookResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/webhook/set/${instance.instance_name}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook: webhookPayload }),
      });
    }

    if (!webhookResponse.ok && webhookResponse.status === 400) {
      webhookResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/update/${instance.instance_name}`,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook: webhookPayload }),
      });
    }

    if (!webhookResponse.ok) {
      return jsonResponse(buildEvolutionErrorPayload(webhookResponse, "Erro ao reparar webhook"), 502);
    }

    const stateResponse = await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: `/instance/connectionState/${instance.instance_name}`,
    });

    const connectionState = stateResponse.ok ? normalizeInstanceState(stateResponse.data) : "unknown";
    const status = ["open", "connected"].includes(connectionState) ? "connected" : instance.status;

    await supabase
      .from("whatsapp_instances")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", instance.id);

    return jsonResponse({
      success: true,
      userId: targetUserId,
      instanceName: instance.instance_name,
      status,
      connectionState,
      webhookByEvents: false,
      events: WEBHOOK_EVENTS,
    });
  } catch (error) {
    console.error("repair-whatsapp-webhook error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
