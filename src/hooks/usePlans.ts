import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Plan {
  id: string;
  slug: string;
  name: string;
  tier: "basic" | "pro";
  billing_period: "monthly" | "annual";
  price_cents: number;
  currency: string;
  checkout_url: string | null;
  description: string | null;
  features: string[];
  limits: Record<string, any>;
  is_active: boolean;
  is_recommended: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function usePlans(opts?: { onlyActive?: boolean }) {
  return useQuery({
    queryKey: ["plans", opts?.onlyActive ?? true],
    queryFn: async () => {
      let q = supabase.from("plans" as any).select("*").order("position", { ascending: true });
      if (opts?.onlyActive !== false) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as any[]).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
        limits: p.limits || {},
      })) as Plan[];
    },
  });
}

export function useUpsertPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<Plan> & { id?: string }) => {
      const payload: any = { ...plan };
      if (plan.id) {
        const { error } = await supabase.from("plans" as any).update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar plano"),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano excluído");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });
}