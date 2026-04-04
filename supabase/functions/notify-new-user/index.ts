import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { full_name, email } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active notification contacts
    const { data: contacts } = await supabase
      .from("admin_notification_contacts")
      .select("phone")
      .eq("active", true);

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ message: "No active contacts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get system WhatsApp instance
    const { data: instances } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .eq("status", "connected")
      .limit(1);

    const instance = instances?.[0];
    if (!instance) {
      return new Response(JSON.stringify({ message: "No connected system instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    const message = `🆕 *Novo usuário cadastrado!*\n\n📋 *Nome:* ${full_name || "Não informado"}\n📧 *Email:* ${email || "Não informado"}\n📅 *Data:* ${dateStr} às ${timeStr}`;

    // Send to all active contacts
    const results = await Promise.allSettled(
      contacts.map((c) =>
        fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            number: c.phone,
            text: message,
          }),
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ sent, total: contacts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-new-user error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
