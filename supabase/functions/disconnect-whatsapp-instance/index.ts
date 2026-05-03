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

    // Optional instanceId in body
    let bodyInstanceId: string | null = null;
    try {
      const body = await req.json();
      bodyInstanceId = body?.instanceId || null;
    } catch { /* no body */ }

    // Get target instance
    let instance: any = null;
    if (bodyInstanceId) {
      const { data: ownedAccount } = await supabase
        .from("accounts").select("id").eq("owner_user_id", userId).maybeSingle();
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, account_id, status, is_primary")
        .eq("id", bodyInstanceId)
        .maybeSingle();
      if (!data || (ownedAccount?.id && data.account_id !== ownedAccount.id)) {
        return jsonResponse({ error: "Instância não encontrada" }, 404);
      }
      instance = data;
    } else {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status, is_primary")
        .eq("user_id", userId)
        .maybeSingle();
      instance = data;
    }

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

    const wasConnected = instance.status === "connected";

    // Try logout (ignore errors like "instance is not connected")
    try {
      await evolutionRequest({
        evolutionUrl,
        evolutionKey,
        path: `/instance/logout/${instance.instance_name}`,
        method: "DELETE",
      });
    } catch (e) {
      console.log("Logout skipped:", e instanceof Error ? e.message : e);
    }

    // If instance was not fully connected (cancel during QR/pending) OR is not the primary,
    // delete it entirely from Evolution API. Always for non-connected cancellations.
    if (!wasConnected) {
      try {
        await evolutionRequest({
          evolutionUrl,
          evolutionKey,
          path: `/instance/delete/${instance.instance_name}`,
          method: "DELETE",
        });
      } catch (e) {
        console.log("Delete instance skipped:", e instanceof Error ? e.message : e);
      }

      // Remove DB row so user can start fresh
      await supabase.from("whatsapp_instances").delete().eq("id", instance.id);
      return jsonResponse({ success: true, deleted: true });
    }

    // Connected case: just mark as disconnected
    await supabase
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        qr_code_base64: null,
        phone_number: null,
        profile_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instance.id);

    return jsonResponse({ success: true });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
