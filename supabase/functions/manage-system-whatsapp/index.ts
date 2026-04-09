import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_INSTANCE_NAME = "theo_ia_system_notifications";
const WEBHOOK_EVENTS = ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"];

function extractBase64(qrCode: string | null | undefined): string | null {
  if (!qrCode) return null;
  if (qrCode.startsWith("data:image")) {
    return qrCode.split(",")[1] || null;
  }
  return qrCode;
}

function normalizeEvolutionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.replace(/\/manager$/i, "");
}

function extractConnectionState(payload: Record<string, any> | null | undefined): string {
  return String(
    payload?.state ?? payload?.status ?? payload?.instance?.state ?? payload?.instance?.status ?? "",
  ).toLowerCase();
}

async function parseJsonSafely(response: Response): Promise<Record<string, any> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    console.log("Evolution API returned non-JSON response:", {
      status: response.status,
      bodyPreview: text.slice(0, 140),
    });
    return null;
  }
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

    const syncWebhook = async () => {
      const webhookResponse = await fetch(`${evolutionUrl}/webhook/set/${SYSTEM_INSTANCE_NAME}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          events: WEBHOOK_EVENTS,
          webhookByEvents: true,
          webhookBase64: true,
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error("Evolution webhook set error:", errorText);
        throw new Error("Erro ao sincronizar webhook da instância do sistema");
      }

      await webhookResponse.text();
    };

    const requestConnectionQr = async (instanceName: string) => {
      const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: evolutionKey },
      });

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        console.error("Evolution connect error:", errorText);
        throw new Error("Erro ao conectar");
      }

      const connectData = await parseJsonSafely(connectResponse);
      const qrCodeRaw = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qrcode || null;
      return extractBase64(qrCodeRaw);
    };

    if (action === "connect") {
      let instanceExists = false;

      try {
        const checkResponse = await fetch(`${evolutionUrl}/instance/connectionState/${SYSTEM_INSTANCE_NAME}`, {
          headers: { apikey: evolutionKey },
        });

        const stateData = checkResponse.ok ? await parseJsonSafely(checkResponse) : null;

        if (stateData) {
          instanceExists = true;
          await syncWebhook();

          if (["open", "connected"].includes(extractConnectionState(stateData))) {
            await upsertSystemInstance(supabase, {
              instance_name: SYSTEM_INSTANCE_NAME,
              status: "connected",
              qr_code_base64: null,
            });

            return new Response(JSON.stringify({ success: true, status: "connected" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.log("Instance check failed:", e);
      }

      if (!instanceExists) {
        const createResponse = await fetch(`${evolutionUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
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
          const errorText = await createResponse.text();
          console.error("Evolution create error:", errorText);
          return new Response(JSON.stringify({ error: "Erro ao criar instância" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const createData = await parseJsonSafely(createResponse);
        await syncWebhook();

        const qrCodeRaw = createData?.qrcode?.base64 || createData?.base64 || createData?.qrcode || null;
        const qrCodeBase64 = extractBase64(qrCodeRaw);

        await upsertSystemInstance(supabase, {
          instance_name: SYSTEM_INSTANCE_NAME,
          status: qrCodeBase64 ? "qr_ready" : "pending",
          qr_code_base64: qrCodeBase64,
        });

        return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64, status: qrCodeBase64 ? "qr_ready" : "pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await syncWebhook();
      const qrCodeBase64 = await requestConnectionQr(SYSTEM_INSTANCE_NAME);

      await upsertSystemInstance(supabase, {
        instance_name: SYSTEM_INSTANCE_NAME,
        status: "qr_ready",
        qr_code_base64: qrCodeBase64,
      });

      return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64, status: "qr_ready" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_webhook") {
      await syncWebhook();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      const { data: sysInstance } = await supabase
        .from("system_whatsapp_instance")
        .select("id, instance_name")
        .limit(1)
        .maybeSingle();

      if (!sysInstance) {
        return new Response(JSON.stringify({ error: "Nenhuma instância encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await fetch(`${evolutionUrl}/instance/logout/${sysInstance.instance_name}`, {
        method: "DELETE",
        headers: { apikey: evolutionKey },
      });

      await supabase
        .from("system_whatsapp_instance")
        .update({
          status: "disconnected",
          qr_code_base64: null,
          phone_number: null,
          profile_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sysInstance.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_qr") {
      const { data: sysInstance } = await supabase
        .from("system_whatsapp_instance")
        .select("id, instance_name")
        .limit(1)
        .maybeSingle();

      if (!sysInstance) {
        return new Response(JSON.stringify({ error: "Nenhuma instância encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await syncWebhook();
      const qrCodeBase64 = await requestConnectionQr(sysInstance.instance_name);

      await supabase
        .from("system_whatsapp_instance")
        .update({
          qr_code_base64: qrCodeBase64,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sysInstance.id);

      return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});