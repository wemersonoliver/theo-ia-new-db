import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface Appointment {
  id: string;
  user_id: string;
  phone: string;
  contact_name: string | null;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  confirmed_by_client: boolean;
  tags: string[];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlot {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_appointments_per_slot: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export function useAppointments(selectedDate?: Date) {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", accountId, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!user || !accountId) return [];

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("account_id", accountId)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split("T")[0];
        query = query.eq("appointment_date", dateStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching appointments:", error);
        return [];
      }

      return data as Appointment[];
    },
    enabled: !!user && !!accountId,
  });

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["appointments-today", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("account_id", accountId)
        .eq("appointment_date", today)
        .neq("status", "cancelled")
        .order("appointment_time", { ascending: true });

      if (error) {
        console.error("Error fetching today appointments:", error);
        return [];
      }

      return data as Appointment[];
    },
    enabled: !!user && !!accountId,
  });

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["appointments-upcoming", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("account_id", accountId)
        .gte("appointment_date", today)
        .neq("status", "cancelled")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(5);
      if (error) { console.error("Error fetching upcoming appointments:", error); return []; }
      return data as Appointment[];
    },
    enabled: !!user && !!accountId,
  });

  const { data: appointmentDates = [] } = useQuery({
    queryKey: ["appointment-dates", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("appointment_date")
        .eq("account_id", accountId)
        .neq("status", "cancelled");
      if (error) { console.error("Error fetching appointment dates:", error); return []; }
      return [...new Set(data.map(d => d.appointment_date))] as string[];
    },
    enabled: !!user && !!accountId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      toast.success("Agendamento removido!");
    },
    onError: (error) => {
      console.error("Error deleting appointment:", error);
      toast.error("Erro ao remover agendamento");
    },
  });

  const assignAppointment = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      toast.success("Responsável atualizado!");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const createAppointment = useMutation({
    mutationFn: async (input: {
      title: string;
      phone: string;
      contact_name?: string | null;
      description?: string | null;
      appointment_date: string; // YYYY-MM-DD
      appointment_time: string; // HH:MM
      duration_minutes?: number;
      appointment_type_id?: string | null;
      assigned_to?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");
      const ctx = await resolveAccountContext(user.id);
      if (!ctx?.accountId) throw new Error("Conta não encontrada");

      // Normaliza telefone: garante DDI 55 para BR
      let phone = (input.phone || "").replace(/\D/g, "");
      if (phone.length === 10 || phone.length === 11) phone = "55" + phone;

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        account_id: ctx.accountId,
        assigned_to: input.assigned_to ?? user.id,
        title: input.title,
        phone,
        contact_name: input.contact_name ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        appointment_date: input.appointment_date,
        appointment_time: input.appointment_time,
        duration_minutes: input.duration_minutes ?? 30,
        appointment_type_id: input.appointment_type_id ?? null,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-dates"] });
      toast.success("Agendamento criado!");
    },
    onError: (e: Error) => toast.error(`Erro ao criar agendamento: ${e.message}`),
  });

  return {
    appointments,
    todayAppointments,
    upcomingAppointments,
    appointmentDates,
    isLoading,
    updateStatus,
    deleteAppointment,
    assignAppointment,
    createAppointment,
  };
}

export function useAppointmentSlots() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["appointment-slots", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];

      const { data, error } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("account_id", accountId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching slots:", error);
        return [];
      }

      return data as AppointmentSlot[];
    },
    enabled: !!user && !!accountId,
  });

  const saveSlot = useMutation({
    mutationFn: async (slot: Omit<AppointmentSlot, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("appointment_slots")
        .upsert({
          ...slot,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,day_of_week,start_time" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-slots"] });
      toast.success("Horário salvo!");
    },
    onError: (error) => {
      console.error("Error saving slot:", error);
      toast.error("Erro ao salvar horário");
    },
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointment_slots")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-slots"] });
      toast.success("Horário removido!");
    },
    onError: (error) => {
      console.error("Error deleting slot:", error);
      toast.error("Erro ao remover horário");
    },
  });

  const toggleSlotActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("appointment_slots")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-slots"] });
    },
    onError: (error) => {
      console.error("Error toggling slot:", error);
      toast.error("Erro ao atualizar horário");
    },
  });

  return {
    slots,
    isLoading,
    saveSlot,
    deleteSlot,
    toggleSlotActive,
  };
}
