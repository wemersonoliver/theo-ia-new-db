import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SupportAppointmentType {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  max_appointments_per_slot: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSupportAppointmentTypes() {
  const qc = useQueryClient();

  const { data: types, isLoading } = useQuery({
    queryKey: ["support-appointment-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_appointment_types")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as SupportAppointmentType[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<SupportAppointmentType> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await (supabase as any)
          .from("support_appointment_types")
          .update(rest)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("support_appointment_types")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tipo salvo");
      qc.invalidateQueries({ queryKey: ["support-appointment-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("support_appointment_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo removido");
      qc.invalidateQueries({ queryKey: ["support-appointment-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { types: types || [], isLoading, upsert, remove };
}
