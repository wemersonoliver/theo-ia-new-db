import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractBase64(qrCode: string | null | undefined): string | null {
  if (!qrCode) return null;
  if (qrCode.startsWith('data:image')) {
    return qrCode.split(',')[1] || null;
  }
  return qrCode;
}

function extractPairingCode(payload: Record<string, any> | null | undefined): string | null {
  const raw = payload?.pairingCode || payload?.qrcode?.pairingCode || payload?.code?.pairingCode || null;
  if (typeof raw !== "string") return null;

  if (raw.includes("@") || raw.includes(",")) {
    return null;
  }

  const normalized = raw.replace(/[^A-Za-z0-9]/g, "").trim().toUpperCase();
  if (normalized.length < 6 || normalized.length > 12) {
    return null;
  }

  return normalized;
}

async function connectInstance(
  evolutionUrl: string,
  evolutionKey: string,
  instanceName: string,
  phoneNumber?: string | null,
) {
  const connectResult = await evolutionRequest({
    evolutionUrl,
    evolutionKey,
    path: phoneNumber
      ? `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
      : `/instance/connect/${instanceName}`,
  });

  if (!connectResult.ok) return connectResult;

  const connectData = connectResult.data ?? {};
  console.log("Evolution API connect response keys:", Object.keys(connectData));
  console.log("pairingCode:", connectData.pairingCode);
  console.log("code:", connectData.code);

  const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;

  return {
    ok: true as const,
    qrCodeBase64: extractBase64(qrCodeRaw),
    pairingCode: extractPairingCode(connectData),
  };
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

    // Parse optional phoneNumber from body
    let phoneNumber: string | null = null;
    try {
      const body = await req.json();
      phoneNumber = body?.phoneNumber || null;
    } catch { /* no body */ }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.user.id;

    // Resolve account_id (owner) so the instance is visible to the frontend
    const { data: ownedAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const accountId = ownedAccount?.id ?? null;

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    // Padrão de nomeação: user_id completo (UUID). Garante unicidade absoluta por usuário.
    const instanceName = userId;

    // Check if instance exists
    let instanceExists = false;
    try {
      const checkResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/connectionState/${instanceName}`,
      });

      if (checkResponse.ok) {
        const state = checkResponse.data ?? {};
        instanceExists = true;
        
        if (state.state === "open") {
          await supabase.from("whatsapp_instances").upsert({
            user_id: userId, account_id: accountId, instance_name: instanceName,
            status: "connected", qr_code_base64: null, pairing_code: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          return jsonResponse({ success: true, message: "WhatsApp já está conectado", status: "connected" });
        }

        // If phoneNumber provided and instance exists but not connected,
        // we need to delete and recreate with number for pairing code to work
        if (phoneNumber) {
          console.log("Phone number provided, deleting existing instance to recreate with number");
          try {
            await evolutionRequest({
              evolutionUrl,
              evolutionKey,
              path: `/instance/delete/${instanceName}`,
              method: "DELETE",
            });
            await new Promise(r => setTimeout(r, 2000));
            instanceExists = false;
          } catch (e) {
            console.log("Delete failed, will try connect anyway:", e);
          }
        }
      } else if (checkResponse.status !== 404) {
        console.error("Evolution API state error:", checkResponse);
        return jsonResponse(
          buildEvolutionErrorPayload(checkResponse, "Erro ao consultar estado da instância"),
          502,
        );
      }
    } catch (e) {
      console.log("Instance check failed, will create new:", e);
    }

    // Create instance if it doesn't exist
    if (!instanceExists) {
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      console.log("Creating instance:", instanceName, "with number:", phoneNumber);
      const createResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: "/instance/create",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS",
          ...(phoneNumber ? { number: phoneNumber } : {}),
          webhook: {
            url: webhookUrl, byEvents: true, base64: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
          settings: { syncFullHistory: true, rejectCall: false, groupsIgnore: true },
        }),
      });

      if (!createResponse.ok) {
        console.error("Evolution API create error:", createResponse);
        return jsonResponse(buildEvolutionErrorPayload(createResponse, "Erro ao criar instância WhatsApp"), 502);
      }

      const createData = createResponse.data ?? {};
      console.log("Create response keys:", Object.keys(createData));
      console.log("qrcode keys:", createData.qrcode ? Object.keys(createData.qrcode) : "no qrcode");
      console.log("qrcode.pairingCode:", createData.qrcode?.pairingCode);
      const qrCodeRaw = createData.qrcode?.base64 || createData.base64 || createData.qrcode || null;
      const qrCodeBase64 = extractBase64(qrCodeRaw);
      let pairingCode = extractPairingCode(createData);
      let resolvedQrCodeBase64 = qrCodeBase64;

      if (phoneNumber && !pairingCode) {
        const connectionData = await connectInstance(evolutionUrl, evolutionKey, instanceName, phoneNumber);
        if (!connectionData.ok) {
          return jsonResponse(buildEvolutionErrorPayload(connectionData, "Erro ao conectar instância WhatsApp"), 502);
        }
        pairingCode = connectionData.pairingCode;
        resolvedQrCodeBase64 = connectionData.qrCodeBase64 || resolvedQrCodeBase64;
      }

      await supabase.from("whatsapp_instances").upsert({
        user_id: userId, account_id: accountId, instance_name: instanceName,
        status: resolvedQrCodeBase64 || pairingCode ? "qr_ready" : "pending",
        qr_code_base64: resolvedQrCodeBase64, pairing_code: pairingCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return jsonResponse({ 
        success: !phoneNumber || !!pairingCode,
        qrCode: resolvedQrCodeBase64,
        pairingCode,
        status: resolvedQrCodeBase64 || pairingCode ? "qr_ready" : "pending",
        message: phoneNumber && !pairingCode
          ? "Sua Evolution API não retornou um pairing code válido. Use QR Code ou revise a configuração da Evolution API."
          : undefined,
      });
    }

    // Instance exists but not connected — get QR/pairing code
    const connectionData = await connectInstance(evolutionUrl, evolutionKey, instanceName, phoneNumber);
    if (!connectionData.ok) {
      return jsonResponse(buildEvolutionErrorPayload(connectionData, "Erro ao conectar instância WhatsApp"), 502);
    }
    const { qrCodeBase64, pairingCode } = connectionData;

    await supabase.from("whatsapp_instances").upsert({
      user_id: userId, account_id: accountId, instance_name: instanceName,
      status: "qr_ready", qr_code_base64: qrCodeBase64, pairing_code: pairingCode,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return jsonResponse({ 
      success: !phoneNumber || !!pairingCode,
      qrCode: qrCodeBase64,
      pairingCode,
      status: "qr_ready",
      message: phoneNumber && !pairingCode
        ? "Sua Evolution API não retornou um pairing code válido. Use QR Code ou revise a configuração da Evolution API."
        : undefined,
    });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
