import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", user?.id, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user.id)
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
    enabled: !!user,
  });

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["appointments-today", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user.id)
        .eq("appointment_date", today)
        .neq("status", "cancelled")
        .order("appointment_time", { ascending: true });

      if (error) {
        console.error("Error fetching today appointments:", error);
        return [];
      }

      return data as Appointment[];
    },
    enabled: !!user,
  });

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["appointments-upcoming", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user.id)
        .gte("appointment_date", today)
        .neq("status", "cancelled")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching upcoming appointments:", error);
        return [];
      }

      return data as Appointment[];
    },
    enabled: !!user,
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

  return {
    appointments,
    todayAppointments,
    upcomingAppointments,
    isLoading,
    updateStatus,
    deleteAppointment,
  };
}

export function useAppointmentSlots() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["appointment-slots", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching slots:", error);
        return [];
      }

      return data as AppointmentSlot[];
    },
    enabled: !!user,
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
