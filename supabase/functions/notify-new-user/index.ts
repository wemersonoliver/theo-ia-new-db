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
    console.log("notify-new-user called:", { full_name, email });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active notification contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("admin_notification_contacts")
      .select("phone")
      .eq("active", true);

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
    }

    if (!contacts || contacts.length === 0) {
      console.log("No active contacts found");
      return new Response(JSON.stringify({ message: "No active contacts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${contacts.length} active contacts`);

    // Get system WhatsApp instance
    const { data: instances } = await supabase
      .from("system_whatsapp_instance")
      .select("instance_name, status")
      .eq("status", "connected")
      .limit(1);

    const instance = instances?.[0];
    if (!instance) {
      console.log("No connected system instance");
      return new Response(JSON.stringify({ message: "No connected system instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using instance:", instance.instance_name);

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;

    console.log("Evolution URL:", evolutionUrl);

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    const message = `🆕 *Novo usuário cadastrado!*\n\n📋 *Nome:* ${full_name || "Não informado"}\n📧 *Email:* ${email || "Não informado"}\n📅 *Data:* ${dateStr} às ${timeStr}`;

    let sent = 0;

    // Send to all active contacts
    for (const c of contacts) {
      try {
        const url = `${evolutionUrl}/message/sendText/${instance.instance_name}`;
        console.log(`Sending to ${c.phone} via ${url}`);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            number: c.phone,
            text: message,
          }),
        });

        const body = await res.text();
        console.log(`Response for ${c.phone}: status=${res.status}, body=${body}`);

        if (res.ok) {
          sent++;
        }
      } catch (err) {
        console.error(`Failed to send to ${c.phone}:`, err);
      }
    }

    console.log(`Sent ${sent}/${contacts.length}`);

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
