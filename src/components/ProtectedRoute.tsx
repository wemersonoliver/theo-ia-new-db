import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Crown, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TRIAL_DAYS = 15;

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setCheckingAccess(false);
        return;
      }

      // Check if super_admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin");

      if (roles && roles.length > 0) {
        setIsSuperAdmin(true);
        setCheckingAccess(false);
        return;
      }

      // Check active subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (subscription) {
        setHasActiveSubscription(true);
        setCheckingAccess(false);
        return;
      }

      // Check if user is blocked
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_blocked, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.is_blocked) {
        setIsBlocked(true);
        setCheckingAccess(false);
        return;
      }

      // Check trial expiration based on profile created_at
      if (profile?.created_at) {
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const daysLeft = TRIAL_DAYS - diffDays;

        if (daysLeft <= 0) {
          setIsTrialExpired(true);
        } else {
          setTrialDaysLeft(daysLeft);
        }
      }

      setCheckingAccess(false);
    };

    if (!loading) {
      checkAccess();
    }
  }, [user, loading]);

  if (loading || checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show checkout screen for trial expired or blocked users (not super_admin)
  if ((isTrialExpired || isBlocked) && !isSuperAdmin && !hasActiveSubscription) {
    return <CheckoutScreen isBlocked={isBlocked} signOut={signOut} />;
  }

  return <>{children}</>;
}

function CheckoutScreen({ isBlocked, signOut }: { isBlocked: boolean; signOut: () => Promise<void> }) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual" | null>(null);

  const plans = [
    {
      id: "monthly" as const,
      name: "Plano Mensal",
      price: "R$ 97",
      period: "/mês",
      url: "https://pay.kiwify.com.br/AdpFbz3",
      features: [
        "Atendimento IA 24/7",
        "Agendamento automático",
        "Base de conhecimento",
        "Lembretes automáticos",
        "Suporte prioritário",
      ],
    },
    {
      id: "annual" as const,
      name: "Plano Anual",
      price: "R$ 997",
      period: "/ano",
      originalPrice: "R$ 1.164",
      savings: "Economize R$ 167",
      url: "https://pay.kiwify.com.br/bpNMdQ0",
      features: [
        "Tudo do plano mensal",
        "2 meses grátis",
        "Prioridade em novidades",
        "Suporte VIP",
        "Preço garantido por 12 meses",
      ],
      recommended: true,
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            {isBlocked ? (
              <AlertTriangle className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isBlocked ? "Acesso Bloqueado" : "Seu período de teste terminou"}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isBlocked
              ? "Sua assinatura não está ativa. Escolha um plano para continuar usando o Theo IA."
              : "Seus 15 dias gratuitos acabaram! Escolha um plano para continuar automatizando seu atendimento."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative cursor-pointer transition-all duration-200 ${
                selectedPlan === plan.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              } ${plan.recommended ? "shadow-lg" : ""}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Crown className="mr-1 h-3 w-3" /> Mais Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                {plan.originalPrice && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">{plan.originalPrice}</span>
                    <Badge variant="secondary" className="text-xs">
                      {plan.savings}
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="w-full max-w-md h-12 text-base"
            disabled={!selectedPlan}
            onClick={() => {
              const plan = plans.find((p) => p.id === selectedPlan);
              if (plan) {
                window.open(plan.url, "_blank");
              }
            }}
          >
            {selectedPlan
              ? `Assinar ${selectedPlan === "monthly" ? "Plano Mensal" : "Plano Anual"}`
              : "Selecione um plano"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-muted-foreground">
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
