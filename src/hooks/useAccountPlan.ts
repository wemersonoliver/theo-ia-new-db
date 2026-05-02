import { useUserSubscription } from "@/hooks/useSubscriptions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PlanTier = "trial" | "basic" | "pro" | "tester";

export function useAccountPlan() {
  const { data: subscription, isLoading } = useUserSubscription();
  const { user } = useAuth();

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Mapeia plan_type da assinatura ativa em tier. Sem assinatura ativa => trial.
  const planType = subscription?.plan_type?.toLowerCase() || "";
  const tier: PlanTier = isSuperAdmin
    ? "tester"
    : planType.includes("tester")
    ? "tester"
    : planType.includes("pro")
      ? "pro"
      : planType.includes("basic")
        ? "basic"
        : "trial";

  // Tester tem acesso completo (equivalente ao Pro ou superior)
  const maxInstances = tier === "pro" || tier === "tester" ? 3 : 1;

  return { tier, maxInstances, isLoading };
}