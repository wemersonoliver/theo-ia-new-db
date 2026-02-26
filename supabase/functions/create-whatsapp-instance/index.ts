import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper to extract pure base64 from QR code (remove data:image prefix if present)
function extractBase64(qrCode: string | null | undefined): string | null {
  if (!qrCode) return null;
  if (qrCode.startsWith('data:image')) {
    return qrCode.split(',')[1] || null;
  }
  return qrCode;
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
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = claimsData.user.id;
    const userEmail = claimsData.user.email || "";

    // Get Evolution API from global secrets
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return new Response(JSON.stringify({ error: "Erro de configuração do servidor" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Generate instance name from user email
    const instanceName = userEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_") + "_" + userId.slice(0, 8);

    // Check if instance exists in Evolution API
    let instanceExists = false;
    try {
      const checkResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: evolutionKey },
      });
      if (checkResponse.ok) {
        const state = await checkResponse.json();
        instanceExists = true;
        
        if (state.state === "open") {
          // Already connected, update database
          const { error: upsertError } = await supabase
            .from("whatsapp_instances")
            .upsert({
              user_id: userId,
              instance_name: instanceName,
              status: "connected",
              qr_code_base64: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          if (upsertError) {
            console.error("Upsert error (connected):", upsertError);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            message: "WhatsApp já está conectado",
            status: "connected"
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
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
      
      const createResponse = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            byEvents: true,
            base64: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
          settings: {
            syncFullHistory: true,
            rejectCall: false,
            groupsIgnore: true,
          },
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Evolution API create error:", errorText);
        return new Response(JSON.stringify({ error: "Erro ao criar instância WhatsApp" }), { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const createData = await createResponse.json();
      console.log("Evolution create response keys:", Object.keys(createData));
      
      // Extract QR code - handle different response formats
      const qrCodeRaw = createData.qrcode?.base64 || createData.base64 || createData.qrcode || null;
      const qrCodeBase64 = extractBase64(qrCodeRaw);
      
      console.log("QR Code extracted:", qrCodeBase64 ? `${qrCodeBase64.substring(0, 50)}...` : "null");
      
      // Save to database
      const { error: upsertError } = await supabase
        .from("whatsapp_instances")
        .upsert({
          user_id: userId,
          instance_name: instanceName,
          status: qrCodeBase64 ? "qr_ready" : "pending",
          qr_code_base64: qrCodeBase64,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Upsert error (create):", upsertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar instância: " + upsertError.message }), { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        qrCode: qrCodeBase64,
        status: qrCodeBase64 ? "qr_ready" : "pending"
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Instance exists but not connected, get new QR code
    const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: evolutionKey },
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error("Evolution API connect error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao conectar instância" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const connectData = await connectResponse.json();
    console.log("Evolution connect response keys:", Object.keys(connectData));
    
    // Extract QR code - handle different response formats
    const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;
    const qrCodeBase64 = extractBase64(qrCodeRaw);
    
    console.log("QR Code extracted (connect):", qrCodeBase64 ? `${qrCodeBase64.substring(0, 50)}...` : "null");

    // Update database with QR code
    const { error: upsertError } = await supabase
      .from("whatsapp_instances")
      .upsert({
        user_id: userId,
        instance_name: instanceName,
        status: "qr_ready",
        qr_code_base64: qrCodeBase64,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Upsert error (connect):", upsertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar QR Code: " + upsertError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      qrCode: qrCodeBase64,
      status: "qr_ready"
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
