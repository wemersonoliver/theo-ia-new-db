import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "")!;
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, instanceName, phoneNumber } = await req.json();
    const results: Record<string, unknown>[] = [];

    if (action === "delete_and_recreate") {
      // Step 1: Delete instance from Evolution API
      console.log("Step 1: Deleting instance", instanceName);
      try {
        const delResp = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: evolutionKey },
        });
        const delText = await delResp.text();
        results.push({ step: "delete", status: delResp.status, body: delText });
        console.log("Delete response:", delResp.status, delText);
      } catch (e) {
        results.push({ step: "delete", error: String(e) });
      }

      // Step 2: Delete from DB
      console.log("Step 2: Deleting from DB");
      const { error: dbErr } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("instance_name", instanceName);
      results.push({ step: "db_delete", error: dbErr?.message || null });

      // Step 3: Create instance WITH number
      console.log("Step 3: Creating instance with number:", phoneNumber);
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      const createResp = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          number: phoneNumber || undefined,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            byEvents: true,
            base64: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
          settings: { syncFullHistory: true, rejectCall: false, groupsIgnore: true },
        }),
      });
      const createData = await createResp.json();
      console.log("Create response:", JSON.stringify(createData).slice(0, 500));
      results.push({
        step: "create",
        status: createResp.status,
        keys: Object.keys(createData),
        pairingCode: createData.pairingCode || null,
        hasQrcode: !!createData.qrcode,
        qrcodeKeys: createData.qrcode ? Object.keys(createData.qrcode) : null,
        qrcodePairingCode: createData.qrcode?.pairingCode || null,
      });

      // Step 4: Wait 2 seconds then try connect with number
      await new Promise(r => setTimeout(r, 2000));
      console.log("Step 4: Connecting with number:", phoneNumber);
      const connectResp = await fetch(
        `${evolutionUrl}/instance/connect/${instanceName}?number=${phoneNumber}`,
        { headers: { apikey: evolutionKey } }
      );
      const connectData = await connectResp.json();
      console.log("Connect response:", JSON.stringify(connectData).slice(0, 500));
      results.push({
        step: "connect_with_number",
        status: connectResp.status,
        keys: Object.keys(connectData),
        pairingCode: connectData.pairingCode || null,
        code: typeof connectData.code === "string" ? connectData.code.slice(0, 50) : connectData.code,
        hasBase64: !!connectData.base64,
        count: connectData.count,
      });

      // Step 5: Also try connect WITHOUT number for comparison
      await new Promise(r => setTimeout(r, 1000));
      console.log("Step 5: Connecting WITHOUT number");
      const connectResp2 = await fetch(
        `${evolutionUrl}/instance/connect/${instanceName}`,
        { headers: { apikey: evolutionKey } }
      );
      const connectData2 = await connectResp2.json();
      console.log("Connect (no number) response:", JSON.stringify(connectData2).slice(0, 500));
      results.push({
        step: "connect_without_number",
        status: connectResp2.status,
        keys: Object.keys(connectData2),
        pairingCode: connectData2.pairingCode || null,
        hasBase64: !!connectData2.base64,
        count: connectData2.count,
      });

      // Save to DB
      const pairingCode = connectData.pairingCode || connectData2.pairingCode || null;
      const qrBase64Raw = connectData.base64 || connectData2.base64 || null;
      let qrBase64 = qrBase64Raw;
      if (qrBase64 && qrBase64.startsWith("data:image")) {
        qrBase64 = qrBase64.split(",")[1] || null;
      }

      await supabase.from("whatsapp_instances").upsert({
        user_id: "c7dac31d-2b13-41d6-a336-c2dac28568cd",
        instance_name: instanceName,
        status: qrBase64 || pairingCode ? "qr_ready" : "pending",
        qr_code_base64: qrBase64,
        pairing_code: pairingCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    if (action === "check_version") {
      // Check Evolution API version
      try {
        const vResp = await fetch(`${evolutionUrl}`, {
          headers: { apikey: evolutionKey },
        });
        const vData = await vResp.text();
        results.push({ step: "version_check", status: vResp.status, body: vData.slice(0, 500) });
      } catch (e) {
        results.push({ step: "version_check", error: String(e) });
      }

      // List instances
      try {
        const lResp = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
          headers: { apikey: evolutionKey },
        });
        const lData = await lResp.json();
        const summary = Array.isArray(lData) 
          ? lData.map((i: any) => ({ name: i.instance?.instanceName || i.instanceName, state: i.instance?.state || i.state }))
          : lData;
        results.push({ step: "list_instances", count: Array.isArray(lData) ? lData.length : "?", summary });
      } catch (e) {
        results.push({ step: "list_instances", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});