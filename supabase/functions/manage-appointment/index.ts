import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveInstanceContext, sendWhatsAppText as providerSendText } from "../_wa_provider.ts";
import { fetchAppointmentBlocks, findBlockConflict } from "../_appointment-blocks.ts";

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

    const body = await req.json();
    const { operation, userId, phone, contactName, date, time, title, description, appointmentId, status, tags, action: tagAction } = body;

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

        const avail = await computeDayAvailability(supabase, userId, date);

        if (avail.allDayBlocked) {
          return new Response(JSON.stringify({
            available_slots: [],
            date,
            message: "A agenda está bloqueada neste dia. Sugira outra data ao cliente."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (avail.grid.length === 0) {
          return new Response(JSON.stringify({
            available_slots: [],
            date,
            message: "Não há atendimento neste dia da semana. Sugira outra data ao cliente e NUNCA invente horários."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({
          available_slots: avail.availableLabels,
          appointment_types: avail.typeNames.length > 0 ? avail.typeNames : undefined,
          date,
          message: avail.availableLabels.length > 0
            ? `Horários disponíveis para ${formatDate(date)}: ${avail.availableLabels.join(", ")}. Ofereça SOMENTE estes horários — nenhum outro existe nesta data.`
            : "Todos os horários estão ocupados neste dia. Sugira outra data e NUNCA invente horários."
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

        const dayOfWeek = dayOfWeekFromYmd(date);

        // Valida contra a grade real de horários configurada + bloqueios
        const createAvail = await computeDayAvailability(supabase, userId, date);
        const requestedHHMM = String(timeWithSeconds).slice(0, 5);

        if (createAvail.allDayBlocked) {
          return new Response(JSON.stringify({
            success: false,
            message: "A agenda está bloqueada nesta data. Por favor, escolha outro dia."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (createAvail.hasConfig && createAvail.grid.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            message: "Não há atendimento neste dia da semana. Peça ao cliente para escolher outra data e consulte os horários disponíveis antes de oferecer qualquer horário."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (createAvail.hasConfig && !createAvail.grid.includes(requestedHHMM)) {
          return new Response(JSON.stringify({
            success: false,
            message: createAvail.available.length > 0
              ? `O horário ${requestedHHMM} NÃO existe na agenda desta data. Horários realmente disponíveis: ${createAvail.available.join(", ")}. Ofereça somente estes.`
              : `O horário ${requestedHHMM} NÃO existe na agenda desta data e não há horários livres. Sugira outra data.`
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (createAvail.hasConfig && !createAvail.available.includes(requestedHHMM)) {
          return new Response(JSON.stringify({
            success: false,
            message: createAvail.available.length > 0
              ? `Este horário não está livre. Horários disponíveis: ${createAvail.available.join(", ")}.`
              : "Este horário não está disponível e não há horários livres nesta data. Sugira outra data."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Get max capacity - try appointment_types first, fallback to appointment_slots
        let maxPerSlot = 1;
        
        const { data: typeConfig } = await supabase
          .from("appointment_types")
          .select("max_appointments_per_slot")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (typeConfig) {
          maxPerSlot = typeConfig.max_appointments_per_slot || 1;
        } else {
          const { data: slotConfig } = await supabase
            .from("appointment_slots")
            .select("max_appointments_per_slot")
            .eq("user_id", userId)
            .eq("day_of_week", dayOfWeek)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          maxPerSlot = slotConfig?.max_appointments_per_slot || 1;
        }

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

        // Auto-liberar agenda: cancela agendamentos futuros ativos do MESMO telefone
        // (evita duplicatas no calendário quando a IA cria em vez de reagendar)
        try {
          const todayStr = new Date().toISOString().slice(0, 10);
          const { data: existingFuture } = await supabase
            .from("appointments")
            .select("id, appointment_date, appointment_time")
            .eq("user_id", userId)
            .eq("phone", phone)
            .eq("status", "scheduled")
            .gte("appointment_date", todayStr);

          const toCancel = (existingFuture || []).filter((a: any) => {
            // não cancela se for exatamente o mesmo slot (não deveria ocorrer pois capacidade já foi checada)
            return !(a.appointment_date === date && String(a.appointment_time).slice(0,5) === String(timeWithSeconds).slice(0,5));
          });

          if (toCancel.length > 0) {
            const ids = toCancel.map((a: any) => a.id);
            await supabase
              .from("appointments")
              .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
              })
              .in("id", ids);
            console.log(`[create_appointment] Cancelados ${ids.length} agendamento(s) anterior(es) do telefone ${phone} para liberar agenda.`);
          }
        } catch (e) {
          console.error("Erro ao liberar agendamentos anteriores:", e);
        }

        // Create appointment
        // Resolve account_id (owner do user_id) para o agendamento aparecer no calendário
        let resolvedAccountId: string | null = null;
        try {
          const { data: ownAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("owner_user_id", userId)
            .maybeSingle();
          resolvedAccountId = ownAccount?.id || null;

          if (!resolvedAccountId) {
            const { data: memberAccount } = await supabase
              .from("account_members")
              .select("account_id")
              .eq("user_id", userId)
              .eq("status", "active")
              .order("invited_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            resolvedAccountId = memberAccount?.account_id || null;
          }
        } catch (e) {
          console.error("Error resolving account_id:", e);
        }

        const { data: appointment, error } = await supabase
          .from("appointments")
          .insert({
            user_id: userId,
            account_id: resolvedAccountId,
            assigned_to: userId,
            phone,
            contact_name: contactName,
            title,
            description,
            appointment_date: date,
            appointment_time: timeWithSeconds,
            status: "scheduled",
            created_via: "ai",
            created_by: null,
          })
          .select()
          .single();

        // Also update contact_name on the conversation if we have a name
        if (contactName && phone) {
          await supabase
            .from("whatsapp_conversations")
            .update({ contact_name: contactName, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("phone", phone);
        }

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

        // Move CRM deal to "Agendamento Realizado"
        await moveCRMDealByPhone(supabase, userId, phone, "Agendamento Realizado");

        // Tag automática: adiciona "agendamento" ao contato e cancela follow-up
        if (resolvedAccountId && phone) {
          try {
            await supabase.rpc("tag_contact_reserved", {
              _account_id: resolvedAccountId,
              _phone: phone,
              _tag: "agendamento",
              _add: true,
            });
          } catch (e) { console.error("tag_contact_reserved (create) err:", e); }
        }

        return new Response(JSON.stringify({ 
          success: true,
          appointment,
          message: `Agendamento confirmado! ${title} marcado para ${formatDate(date)} às ${time}.`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "cancel_appointment": {
        if (!appointmentId && !phone) {
          return new Response(JSON.stringify({ error: "Missing appointment identifier" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Resolve target appointment id
        let targetId = appointmentId as string | undefined;
        if (!targetId) {
          let findQ = supabase
            .from("appointments")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", phone)
            .in("status", ["scheduled", "confirmed"])
            .order("appointment_date", { ascending: true })
            .order("appointment_time", { ascending: true });
          if (date) findQ = findQ.eq("appointment_date", date);
          if (time) {
            const timeWithSeconds = time.includes(":") && time.split(":").length === 2 ? `${time}:00` : time;
            findQ = findQ.eq("appointment_time", timeWithSeconds);
          }
          const { data: found } = await findQ.limit(1).maybeSingle();
          targetId = found?.id;
        }

        if (!targetId) {
          return new Response(JSON.stringify({
            success: false,
            message: "Não encontrei um agendamento ativo para cancelar."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data, error } = await supabase
          .from("appointments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", targetId)
          .select();

        if (error || !data?.length) {
          return new Response(JSON.stringify({ 
            success: false,
            message: "Agendamento não encontrado ou já foi cancelado."
          }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Verifica se ainda restam agendamentos ativos do contato; se não, remove a tag "agendamento"
        try {
          const cancelledApt = data[0];
          const aptPhone = cancelledApt?.phone;
          const aptAccount = cancelledApt?.account_id;
          if (aptAccount && aptPhone) {
            const { count: remaining } = await supabase
              .from("appointments")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("phone", aptPhone)
              .in("status", ["scheduled", "confirmed"]);
            if (!remaining || remaining === 0) {
              await supabase.rpc("tag_contact_reserved", {
                _account_id: aptAccount,
                _phone: aptPhone,
                _tag: "agendamento",
                _add: false,
              });
            }
          }
        } catch (e) { console.error("tag_contact_reserved (cancel) err:", e); }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Agendamento cancelado com sucesso."
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "reschedule_appointment": {
        if (!date || !time || (!appointmentId && !phone)) {
          return new Response(JSON.stringify({ error: "Missing reschedule fields" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        let findQuery = supabase
          .from("appointments")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (appointmentId) {
          findQuery = findQuery.eq("id", appointmentId);
        } else {
          findQuery = findQuery.eq("phone", phone);
        }

        const { data: aptToReschedule } = await findQuery.limit(1).maybeSingle();

        if (!aptToReschedule) {
          return new Response(JSON.stringify({ 
            success: false,
            message: "Não encontrei um agendamento ativo para reagendar."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const timeWithSeconds = time.includes(":") && time.split(":").length === 2 ? `${time}:00` : time;
        const dayOfWeek = dayOfWeekFromYmd(date);

        const rescheduleAvail = await computeDayAvailability(supabase, userId, date, aptToReschedule.id);
        const newHHMM = String(timeWithSeconds).slice(0, 5);

        if (rescheduleAvail.allDayBlocked) {
          return new Response(JSON.stringify({
            success: false,
            message: "A agenda está bloqueada nesta data. Por favor, escolha outro dia."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (rescheduleAvail.hasConfig && !rescheduleAvail.grid.includes(newHHMM)) {
          return new Response(JSON.stringify({
            success: false,
            message: rescheduleAvail.available.length > 0
              ? `O horário ${newHHMM} NÃO existe na agenda desta data. Horários realmente disponíveis: ${rescheduleAvail.available.join(", ")}. Ofereça somente estes.`
              : `Não há atendimento nesta data. Sugira outra data ao cliente.`
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (rescheduleAvail.hasConfig && !rescheduleAvail.available.includes(newHHMM)) {
          return new Response(JSON.stringify({
            success: false,
            message: rescheduleAvail.available.length > 0
              ? `Este horário não está livre. Horários disponíveis: ${rescheduleAvail.available.join(", ")}.`
              : "Não há horários livres nesta data. Sugira outra data."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let maxPerSlot = 1;
        const { data: typeConfig } = await supabase
          .from("appointment_types")
          .select("max_appointments_per_slot")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (typeConfig) {
          maxPerSlot = typeConfig.max_appointments_per_slot || 1;
        } else {
          const { data: slotConfig } = await supabase
            .from("appointment_slots")
            .select("max_appointments_per_slot")
            .eq("user_id", userId)
            .eq("day_of_week", dayOfWeek)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          maxPerSlot = slotConfig?.max_appointments_per_slot || 1;
        }

        const { data: existingAtTime } = await supabase
          .from("appointments")
          .select("id")
          .eq("user_id", userId)
          .eq("appointment_date", date)
          .eq("appointment_time", timeWithSeconds)
          .neq("status", "cancelled")
          .neq("id", aptToReschedule.id);

        if ((existingAtTime?.length || 0) >= maxPerSlot) {
          return new Response(JSON.stringify({ 
            success: false,
            message: maxPerSlot > 1
              ? `Todas as ${maxPerSlot} vagas para este horário já estão ocupadas. Por favor, escolha outro horário.`
              : "Este horário já está ocupado. Por favor, escolha outro horário."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const previousDate = aptToReschedule.appointment_date;
        const previousTime = String(aptToReschedule.appointment_time).slice(0, 5);
        const existingTags: string[] = aptToReschedule.tags || [];
        const nextTags = existingTags.includes("reagendado") ? existingTags : [...existingTags, "reagendado"];

        const { data: updatedAppointment, error: rescheduleError } = await supabase
          .from("appointments")
          .update({
            appointment_date: date,
            appointment_time: timeWithSeconds,
            title: title || aptToReschedule.title,
            description: description ?? aptToReschedule.description,
            status: "scheduled",
            reminder_sent: false,
            reminder_sent_at: null,
            confirmed_by_client: false,
            tags: nextTags,
            updated_at: new Date().toISOString(),
          })
          .eq("id", aptToReschedule.id)
          .select()
          .single();

        if (rescheduleError) {
          console.error("Error rescheduling appointment:", rescheduleError);
          return new Response(JSON.stringify({ 
            success: false,
            message: "Erro ao reagendar. Por favor, tente novamente."
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await notifyAppointment(supabase, userId, updatedAppointment.contact_name || contactName, updatedAppointment.phone || phone, date, time, updatedAppointment.title, {
          kind: "reschedule",
          previousDate,
          previousTime,
        });

        return new Response(JSON.stringify({ 
          success: true,
          appointment: updatedAppointment,
          message: `Agendamento reagendado com sucesso: de ${formatDate(previousDate)} às ${previousTime} para ${formatDate(date)} às ${time}.`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

        // Move CRM deal to "Agendamento Confirmado"
        await moveCRMDealByPhone(supabase, userId, aptToConfirm.phone, "Agendamento Confirmado");

        // Garante tag "agendamento" no contato e cancela follow-up
        try {
          const acc = aptToConfirm.account_id;
          if (acc && aptToConfirm.phone) {
            await supabase.rpc("tag_contact_reserved", {
              _account_id: acc,
              _phone: aptToConfirm.phone,
              _tag: "agendamento",
              _add: true,
            });
          }
        } catch (e) { console.error("tag_contact_reserved (confirm) err:", e); }

        return new Response(JSON.stringify({ 
          success: true,
          message: `Presença confirmada para ${aptToConfirm.title} em ${formatDate(aptToConfirm.appointment_date)} às ${aptToConfirm.appointment_time.slice(0, 5)}.`
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      case "update_appointment_tags": {
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

async function notifyAppointment(
  supabase: any,
  userId: string,
  contactName: string | null,
  clientPhone: string,
  date: string,
  time: string,
  title: string,
  options?: { kind?: "create" | "reschedule"; previousDate?: string; previousTime?: string },
) {
  try {
    let displayName = contactName || null;
    if (!displayName) {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("contact_name")
        .eq("user_id", userId)
        .eq("phone", clientPhone)
        .maybeSingle();
      displayName = conv?.contact_name || "Desconhecido";
    }

    const { data: notifContacts } = await supabase
      .from("notification_contacts")
      .select("phone")
      .eq("user_id", userId)
      .eq("notify_appointments", true);

    if (!notifContacts || notifContacts.length === 0) return;

    const isReschedule = options?.kind === "reschedule";
    const previousBlock = isReschedule && options.previousDate && options.previousTime
      ? `\n\n🔁 *Anterior:* ${formatDate(options.previousDate)} às ${options.previousTime}`
      : "";
    const message = isReschedule
      ? `🔁 *Agendamento Reagendado*\n\n👤 *Cliente:* ${displayName}\n📱 *Telefone:* ${clientPhone}\n📋 *Serviço:* ${title}${previousBlock}\n\n🗓️ *Nova data:* ${formatDate(date)}\n⏰ *Novo horário:* ${time}`
      : `📅 *Novo Agendamento*\n\n👤 *Cliente:* ${displayName}\n📱 *Telefone:* ${clientPhone}\n📋 *Serviço:* ${title}\n🗓️ *Data:* ${formatDate(date)}\n⏰ *Horário:* ${time}`;

    // Resolve o contexto do provedor real (WAHA ou Evolution).
    // Prioriza a instância do sistema; se não estiver conectada, usa a do usuário.
    let ctx = await resolveInstanceContext(supabase, { system: true });
    let source = "system";
    if (!ctx || ctx.status !== "connected") {
      ctx = await resolveInstanceContext(supabase, { userId });
      source = "user";
    }

    if (!ctx) {
      console.error("Appointment notification: nenhuma instância de WhatsApp disponível");
      return;
    }

    let sent = 0;
    for (const contact of notifContacts) {
      try {
        const res = await providerSendText(ctx, contact.phone, message);
        if (res.ok) sent++;
        else {
          console.error(
            `Error sending appointment notification to ${contact.phone} (${ctx.provider}/${source}):`,
            res.status,
            JSON.stringify(res.errorPayload || {}).slice(0, 300),
          );
        }
      } catch (e) {
        console.error(`Appointment notification exception for ${contact.phone}:`, e);
      }
    }

    console.log(`Appointment notification sent to ${sent}/${notifContacts.length} contacts via ${source} instance (${ctx.provider})`);
  } catch (error) {
    console.error("Error sending appointment notifications:", error);
  }
}

/**
 * Move o deal CRM ativo (ligado ao contato pelo telefone) para uma etapa específica do pipeline do usuário.
 * - Nunca retrocede: só move se a etapa-alvo tiver position >= etapa atual.
 * - Ignora deals já ganhos/perdidos.
 */
async function moveCRMDealByPhone(
  supabase: any,
  userId: string,
  phone: string | null | undefined,
  targetStageName: string,
) {
  try {
    if (!phone) return;

    // Pipeline mais antigo do usuário
    const { data: pipelines } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!pipelines || pipelines.length === 0) return;
    const pipelineId = pipelines[0].id;

    const { data: stages } = await supabase
      .from("crm_stages")
      .select("id, name, position")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true });

    if (!stages || stages.length === 0) return;

    const target = stages.find(
      (s: any) => String(s.name).toLowerCase() === targetStageName.toLowerCase(),
    );
    if (!target) {
      console.log(`moveCRMDealByPhone: target stage "${targetStageName}" not found`);
      return;
    }

    // Localiza contato
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    if (!contact) return;

    // Deal ativo do contato
    const stageIds = stages.map((s: any) => s.id);
    const { data: deals } = await supabase
      .from("crm_deals")
      .select("id, stage_id")
      .eq("user_id", userId)
      .eq("contact_id", contact.id)
      .in("stage_id", stageIds)
      .is("won_at", null)
      .is("lost_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!deals || deals.length === 0) return;
    const deal = deals[0];

    if (deal.stage_id === target.id) return;

    const currentStage = stages.find((s: any) => s.id === deal.stage_id);
    if (currentStage && currentStage.position > target.position) {
      console.log(`moveCRMDealByPhone: deal já em etapa posterior (${currentStage.name}), ignorando`);
      return;
    }

    // Posição final na coluna alvo
    const { count } = await supabase
      .from("crm_deals")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", target.id)
      .eq("user_id", userId);

    await supabase
      .from("crm_deals")
      .update({
        stage_id: target.id,
        position: count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    console.log(`CRM deal moved to "${targetStageName}" for ${phone}`);
  } catch (e) {
    console.error("moveCRMDealByPhone error:", e);
  }
}
