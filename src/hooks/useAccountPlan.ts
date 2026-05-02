import { useUserSubscription } from "@/hooks/useSubscriptions";

export type PlanTier = "trial" | "basic" | "pro" | "tester";

export function useAccountPlan() {
  const { data: subscription, isLoading } = useUserSubscription();

  // Mapeia plan_type da assinatura ativa em tier. Sem assinatura ativa => trial.
  const planType = subscription?.plan_type?.toLowerCase() || "";
  const tier: PlanTier = planType.includes("tester")
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