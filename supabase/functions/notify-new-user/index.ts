import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveInstanceContext, sendWhatsAppText } from "../_wa_provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { full_name, email, phone } = await req.json();
    console.log("notify-new-user called:", { full_name, email, phone });

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

    // Get system WhatsApp instance context (WAHA ou Evolution — resolvido pelo provedor)
    const ctx = await resolveInstanceContext(supabase, { system: true });

    if (!ctx) {
      console.log("No system instance configured");
      return new Response(JSON.stringify({ message: "No system instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ctx.status !== "connected") {
      console.log("System instance not connected:", ctx.status);
      return new Response(JSON.stringify({ message: "No connected system instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using instance:", ctx.instanceName, "provider:", ctx.provider);

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    const phoneDigits = (phone || "").toString().replace(/\D/g, "");
    const phoneLine = phoneDigits ? `\n📱 *Telefone:* ${phoneDigits}` : "";

    const message = `🆕 *Novo usuário cadastrado!*\n\n📋 *Nome:* ${full_name || "Não informado"}\n📧 *Email:* ${email || "Não informado"}${phoneLine}\n📅 *Data:* ${dateStr} às ${timeStr}`;

    let sent = 0;

    // Send to all active contacts
    for (const c of contacts) {
      try {
        const res = await sendWhatsAppText(ctx, c.phone, message);
        console.log(`Response for ${c.phone}: ok=${res.ok} status=${res.status}`);

        if (res.ok) {
          sent++;
        } else {
          console.error(
            `Failed to send to ${c.phone} (${ctx.provider}):`,
            res.status,
            JSON.stringify(res.errorPayload || {}).slice(0, 300),
          );
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
