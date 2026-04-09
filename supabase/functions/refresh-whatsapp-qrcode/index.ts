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

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      return jsonResponse({ error: "Nenhuma instância encontrada" }, 404);
    }

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    // If phoneNumber provided for pairing code, we need to delete and recreate
    // the instance with number for Evolution API to return a valid pairingCode
    if (phoneNumber) {
      console.log("Phone number provided, deleting and recreating instance for pairing code");
      
      // Delete existing instance
      try {
        await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: `/instance/delete/${instance.instance_name}`,
          method: "DELETE",
        });
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.log("Delete failed:", e);
      }

      // Recreate with number
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      const createResp = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: "/instance/create",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instance.instance_name,
          qrcode: true,
          number: phoneNumber,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl, byEvents: true, base64: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
          settings: { syncFullHistory: true, rejectCall: false, groupsIgnore: true },
        }),
      });

      if (createResp.ok) {
        const createData = createResp.data ?? {};
        console.log("Recreate response keys:", Object.keys(createData));
        console.log("qrcode.pairingCode:", createData.qrcode?.pairingCode);

        const qrCodeRaw = createData.qrcode?.base64 || createData.base64 || null;
        const qrCodeBase64 = extractBase64(qrCodeRaw);
        const pairingCode = extractPairingCode(createData);

        await supabase.from("whatsapp_instances").update({
          status: "qr_ready",
          qr_code_base64: qrCodeBase64,
          pairing_code: pairingCode,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        return jsonResponse({
          success: !!pairingCode,
          qrCode: qrCodeBase64,
          pairingCode,
          message: !pairingCode
            ? "Não foi possível gerar código de pareamento. Tente QR Code."
            : undefined,
        });
      } else {
        console.error("Recreate failed:", createResp);
        return jsonResponse(buildEvolutionErrorPayload(createResp, "Erro ao recriar instância para gerar código de pareamento"), 502);
      }
    }

    // Check real connection state
    let evolutionState: string | null = null;
    try {
      const stateResponse = await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/connectionState/${instance.instance_name}`,
      });
      if (stateResponse.ok) {
        const stateData = stateResponse.data ?? {};
        evolutionState = String(
          stateData?.state ?? stateData?.status ?? stateData?.instance?.state ?? stateData?.instance?.status ?? ""
        ).toLowerCase();
      } else if (stateResponse.status !== 404) {
        return jsonResponse(buildEvolutionErrorPayload(stateResponse, "Erro ao consultar estado da instância"), 502);
      }
    } catch (e) {
      console.log("connectionState check failed:", e);
    }

    if (evolutionState === "open" || evolutionState === "connected") {
      await supabase.from("whatsapp_instances").update({
        status: "connected", qr_code_base64: null, pairing_code: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      return jsonResponse({
        success: true, connected: true, message: "WhatsApp já está conectado"
      });
    }

    if (instance.status === "connected") {
      return jsonResponse({
        success: true, connected: true, message: "WhatsApp já está conectado"
      });
    }

    // Get new QR code / pairing code
    const connectUrl = phoneNumber
      ? `${evolutionUrl}/instance/connect/${instance.instance_name}?number=${phoneNumber}`
      : `${evolutionUrl}/instance/connect/${instance.instance_name}`;

    console.log("Connecting with URL:", connectUrl, "phoneNumber:", phoneNumber);

    const connectResponse = await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: connectUrl.replace(evolutionUrl, ""),
    });

    if (!connectResponse.ok) {
      console.error("Evolution API error:", connectResponse);
      return jsonResponse(buildEvolutionErrorPayload(connectResponse, "Erro ao obter QR Code"), 502);
    }

    const connectData = connectResponse.data ?? {};
    console.log("Evolution API response keys:", Object.keys(connectData));
    console.log("pairingCode:", connectData.pairingCode);
    console.log("code:", connectData.code);
    
    const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;
    const qrCodeBase64 = extractBase64(qrCodeRaw);
    const pairingCode = extractPairingCode(connectData);

    if (!qrCodeBase64 && !pairingCode) {
      return jsonResponse({
        success: false, message: "QR Code indisponível no momento"
      }, 202);
    }

    await supabase.from("whatsapp_instances").update({
      status: "qr_ready", qr_code_base64: qrCodeBase64, pairing_code: pairingCode,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    return jsonResponse({ 
      success: !phoneNumber || !!pairingCode,
      qrCode: qrCodeBase64,
      pairingCode,
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
