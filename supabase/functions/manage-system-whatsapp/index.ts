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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
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
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { action } = await req.json();
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const instanceName = "theo_ia_system_notifications";
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    const webhookEvents = ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"];

    const syncWebhook = async () => {
      const webhookResponse = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: true,
            base64: true,
            events: webhookEvents,
          },
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error("Evolution webhook set error:", errorText);
        throw new Error("Erro ao sincronizar webhook da instância do sistema");
      }

      await webhookResponse.text();
    };

    if (action === "connect") {
      let instanceExists = false;
      try {
        const checkResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: evolutionKey },
        });
        if (checkResponse.ok) {
          const state = await checkResponse.json();
          instanceExists = true;

          await syncWebhook();

          if (state.state === "open") {
            await supabase.from("system_whatsapp_instance").upsert({
              id: (await supabase.from("system_whatsapp_instance").select("id").limit(1).maybeSingle()).data?.id || undefined,
              instance_name: instanceName,
              status: "connected",
              qr_code_base64: null,
              updated_at: new Date().toISOString(),
            });

            return new Response(JSON.stringify({ success: true, status: "connected" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        } else {
          await checkResponse.text();
        }
      } catch (e) {
        console.log("Instance check failed:", e);
      }

      if (!instanceExists) {
        const createResponse = await fetch(`${evolutionUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: {
              url: webhookUrl,
              byEvents: true,
              base64: true,
              events: webhookEvents,
            },
            settings: { syncFullHistory: false, rejectCall: true, groupsIgnore: true },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error("Evolution create error:", errorText);
          return new Response(JSON.stringify({ error: "Erro ao criar instância" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const createData = await createResponse.json();
        const qrCodeRaw = createData.qrcode?.base64 || createData.base64 || createData.qrcode || null;
        const qrCodeBase64 = extractBase64(qrCodeRaw);

        const { data: existing } = await supabase.from("system_whatsapp_instance").select("id").limit(1).maybeSingle();

        if (existing) {
          await supabase.from("system_whatsapp_instance").update({
            instance_name: instanceName,
            status: qrCodeBase64 ? "qr_ready" : "pending",
            qr_code_base64: qrCodeBase64,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("system_whatsapp_instance").insert({
            instance_name: instanceName,
            status: qrCodeBase64 ? "qr_ready" : "pending",
            qr_code_base64: qrCodeBase64,
          });
        }

        return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64, status: qrCodeBase64 ? "qr_ready" : "pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await syncWebhook();

      const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: evolutionKey },
      });

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        console.error("Evolution connect error:", errorText);
        return new Response(JSON.stringify({ error: "Erro ao conectar" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const connectData = await connectResponse.json();
      const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;
      const qrCodeBase64 = extractBase64(qrCodeRaw);

      const { data: existing } = await supabase.from("system_whatsapp_instance").select("id").limit(1).maybeSingle();
      if (existing) {
        await supabase.from("system_whatsapp_instance").update({
          instance_name: instanceName,
          status: "qr_ready",
          qr_code_base64: qrCodeBase64,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("system_whatsapp_instance").insert({
          instance_name: instanceName,
          status: "qr_ready",
          qr_code_base64: qrCodeBase64,
        });
      }

      return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64, status: "qr_ready" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "sync_webhook") {
      await syncWebhook();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "disconnect") {
      const { data: sysInstance } = await supabase.from("system_whatsapp_instance").select("id, instance_name").limit(1).maybeSingle();
      if (!sysInstance) {
        return new Response(JSON.stringify({ error: "Nenhuma instância encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await fetch(`${evolutionUrl}/instance/logout/${sysInstance.instance_name}`, {
        method: "DELETE",
        headers: { apikey: evolutionKey },
      });

      await supabase.from("system_whatsapp_instance").update({
        status: "disconnected",
        qr_code_base64: null,
        phone_number: null,
        profile_name: null,
        updated_at: new Date().toISOString(),
      }).eq("id", sysInstance.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "refresh_qr") {
      const { data: sysInstance } = await supabase.from("system_whatsapp_instance").select("id, instance_name").limit(1).maybeSingle();
      if (!sysInstance) {
        return new Response(JSON.stringify({ error: "Nenhuma instância encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await syncWebhook();

      const connectResponse = await fetch(`${evolutionUrl}/instance/connect/${sysInstance.instance_name}`, {
        headers: { apikey: evolutionKey },
      });

      if (!connectResponse.ok) {
        return new Response(JSON.stringify({ error: "Erro ao atualizar QR" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const connectData = await connectResponse.json();
      const qrCodeRaw = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || null;
      const qrCodeBase64 = extractBase64(qrCodeRaw);

      await supabase.from("system_whatsapp_instance").update({
        qr_code_base64: qrCodeBase64,
        updated_at: new Date().toISOString(),
      }).eq("id", sysInstance.id);

      return new Response(JSON.stringify({ success: true, qrCode: qrCodeBase64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
