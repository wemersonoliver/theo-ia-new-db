import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface AppointmentBlock {
  id: string;
  account_id: string;
  user_id: string;
  reason: string;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: string;
  days_of_week: number[];
  created_at: string;
  updated_at: string;
}

export interface BlockInput {
  reason: string;
  all_day: boolean;
  recurrence: "none" | "weekly";
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week?: number[];
}

/** Verifica se um bloqueio cobre a data (YYYY-MM-DD) informada. */
export function blockCoversDate(block: AppointmentBlock, dateStr: string): boolean {
  if (block.recurrence === "weekly") {
    const dow = new Date(`${dateStr}T12:00:00`).getDay();
    if (!block.days_of_week?.includes(dow)) return false;
    if (block.start_date && dateStr < block.start_date) return false;
    if (block.end_date && dateStr > block.end_date) return false;
    return true;
  }
  const start = block.start_date;
  const end = block.end_date || block.start_date;
  if (!start) return false;
  return dateStr >= start && dateStr <= (end as string);
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Verifica se um horário (HH:MM) com duração cai dentro de algum bloqueio da data. */
export function findBlockConflict(
  blocks: AppointmentBlock[],
  dateStr: string,
  time?: string | null,
  durationMinutes = 30
): AppointmentBlock | null {
  for (const b of blocks) {
    if (!blockCoversDate(b, dateStr)) continue;
    if (b.all_day || !b.start_time || !b.end_time) return b;
    if (!time) continue;
    const s = toMinutes(b.start_time);
    const e = toMinutes(b.end_time);
    const t = toMinutes(time);
    const tEnd = t + (durationMinutes || 30);
    if (t < e && tEnd > s) return b;
  }
  return null;
}

export function useAppointmentBlocks() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["appointment-blocks", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("appointment_blocks")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching appointment blocks:", error);
        return [];
      }
      return (data || []) as AppointmentBlock[];
    },
    enabled: !!user && !!accountId,
  });

  const createBlock = useMutation({
    mutationFn: async (input: BlockInput) => {
      if (!user || !accountId) throw new Error("Conta não encontrada");
      const { error } = await supabase.from("appointment_blocks").insert({
        account_id: accountId,
        user_id: user.id,
        reason: input.reason?.trim() || "Bloqueado",
        all_day: input.all_day,
        recurrence: input.recurrence,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        start_time: input.all_day ? null : (input.start_time ? `${input.start_time}:00`.slice(0, 8) : null),
        end_time: input.all_day ? null : (input.end_time ? `${input.end_time}:00`.slice(0, 8) : null),
        days_of_week: input.days_of_week ?? [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-blocks"] });
      toast.success("Horário bloqueado!");
    },
    onError: (e: Error) => toast.error(`Erro ao bloquear: ${e.message}`),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointment_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-blocks"] });
      toast.success("Bloqueio removido!");
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });

  return { blocks, isLoading, createBlock, deleteBlock };
}