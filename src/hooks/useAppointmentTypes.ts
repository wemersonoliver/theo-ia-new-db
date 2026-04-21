import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface AppointmentType {
  id: string;
  user_id: string;
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

export type AppointmentTypeInput = {
  id?: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  max_appointments_per_slot: number;
  is_active?: boolean;
};

export function useAppointmentTypes() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: appointmentTypes = [], isLoading } = useQuery({
    queryKey: ["appointment-types", accountId],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const { data, error } = await supabase
        .from("appointment_types")
        .select("*")
        .eq("account_id", accountId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching appointment types:", error);
        return [];
      }
      return data as AppointmentType[];
    },
    enabled: !!user && !!accountId,
  });

  const saveType = useMutation({
    mutationFn: async (type: AppointmentTypeInput) => {
      if (!user) throw new Error("Usuário não autenticado");
      const ctx = await resolveAccountContext(user.id);

      const payload = {
        name: type.name,
        description: type.description ?? null,
        duration_minutes: type.duration_minutes,
        days_of_week: type.days_of_week,
        start_time: type.start_time,
        end_time: type.end_time,
        max_appointments_per_slot: type.max_appointments_per_slot,
        is_active: type.is_active ?? true,
      };

      if (type.id) {
        const { error } = await supabase
          .from("appointment_types")
          .update(payload)
          .eq("id", type.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("appointment_types")
          .insert({ user_id: user.id, account_id: ctx?.accountId, ...payload });
        if (error) throw error;
      }
    },
    onMutate: async (newType) => {
      await queryClient.cancelQueries({ queryKey: ["appointment-types", user?.id] });
      const previous = queryClient.getQueryData<AppointmentType[]>(["appointment-types", user?.id]);
      queryClient.setQueryData<AppointmentType[]>(["appointment-types", user?.id], (old = []) => {
        if (newType.id) {
          return old.map(t => t.id === newType.id ? { ...t, ...newType } : t);
        }
        return [...old, {
          id: crypto.randomUUID(),
          user_id: user?.id ?? "",
          name: newType.name,
          description: newType.description ?? null,
          duration_minutes: newType.duration_minutes,
          days_of_week: newType.days_of_week,
          start_time: newType.start_time,
          end_time: newType.end_time,
          max_appointments_per_slot: newType.max_appointments_per_slot,
          is_active: newType.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
      });
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
      toast.success("Serviço salvo!");
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["appointment-types", user?.id], context.previous);
      }
      console.error("Error saving appointment type:", error);
      toast.error("Erro ao salvar serviço");
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["appointment-types", user?.id] });
      const previous = queryClient.getQueryData<AppointmentType[]>(["appointment-types", user?.id]);
      queryClient.setQueryData<AppointmentType[]>(["appointment-types", user?.id], (old = []) =>
        old.filter(t => t.id !== id)
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
      toast.success("Serviço removido!");
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["appointment-types", user?.id], context.previous);
      }
      console.error("Error deleting appointment type:", error);
      toast.error("Erro ao remover serviço");
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
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["appointment-types", user?.id] });
      const previous = queryClient.getQueryData<AppointmentType[]>(["appointment-types", user?.id]);
      queryClient.setQueryData<AppointmentType[]>(["appointment-types", user?.id], (old = []) =>
        old.map(t => t.id === id ? { ...t, is_active: isActive } : t)
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-types"] });
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["appointment-types", user?.id], context.previous);
      }
      console.error("Error toggling appointment type:", error);
      toast.error("Erro ao atualizar serviço");
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
