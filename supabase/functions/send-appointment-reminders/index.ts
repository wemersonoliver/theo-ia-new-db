import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

    // Get all AI configs with reminders enabled
    const { data: configs } = await supabase
      .from("whatsapp_ai_config")
      .select("*")
      .eq("reminder_enabled", true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No reminder configs active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const config of configs) {
      const userId = config.user_id;
      const hoursBefore = config.reminder_hours_before || 2;
      const messageTemplate = config.reminder_message_template ||
        "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.";

      const businessStart = config.business_hours_start || "08:00";
      const businessEnd = config.business_hours_end || "18:00";
      const [bStartH, bStartM] = businessStart.split(":").map(Number);
      const [bEndH, bEndM] = businessEnd.split(":").map(Number);
      const businessStartMinutes = bStartH * 60 + bStartM;
      const businessEndMinutes = bEndH * 60 + bEndM;

      // Fetch appointments for today and tomorrow that haven't been reminded
      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .eq("reminder_sent", false)
        .eq("status", "scheduled")
        .in("appointment_date", [todayStr, tomorrowStr])
        .order("appointment_date")
        .order("appointment_time");

      if (!appointments || appointments.length === 0) continue;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const apt of appointments) {
        const [aptH, aptM] = apt.appointment_time.split(":").map(Number);
        const aptMinutes = aptH * 60 + aptM;
        const isToday = apt.appointment_date === todayStr;
        const isTomorrow = apt.appointment_date === tomorrowStr;

        let shouldSendNow = false;

        if (isToday) {
          // For today's appointments: send if we're within the reminder window
          const reminderTime = aptMinutes - (hoursBefore * 60);
          
          if (reminderTime < businessStartMinutes) {
            // Reminder time falls before business hours - should have been sent yesterday
            // Send immediately if we're in business hours now and appointment is still ahead
            if (currentMinutes >= businessStartMinutes && currentMinutes <= businessEndMinutes && aptMinutes > currentMinutes) {
              shouldSendNow = true;
            }
          } else if (currentMinutes >= reminderTime && currentMinutes <= aptMinutes) {
            shouldSendNow = true;
          }
        } else if (isTomorrow) {
          // For tomorrow's appointments: check if reminder should be sent today
          const reminderTime = aptMinutes - (hoursBefore * 60);

          if (reminderTime < businessStartMinutes) {
            // Reminder falls before business hours tomorrow
            // Send today, 2 hours before end of business
            const sendTime = businessEndMinutes - 120;
            if (currentMinutes >= sendTime && currentMinutes <= businessEndMinutes) {
              shouldSendNow = true;
            }
          }
        }

        if (!shouldSendNow) continue;

        // Build message from template
        const diaReferencia = isToday ? "hoje" : "amanhã";
        const horaFormatted = `${String(aptH).padStart(2, "0")}:${String(aptM).padStart(2, "0")}`;
        const message = messageTemplate
          .replace("{nome}", apt.contact_name || "")
          .replace("{dia_referencia}", diaReferencia)
          .replace("{hora}", horaFormatted)
          .replace("{titulo}", apt.title || "")
          .replace("{data}", apt.appointment_date);

        // Send via Evolution API
        await sendWhatsAppMessage(supabase, userId, apt.phone, message);

        // Mark as sent
        await supabase
          .from("appointments")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", apt.id);

        // Save message to conversation
        await saveMessageToConversation(supabase, userId, apt.phone, message);

        totalSent++;
        console.log(`Reminder sent for appointment ${apt.id} to ${apt.phone}`);
      }
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsAppMessage(supabase: any, userId: string, phone: string, message: string) {
  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Evolution API not configured");
      return;
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) {
      console.error("Instance not found for user:", userId);
      return;
    }

    const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (!response.ok) {
      console.error("Evolution send error:", await response.text());
    }
  } catch (error) {
    console.error("Send message error:", error);
  }
}

async function saveMessageToConversation(supabase: any, userId: string, phone: string, content: string) {
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id, messages")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  const newMessage = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    from_me: true,
    content,
    type: "text",
    sent_by: "system",
  };

  if (conversation) {
    const messages = conversation.messages || [];
    const updated = [...messages, newMessage];
    await supabase
      .from("whatsapp_conversations")
      .update({
        messages: updated,
        last_message_at: new Date().toISOString(),
        total_messages: updated.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }
}
