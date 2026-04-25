import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight, Crown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TRIAL_DAYS = 15;

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

export function TrialBanner() {
  const { user } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin");
      if (roles && roles.length > 0) return;

      // Resolve owner da conta (assinatura/trial são compartilhados)
      const { data: membership } = await supabase
        .from("account_members")
        .select("accounts!inner(owner_user_id, created_at)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const ownerId = (membership as any)?.accounts?.owner_user_id || user.id;

      // Se owner é super_admin, não mostra banner
      if (ownerId !== user.id) {
        const { data: ownerIsSuperAdmin } = await supabase.rpc("has_role", {
          _user_id: ownerId,
          _role: "super_admin",
        });
        if (ownerIsSuperAdmin) return;
      }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", ownerId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (sub) return;

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("user_id", ownerId)
        .maybeSingle();

      const trialAnchor = ownerProfile?.created_at || (membership as any)?.accounts?.created_at;
      if (trialAnchor) {
        const diffMs = Date.now() - new Date(trialAnchor).getTime();
        const left = TRIAL_DAYS - Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (left > 0) {
          setDaysLeft(left);
          setShow(true);
        }
      }
    };
    check();
  }, [user]);

  if (!show || daysLeft === null) return null;

  const urgent = daysLeft <= 3;

  return (
    <>
      <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        urgent
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5 text-foreground"
      }`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {daysLeft === 1
              ? "Último dia do seu teste gratuito!"
              : `Restam ${daysLeft} dias do seu teste gratuito.`}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md shadow-green-600/30 animate-pulse hover:animate-none"
        >
          Assinar agora <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Escolha seu plano</DialogTitle>
            <p className="text-center text-sm text-muted-foreground">
              Continue automatizando seu atendimento com o Theo IA
            </p>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                  plan.recommended ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border"
                }`}
                onClick={() => window.open(plan.url, "_blank")}
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
                      <Badge variant="secondary" className="text-xs">{plan.savings}</Badge>
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
                  <Button
                    className={`w-full mt-2 ${
                      plan.recommended
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : ""
                    }`}
                    variant={plan.recommended ? "default" : "outline"}
                  >
                    Assinar {plan.name} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}