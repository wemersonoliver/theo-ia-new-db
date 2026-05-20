import { useUserSubscription } from "@/hooks/useSubscriptions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PlanTier = "trial" | "basic" | "pro" | "tester" | "igreen";

const TRIAL_POLICY_CUTOFF = new Date("2026-05-06T00:00:00Z");
const trialDaysFor = (createdAt: Date) => (createdAt >= TRIAL_POLICY_CUTOFF ? 7 : 15);

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

  const { data: accountTrialInfo } = useQuery({
    queryKey: ["account-trial-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("account_members")
        .select("account_id, accounts!inner(id, owner_user_id, created_at, pro_trial_activated, pro_trial_activated_at, trial_extra_days)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();
      const acc = (membership as any)?.accounts;
      if (!acc) return null;
      return {
        accountId: acc.id as string,
        ownerUserId: acc.owner_user_id as string,
        accountCreatedAt: acc.created_at as string,
        proTrialActivated: !!acc.pro_trial_activated,
        trialExtraDays: (acc.trial_extra_days as number) ?? 0,
      };
    },
  });

  // Mapeia plan_type da assinatura ativa em tier. Sem assinatura ativa => trial.
  const planType = subscription?.plan_type?.toLowerCase() || "";
  const baseTier: PlanTier = isSuperAdmin
    ? "tester"
    : planType.includes("tester")
    ? "tester"
    : planType.includes("igreen")
    ? "igreen"
    : planType.includes("pro")
      ? "pro"
      : planType.includes("basic")
        ? "basic"
        : "trial";

  // Calcula dias restantes do trial (compartilhado pela conta — usa created_at da account)
  let trialDaysLeft: number | null = null;
  if (baseTier === "trial" && accountTrialInfo?.accountCreatedAt) {
    const createdDate = new Date(accountTrialInfo.accountCreatedAt);
    const diffDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const extra = accountTrialInfo.trialExtraDays ?? 0;
    trialDaysLeft = Math.max(0, trialDaysFor(createdDate) + extra - diffDays);
  }

  const proTrialActive =
    baseTier === "trial" &&
    !!accountTrialInfo?.proTrialActivated &&
    (trialDaysLeft ?? 0) > 0;

  // Tier efetivo: se trial ativou Pro Trial e ainda dentro do período, comporta-se como pro
  const tier: PlanTier = proTrialActive ? "pro" : baseTier;

  // Tester tem acesso completo (equivalente ao Pro ou superior). Igreen permite 2.
  const maxInstances =
    tier === "pro" || tier === "tester" ? 3 : tier === "igreen" ? 2 : 1;

  return {
    tier,
    baseTier,
    maxInstances,
    proTrialActive,
    trialDaysLeft,
    accountId: accountTrialInfo?.accountId ?? null,
    isLoading,
  };
}