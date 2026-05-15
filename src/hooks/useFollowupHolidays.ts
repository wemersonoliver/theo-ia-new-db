import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface Holiday {
  id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  recurring: boolean;
  created_at: string;
}

// Feriados nacionais BR comuns (recorrentes — ano fictício 2000 só pra month/day)
export const BR_HOLIDAYS_SEED = [
  { date: "2000-01-01", name: "Confraternização Universal" },
  { date: "2000-04-21", name: "Tiradentes" },
  { date: "2000-05-01", name: "Dia do Trabalho" },
  { date: "2000-09-07", name: "Independência do Brasil" },
  { date: "2000-10-12", name: "Nossa Senhora Aparecida" },
  { date: "2000-11-02", name: "Finados" },
  { date: "2000-11-15", name: "Proclamação da República" },
  { date: "2000-12-25", name: "Natal" },
];

export function useFollowupHolidays() {
  const { accountId } = useAccountId();
  const qc = useQueryClient();

  const holidaysQuery = useQuery({
    queryKey: ["custom-followup-holidays", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("custom_followup_holidays" as any)
        .select("*")
        .eq("account_id", accountId)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Holiday[];
    },
    enabled: !!accountId,
  });

  const createHoliday = useMutation({
    mutationFn: async (h: { date: string; name: string; recurring?: boolean }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("custom_followup_holidays" as any)
        .insert({ account_id: accountId, date: h.date, name: h.name, recurring: !!h.recurring })
        .select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-holidays", accountId] });
      toast.success("Feriado adicionado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_followup_holidays" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-followup-holidays", accountId] }),
  });

  const seedBrazilianHolidays = useMutation({
    mutationFn: async (year: number) => {
      if (!accountId) throw new Error("Sem conta");
      const rows = BR_HOLIDAYS_SEED.map((h) => ({
        account_id: accountId,
        date: `${year}-${h.date.slice(5)}`,
        name: h.name,
        recurring: true,
      }));
      const { error } = await supabase
        .from("custom_followup_holidays" as any)
        .upsert(rows, { onConflict: "account_id,date,name", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-followup-holidays", accountId] });
      toast.success("Feriados nacionais importados");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { holidaysQuery, createHoliday, deleteHoliday, seedBrazilianHolidays };
}