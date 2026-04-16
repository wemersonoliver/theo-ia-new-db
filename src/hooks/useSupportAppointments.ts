import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SupportAppointment {
  id: string;
  appointment_type_id: string | null;
  user_ref_id: string | null;
  phone: string;
  contact_name: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  support_appointment_types?: { name: string } | null;
}

export function useSupportAppointments() {
  const qc = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["support-appointments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_appointments")
        .select("*, support_appointment_types(name)")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as SupportAppointment[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (params: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("support_appointments")
        .update({ status: params.status })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["support-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("support_appointments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["support-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { appointments: appointments || [], isLoading, updateStatus, remove };
}
