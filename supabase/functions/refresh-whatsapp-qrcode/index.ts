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

    // Get user's instance
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Nenhuma instância encontrada" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

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

    // Primeiro valida o estado real da conexão na Evolution
    let evolutionState: string | null = null;
    try {
      const stateResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instance.instance_name}`, {
        headers: { apikey: evolutionKey },
      });

      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        evolutionState = String(
          stateData?.state ??
          stateData?.status ??
          stateData?.instance?.state ??
          stateData?.instance?.status ??
          ""
        ).toLowerCase();
      } else {
        const stateError = await stateResponse.text();
        console.log("connectionState unavailable:", stateError);
      }
    } catch (stateError) {
      console.log("connectionState check failed:", stateError);
    }

    if (evolutionState === "open" || evolutionState === "connected") {
      await supabase
        .from("whatsapp_instances")
        .update({
          status: "connected",
          qr_code_base64: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: "WhatsApp já está conectado"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // fallback para não regressar status local conectado
    if (instance.status === "connected") {
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: "WhatsApp já está conectado"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get new QR code
    const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${instance.instance_name}`, {
      headers: { apikey: evolutionKey },
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error("Evolution API error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao obter QR Code" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const connectData = await connectResponse.json();
    console.log("Evolution refresh response keys:", Object.keys(connectData));
    
    // Extract QR code - handle different response formats
    const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;
    const qrCodeBase64 = extractBase64(qrCodeRaw);
    
    console.log("QR Code extracted (refresh):", qrCodeBase64 ? `${qrCodeBase64.substring(0, 50)}...` : "null");

    if (!qrCodeBase64) {
      return new Response(JSON.stringify({
        success: false,
        message: "QR Code indisponível no momento"
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Update database only when a valid QR is available
    const { error: updateError } = await supabase
      .from("whatsapp_instances")
      .update({
        status: "qr_ready",
        qr_code_base64: qrCodeBase64,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao salvar QR Code: " + updateError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      qrCode: qrCodeBase64 
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
