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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { operation, userId, phone, contactName, date, time, title, description, appointmentId, status } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    switch (operation) {
      case "check_availability": {
        if (!date) {
          return new Response(JSON.stringify({ error: "Missing date" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();

        // Get available slots for this day
        const { data: slots } = await supabase
          .from("appointment_slots")
          .select("*")
          .eq("user_id", userId)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .order("start_time");

        if (!slots || slots.length === 0) {
          return new Response(JSON.stringify({ 
            available_slots: [],
            message: "Nenhum horário disponível neste dia."
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Get existing appointments for this date, grouped by time
        const { data: existingAppointments } = await supabase
          .from("appointments")
          .select("appointment_time, duration_minutes")
          .eq("user_id", userId)
          .eq("appointment_date", date)
          .neq("status", "cancelled");

        // Count appointments per time slot
        const appointmentCountByTime: Record<string, number> = {};
        for (const a of (existingAppointments || [])) {
          appointmentCountByTime[a.appointment_time] = (appointmentCountByTime[a.appointment_time] || 0) + 1;
        }

        // Generate available time slots
        const availableSlots: string[] = [];

        for (const slot of slots) {
          const [startHour, startMin] = slot.start_time.split(":").map(Number);
          const [endHour, endMin] = slot.end_time.split(":").map(Number);
          const slotDuration = slot.slot_duration_minutes || 30;
          const maxPerSlot = slot.max_appointments_per_slot || 1;

          let currentMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;

          while (currentMinutes + slotDuration <= endMinutes) {
            const hour = Math.floor(currentMinutes / 60);
            const minute = currentMinutes % 60;
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
            const currentCount = appointmentCountByTime[timeStr] || 0;

            if (currentCount < maxPerSlot) {
              const remaining = maxPerSlot - currentCount;
              const display = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
              availableSlots.push(maxPerSlot > 1 ? `${display} (${remaining} vaga${remaining > 1 ? "s" : ""})` : display);
            }

            currentMinutes += slotDuration;
          }
        }

        return new Response(JSON.stringify({ 
          available_slots: availableSlots,
          date,
          message: availableSlots.length > 0 
            ? `Horários disponíveis para ${formatDate(date)}: ${availableSlots.join(", ")}`
            : "Todos os horários estão ocupados neste dia."
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "create_appointment": {
        if (!date || !time || !title || !phone) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Check slot capacity
        const timeWithSeconds = time.includes(":") && time.split(":").length === 2 
          ? `${time}:00` 
          : time;

        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();

        // Get slot config for this day/time to know max capacity
        const { data: slotConfig } = await supabase
          .from("appointment_slots")
          .select("max_appointments_per_slot")
          .eq("user_id", userId)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        const maxPerSlot = slotConfig?.max_appointments_per_slot || 1;

        // Count existing appointments at this time
        const { data: existingAtTime, error: countError } = await supabase
          .from("appointments")
          .select("id")
          .eq("user_id", userId)
          .eq("appointment_date", date)
          .eq("appointment_time", timeWithSeconds)
          .neq("status", "cancelled");

        const currentCount = existingAtTime?.length || 0;

        if (currentCount >= maxPerSlot) {
          return new Response(JSON.stringify({ 
            success: false,
            message: maxPerSlot > 1 
              ? `Todas as ${maxPerSlot} vagas para este horário já estão ocupadas. Por favor, escolha outro horário.`
              : "Este horário já está ocupado. Por favor, escolha outro horário."
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Create appointment
        const { data: appointment, error } = await supabase
          .from("appointments")
          .insert({
            user_id: userId,
            phone,
            contact_name: contactName,
            title,
            description,
            appointment_date: date,
            appointment_time: timeWithSeconds,
            status: "scheduled",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating appointment:", error);
          return new Response(JSON.stringify({ 
            success: false,
            message: "Erro ao criar agendamento. Por favor, tente novamente."
          }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Notify registered contacts about new appointment
        await notifyAppointment(supabase, userId, contactName, phone, date, time, title);

        return new Response(JSON.stringify({ 
          success: true,
          appointment,
          message: `Agendamento confirmado! ${title} marcado para ${formatDate(date)} às ${time}.`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "cancel_appointment": {
        if (!appointmentId && (!date || !time || !phone)) {
          return new Response(JSON.stringify({ error: "Missing appointment identifier" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        let query = supabase
          .from("appointments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (appointmentId) {
          query = query.eq("id", appointmentId);
        } else {
          const timeWithSeconds = time.includes(":") && time.split(":").length === 2 
            ? `${time}:00` 
            : time;
          query = query.eq("phone", phone).eq("appointment_date", date).eq("appointment_time", timeWithSeconds);
        }

        const { data, error } = await query.select();

        if (error || !data?.length) {
          return new Response(JSON.stringify({ 
            success: false,
            message: "Agendamento não encontrado ou já foi cancelado."
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Agendamento cancelado com sucesso."
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "list_appointments": {
        let query = supabase
          .from("appointments")
          .select("*")
          .eq("user_id", userId)
          .neq("status", "cancelled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (phone) {
          query = query.eq("phone", phone);
        }

        if (date) {
          query = query.gte("appointment_date", date);
        }

        const { data: appointments, error } = await query.limit(10);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          appointments: appointments || [],
          message: appointments?.length 
            ? `Encontrados ${appointments.length} agendamentos.`
            : "Nenhum agendamento encontrado."
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "update_status": {
        if (!appointmentId || !status) {
          return new Response(JSON.stringify({ error: "Missing appointmentId or status" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        const { error } = await supabase
          .from("appointments")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", appointmentId)
          .eq("user_id", userId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: `Status atualizado para ${status}.`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "confirm_appointment": {
        // Find appointment by phone (upcoming, not cancelled)
        let query = supabase
          .from("appointments")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (phone) {
          query = query.eq("phone", phone);
        }
        if (appointmentId) {
          query = query.eq("id", appointmentId);
        }

        const { data: aptToConfirm } = await query.limit(1).maybeSingle();

        if (!aptToConfirm) {
          return new Response(JSON.stringify({ 
            success: false,
            message: "Nenhum agendamento pendente encontrado para confirmar."
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        const existingTags: string[] = aptToConfirm.tags || [];
        const newTags = existingTags.includes("confirmado") ? existingTags : [...existingTags, "confirmado"];

        const { error: confirmError } = await supabase
          .from("appointments")
          .update({ 
            status: "confirmed",
            confirmed_by_client: true,
            tags: newTags,
            updated_at: new Date().toISOString() 
          })
          .eq("id", aptToConfirm.id);

        if (confirmError) {
          return new Response(JSON.stringify({ error: confirmError.message }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: `Presença confirmada para ${aptToConfirm.title} em ${formatDate(aptToConfirm.appointment_date)} às ${aptToConfirm.appointment_time.slice(0, 5)}.`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "update_appointment_tags": {
        const { tags, action: tagAction } = await req.json().catch(() => ({ tags: [], action: "add" }));
        
        if (!appointmentId) {
          return new Response(JSON.stringify({ error: "Missing appointmentId" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        const { data: aptForTags } = await supabase
          .from("appointments")
          .select("tags")
          .eq("id", appointmentId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!aptForTags) {
          return new Response(JSON.stringify({ success: false, message: "Agendamento não encontrado." }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        let updatedTags: string[] = aptForTags.tags || [];
        const inputTags: string[] = Array.isArray(tags) ? tags : [tags];

        if (tagAction === "remove") {
          updatedTags = updatedTags.filter((t: string) => !inputTags.includes(t));
        } else {
          for (const tag of inputTags) {
            if (!updatedTags.includes(tag)) {
              updatedTags.push(tag);
            }
          }
        }

        const { error: tagError } = await supabase
          .from("appointments")
          .update({ tags: updatedTags, updated_at: new Date().toISOString() })
          .eq("id", appointmentId);

        if (tagError) {
          return new Response(JSON.stringify({ error: tagError.message }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          tags: updatedTags,
          message: `Tags atualizadas: ${updatedTags.join(", ")}`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid operation" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

  } catch (error) {
    console.error("Manage appointment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { 
    weekday: "long", 
    day: "2-digit", 
    month: "long" 
  });
}

async function notifyAppointment(supabase: any, userId: string, contactName: string | null, clientPhone: string, date: string, time: string, title: string) {
  try {
    const { data: notifContacts } = await supabase
      .from("notification_contacts")
      .select("phone")
      .eq("user_id", userId)
      .eq("notify_appointments", true);

    if (!notifContacts || notifContacts.length === 0) return;

    const displayName = contactName || "Desconhecido";
    const message = `📅 *Novo Agendamento*\n\n👤 *Cliente:* ${displayName}\n📱 *Telefone:* ${clientPhone}\n📋 *Serviço:* ${title}\n🗓️ *Data:* ${formatDate(date)}\n⏰ *Horário:* ${time}`;

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) return;

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instance) return;

    for (const contact of notifContacts) {
      await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: contact.phone, text: message }),
      });
    }

    console.log(`Appointment notification sent to ${notifContacts.length} contacts`);
  } catch (error) {
    console.error("Error sending appointment notifications:", error);
  }
}
