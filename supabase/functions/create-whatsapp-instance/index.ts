import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEvolutionErrorPayload, evolutionRequest, normalizeEvolutionUrl } from "../_evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Insere ou atualiza a linha da instância. Retorna a row final.
async function persistInstance(client: any, existingRow: any | null, fields: Record<string, any>) {
  const payload = { ...fields, updated_at: new Date().toISOString() };
  if (existingRow?.id) {
    const { data, error } = await client
      .from("whatsapp_instances")
      .update(payload)
      .eq("id", existingRow.id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("persistInstance update error:", error);
      return existingRow;
    }
    return data;
  }
  // Para nova linha, garantimos is_primary se for "principal"
  const insertPayload = {
    ...payload,
    is_primary: payload.department_slug === "principal",
  };
  const { data, error } = await client
    .from("whatsapp_instances")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("persistInstance insert error:", error);
    throw new Error(error.message || "Erro ao salvar instância");
  }
  return data;
}

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

    // Parse optional body: phoneNumber, departmentName, instanceId
    let phoneNumber: string | null = null;
    let departmentName: string | null = null;
    let bodyInstanceId: string | null = null;
    try {
      const body = await req.json();
      phoneNumber = body?.phoneNumber || null;
      departmentName = body?.departmentName || null;
      bodyInstanceId = body?.instanceId || null;
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
      .select("id, business_code")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const accountId = ownedAccount?.id ?? null;
    const businessCode = ownedAccount?.business_code ?? null;

    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    // Helper para slug
    const slugify = (s: string) =>
      (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 20);

    // Resolve qual instância estamos operando.
    // 1) Se instanceId no body, busca a linha (deve ser do account do usuário)
    // 2) Senão, se departmentName, cria nova OU reutiliza por slug
    // 3) Senão, comportamento legado: instância principal do account
    let row: any = null;
    let isNewRow = false;
    let departmentSlug = "principal";
    let displayName = "Principal";

    if (bodyInstanceId) {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", bodyInstanceId)
        .maybeSingle();
      if (!data || (accountId && data.account_id !== accountId)) {
        return jsonResponse({ error: "Instância não encontrada" }, 404);
      }
      row = data;
      departmentSlug = data.department_slug || "principal";
      displayName = data.display_name || "Principal";
    } else if (departmentName) {
      departmentSlug = slugify(departmentName) || "departamento";
      displayName = departmentName.trim();
      // tenta achar existente por slug no account
      if (accountId) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("account_id", accountId)
          .eq("department_slug", departmentSlug)
          .maybeSingle();
        row = data || null;
      }
    } else {
      // Legado: principal do account (ou do user)
      let q = supabase.from("whatsapp_instances").select("*");
      if (accountId) q = q.eq("account_id", accountId).eq("is_primary", true);
      else q = q.eq("user_id", userId);
      const { data } = await q.maybeSingle();
      row = data || null;
      if (row) {
        departmentSlug = row.department_slug || "principal";
        displayName = row.display_name || "Principal";
      }
    }

    let instanceName = row?.instance_name || "";
    if (!instanceName) {
      // Novo nome técnico padrão: biz<code>_<slug>. Fallback: legado.
      if (businessCode != null) {
        instanceName = `biz${businessCode}_${departmentSlug}`;
      } else {
        const { data: profileRow } = await supabase
          .from("profiles").select("user_code").eq("user_id", userId).maybeSingle();
        instanceName = profileRow?.user_code ? `user_${profileRow.user_code}_${departmentSlug}` : `${userId}_${departmentSlug}`;
      }
      isNewRow = true;
    }

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
          await persistInstance(supabase, row, {
            user_id: userId, account_id: accountId, instance_name: instanceName,
            display_name: displayName, department_slug: departmentSlug,
            status: "connected", qr_code_base64: null, pairing_code: null,
          });
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
            url: webhookUrl, byEvents: false, base64: true,
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

      const persisted = await persistInstance(supabase, row, {
        user_id: userId, account_id: accountId, instance_name: instanceName,
        display_name: displayName, department_slug: departmentSlug,
        status: resolvedQrCodeBase64 || pairingCode ? "qr_ready" : "pending",
        qr_code_base64: resolvedQrCodeBase64, pairing_code: pairingCode,
      });

      return jsonResponse({ 
        success: !phoneNumber || !!pairingCode,
        qrCode: resolvedQrCodeBase64,
        pairingCode,
        instanceId: persisted?.id,
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

    const persisted2 = await persistInstance(supabase, row, {
      user_id: userId, account_id: accountId, instance_name: instanceName,
      display_name: displayName, department_slug: departmentSlug,
      status: "qr_ready", qr_code_base64: qrCodeBase64, pairing_code: pairingCode,
    });

    return jsonResponse({ 
      success: !phoneNumber || !!pairingCode,
      qrCode: qrCodeBase64,
      pairingCode,
      instanceId: persisted2?.id,
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
