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

    // Get user's instance
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      return jsonResponse({ error: "Nenhuma instância encontrada" }, 404);
    }

    // Get Evolution API from global secrets
    const evolutionUrl = normalizeEvolutionUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured in secrets");
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    // Logout from Evolution API
    const logoutResponse = await evolutionRequest({
      evolutionUrl,
      evolutionKey,
      path: `/instance/logout/${instance.instance_name}`,
      method: "DELETE",
    });

    if (!logoutResponse.ok) {
      return jsonResponse(buildEvolutionErrorPayload(logoutResponse, "Erro ao desconectar instância WhatsApp"), 502);
    }

    // Update database
    await supabase
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        qr_code_base64: null,
        phone_number: null,
        profile_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return jsonResponse({ success: true });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
