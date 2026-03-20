import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface AppointmentType {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAppointmentTypes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointmentTypes = [], isLoading } = useQuery({
    queryKey: ["appointment-types", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("appointment_types")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching appointment types:", error);
        return [];
      }
      return data as AppointmentType[];
    },
    enabled: !!user,
  });

  const saveType = useMutation({
    mutationFn: async (type: { id?: string; name: string; description?: string | null; duration_minutes: number; is_active?: boolean }) => {
      if (!user) throw new Error("Usuário não autenticado");

      if (type.id) {
        const { error } = await supabase
          .from("appointment_types")
          .update({
            name: type.name,
            description: type.description ?? null,
            duration_minutes: type.duration_minutes,
            is_active: type.is_active ?? true,
          })
          .eq("id", type.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("appointment_types")
          .insert({
            user_id: user.id,
            name: type.name,
            description: type.description ?? null,
            duration_minutes: type.duration_minutes,
            is_active: type.is_active ?? true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
      toast.success("Tipo de agendamento salvo!");
    },
    onError: (error) => {
      console.error("Error saving appointment type:", error);
      toast.error("Erro ao salvar tipo de agendamento");
    },
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointment_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
      toast.success("Tipo de agendamento removido!");
    },
    onError: (error) => {
      console.error("Error deleting appointment type:", error);
      toast.error("Erro ao remover tipo de agendamento");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("appointment_types")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
    },
    onError: (error) => {
      console.error("Error toggling appointment type:", error);
      toast.error("Erro ao atualizar tipo de agendamento");
    },
  });

  return {
    appointmentTypes,
    isLoading,
    saveType,
    deleteType,
    toggleActive,
  };
}
