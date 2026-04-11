import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_INSTANCE_NAME = "theo_ia_system_notifications";
const WEBHOOK_EVENTS = ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"];

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractBase64(qrCode: string | null | undefined): string | null {
  if (!qrCode) return null;
  if (qrCode.startsWith("data:image")) {
    return qrCode.split(",")[1] || null;
  }
  return qrCode;
}

function extractConnectionState(payload: Record<string, any> | null | undefined): string {
  return String(
    payload?.state ?? payload?.status ?? payload?.instance?.state ?? payload?.instance?.status ?? "",
  ).toLowerCase();
}

async function upsertSystemInstance(
  supabase: ReturnType<typeof createClient>,
  updates: Record<string, any>,
) {
  const { data: existing } = await supabase
    .from("system_whatsapp_instance")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("system_whatsapp_instance")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("system_whatsapp_instance").insert(updates);
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { action } = await req.json();
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return jsonResponse({ error: "Evolution API não configurada" }, 500);
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

    const syncWebhook = async () => {
      const webhookResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/webhook/set/${SYSTEM_INSTANCE_NAME}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          events: WEBHOOK_EVENTS,
          webhookByEvents: true,
          webhookBase64: true,
        }),
      });

      if (!webhookResponse.ok) {
        return webhookResponse;
      }

      return null;
    };

    const requestConnectionQr = async (instanceName: string) => {
      const connectResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/connect/${instanceName}`,
      });

      if (!connectResponse.ok) {
        return connectResponse;
      }

      const connectData = connectResponse.data ?? {};
      const qrCodeRaw = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qrcode || null;
      return { ok: true as const, qrCodeBase64: extractBase64(qrCodeRaw) };
    };

    if (action === "connect") {
      let instanceExists = false;

      try {
        const checkResponse = await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: `/instance/connectionState/${SYSTEM_INSTANCE_NAME}`,
        });

        const stateData = checkResponse.ok ? (checkResponse.data ?? {}) : null;

        if (stateData) {
          instanceExists = true;
          const webhookFailure = await syncWebhook();
          if (webhookFailure) {
            return jsonResponse(buildEvolutionErrorPayload(webhookFailure, "Erro ao sincronizar webhook da instância do sistema"), 502);
          }

          if (["open", "connected"].includes(extractConnectionState(stateData))) {
            await upsertSystemInstance(supabase, {
              instance_name: SYSTEM_INSTANCE_NAME,
              status: "connected",
              qr_code_base64: null,
            });

            return jsonResponse({ success: true, status: "connected" });
          }
        } else if (!checkResponse.ok && checkResponse.status !== 404) {
          return jsonResponse(buildEvolutionErrorPayload(checkResponse, "Erro ao consultar estado da instância do sistema"), 502);
        }
      } catch (e) {
        console.log("Instance check failed:", e);
      }

      if (!instanceExists) {
        const createResponse = await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: "/instance/create",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName: SYSTEM_INSTANCE_NAME,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: {
              url: webhookUrl,
              byEvents: true,
              base64: true,
              events: WEBHOOK_EVENTS,
            },
            settings: { syncFullHistory: false, rejectCall: true, groupsIgnore: true },
          }),
        });

        if (!createResponse.ok) {
          console.error("Evolution create error:", createResponse);
          return jsonResponse(buildEvolutionErrorPayload(createResponse, "Erro ao criar instância"), 502);
        }

        const createData = createResponse.data ?? {};
        const webhookFailure = await syncWebhook();
        if (webhookFailure) {
          return jsonResponse(buildEvolutionErrorPayload(webhookFailure, "Erro ao sincronizar webhook da instância do sistema"), 502);
        }

        const qrCodeRaw = createData?.qrcode?.base64 || createData?.base64 || createData?.qrcode || null;
        const qrCodeBase64 = extractBase64(qrCodeRaw);

        await upsertSystemInstance(supabase, {
          instance_name: SYSTEM_INSTANCE_NAME,
          status: qrCodeBase64 ? "qr_ready" : "pending",
          qr_code_base64: qrCodeBase64,
        });

        return jsonResponse({ success: true, qrCode: qrCodeBase64, status: qrCodeBase64 ? "qr_ready" : "pending" });
      }

      const webhookFailure = await syncWebhook();
      if (webhookFailure) {
        return jsonResponse(buildEvolutionErrorPayload(webhookFailure, "Erro ao sincronizar webhook da instância do sistema"), 502);
      }
      const connectionQr = await requestConnectionQr(SYSTEM_INSTANCE_NAME);
      if (!connectionQr.ok) {
        return jsonResponse(buildEvolutionErrorPayload(connectionQr, "Erro ao obter QR Code da instância do sistema"), 502);
      }

      await upsertSystemInstance(supabase, {
        instance_name: SYSTEM_INSTANCE_NAME,
        status: "qr_ready",
        qr_code_base64: connectionQr.qrCodeBase64,
      });

      return jsonResponse({ success: true, qrCode: connectionQr.qrCodeBase64, status: "qr_ready" });
    }

    if (action === "sync_webhook") {
      const webhookFailure = await syncWebhook();
      if (webhookFailure) {
        return jsonResponse(buildEvolutionErrorPayload(webhookFailure, "Erro ao sincronizar webhook da instância do sistema"), 502);
      }
      return jsonResponse({ success: true });
    }

    if (action === "disconnect") {
      const { data: sysInstance } = await supabase
        .from("system_whatsapp_instance")
        .select("id, instance_name")
        .limit(1)
        .maybeSingle();

      if (!sysInstance) {
        return jsonResponse({ error: "Nenhuma instância encontrada" }, 404);
      }

      // Try logout, but also try delete - treat 404 as success (instance doesn't exist on server)
      const logoutResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/logout/${sysInstance.instance_name}`,
        method: "DELETE",
      });

      if (!logoutResponse.ok && logoutResponse.status !== 404) {
        // If logout fails with non-404, try deleting the instance instead
        const deleteResponse = await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: `/instance/delete/${sysInstance.instance_name}`,
          method: "DELETE",
        });

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          return jsonResponse(buildEvolutionErrorPayload(deleteResponse, "Erro ao desconectar instância do sistema"), 502);
        }
      }

      // Always clean up the database record
      await supabase
        .from("system_whatsapp_instance")
        .delete()
        .eq("id", sysInstance.id);

      return jsonResponse({ success: true });
    }

    if (action === "refresh_qr") {
      const { data: sysInstance } = await supabase
        .from("system_whatsapp_instance")
        .select("id, instance_name")
        .limit(1)
        .maybeSingle();

      if (!sysInstance) {
        return jsonResponse({ error: "Nenhuma instância encontrada" }, 404);
      }

      const webhookFailure = await syncWebhook();
      if (webhookFailure) {
        return jsonResponse(buildEvolutionErrorPayload(webhookFailure, "Erro ao sincronizar webhook da instância do sistema"), 502);
      }
      const connectionQr = await requestConnectionQr(sysInstance.instance_name);
      if (!connectionQr.ok) {
        return jsonResponse(buildEvolutionErrorPayload(connectionQr, "Erro ao atualizar QR Code da instância do sistema"), 502);
      }

      await supabase
        .from("system_whatsapp_instance")
        .update({
          qr_code_base64: connectionQr.qrCodeBase64,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sysInstance.id);

      return jsonResponse({ success: true, qrCode: connectionQr.qrCodeBase64 });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});