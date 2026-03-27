import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  const connectUrl = phoneNumber
    ? `${evolutionUrl}/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
    : `${evolutionUrl}/instance/connect/${instanceName}`;

  console.log("Connecting with URL:", connectUrl, "phoneNumber:", phoneNumber);

  const connectResponse = await fetch(connectUrl, {
    headers: { apikey: evolutionKey },
  });

  if (!connectResponse.ok) {
    const errorText = await connectResponse.text();
    console.error("Evolution API connect error:", errorText);
    throw new Error("Erro ao conectar instância");
  }

  const connectData = await connectResponse.json();
  console.log("Evolution API connect response keys:", Object.keys(connectData));
  console.log("pairingCode:", connectData.pairingCode);
  console.log("code:", connectData.code);

  const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;

  return {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = claimsData.user.id;
    const userEmail = claimsData.user.email || "";

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Erro de configuração do servidor" }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const instanceName = userEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_") + "_" + userId.slice(0, 8);

    // Check if instance exists
    let instanceExists = false;
    try {
      const checkResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: evolutionKey },
      });
      if (checkResponse.ok) {
        const state = await checkResponse.json();
        instanceExists = true;
        
        if (state.state === "open") {
          await supabase.from("whatsapp_instances").upsert({
            user_id: userId, instance_name: instanceName,
            status: "connected", qr_code_base64: null, pairing_code: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          return new Response(JSON.stringify({ 
            success: true, message: "WhatsApp já está conectado", status: "connected"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // If phoneNumber provided and instance exists but not connected,
        // we need to delete and recreate with number for pairing code to work
        if (phoneNumber) {
          console.log("Phone number provided, deleting existing instance to recreate with number");
          try {
            await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
              method: "DELETE",
              headers: { apikey: evolutionKey },
            });
            await new Promise(r => setTimeout(r, 2000));
            instanceExists = false;
          } catch (e) {
            console.log("Delete failed, will try connect anyway:", e);
          }
        }
      } else {
        await checkResponse.text();
      }
    } catch (e) {
      console.log("Instance check failed, will create new:", e);
    }

    // Create instance if it doesn't exist
    if (!instanceExists) {
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      console.log("Creating instance:", instanceName, "with number:", phoneNumber);
      const createResponse = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
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
        const errorText = await createResponse.text();
        console.error("Evolution API create error:", errorText);
        return new Response(JSON.stringify({ error: "Erro ao criar instância WhatsApp" }), { 
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const createData = await createResponse.json();
      console.log("Create response keys:", Object.keys(createData));
      console.log("qrcode keys:", createData.qrcode ? Object.keys(createData.qrcode) : "no qrcode");
      console.log("qrcode.pairingCode:", createData.qrcode?.pairingCode);
      const qrCodeRaw = createData.qrcode?.base64 || createData.base64 || createData.qrcode || null;
      const qrCodeBase64 = extractBase64(qrCodeRaw);
      let pairingCode = extractPairingCode(createData);
      let resolvedQrCodeBase64 = qrCodeBase64;

      if (phoneNumber && !pairingCode) {
        const connectionData = await connectInstance(evolutionUrl, evolutionKey, instanceName, phoneNumber);
        pairingCode = connectionData.pairingCode;
        resolvedQrCodeBase64 = connectionData.qrCodeBase64 || resolvedQrCodeBase64;
      }

      await supabase.from("whatsapp_instances").upsert({
        user_id: userId, instance_name: instanceName,
        status: resolvedQrCodeBase64 || pairingCode ? "qr_ready" : "pending",
        qr_code_base64: resolvedQrCodeBase64, pairing_code: pairingCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ 
        success: !phoneNumber || !!pairingCode,
        qrCode: resolvedQrCodeBase64,
        pairingCode,
        status: resolvedQrCodeBase64 || pairingCode ? "qr_ready" : "pending",
        message: phoneNumber && !pairingCode
          ? "Sua Evolution API não retornou um pairing code válido. Use QR Code ou revise a configuração da Evolution API."
          : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Instance exists but not connected — get QR/pairing code
    const { qrCodeBase64, pairingCode } = await connectInstance(evolutionUrl, evolutionKey, instanceName, phoneNumber);

    await supabase.from("whatsapp_instances").upsert({
      user_id: userId, instance_name: instanceName,
      status: "qr_ready", qr_code_base64: qrCodeBase64, pairing_code: pairingCode,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ 
      success: !phoneNumber || !!pairingCode,
      qrCode: qrCodeBase64,
      pairingCode,
      status: "qr_ready",
      message: phoneNumber && !pairingCode
        ? "Sua Evolution API não retornou um pairing code válido. Use QR Code ou revise a configuração da Evolution API."
        : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
