import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight, Crown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlans } from "@/hooks/usePlans";

const TRIAL_POLICY_CUTOFF = new Date("2026-05-06T00:00:00Z");
const trialDaysFor = (createdAt: Date) => (createdAt >= TRIAL_POLICY_CUTOFF ? 7 : 15);

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format((cents || 0) / 100);

export function TrialBanner() {
  const { user } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: plans = [] } = usePlans();

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
        .select("accounts!inner(owner_user_id, created_at, trial_extra_days)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const ownerId = (membership as any)?.accounts?.owner_user_id || user.id;
      const trialExtraDays = Number((membership as any)?.accounts?.trial_extra_days ?? 0);

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
        const createdAt = new Date(trialAnchor);
        const diffMs = Date.now() - createdAt.getTime();
        const left = trialDaysFor(createdAt) + trialExtraDays - Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
          <div className="grid gap-4 sm:grid-cols-2 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                  plan.is_recommended ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border"
                }`}
                onClick={() => plan.checkout_url && window.open(plan.checkout_url, "_blank")}
              >
                {plan.is_recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Crown className="mr-1 h-3 w-3" /> Recomendado
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-3 pt-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {plan.name}
                    <Badge variant="outline" className="text-[10px] uppercase">{plan.tier}</Badge>
                  </CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{fmtBRL(plan.price_cents)}</span>
                    <span className="text-muted-foreground">{plan.billing_period === "monthly" ? "/mês" : "/ano"}</span>
                  </div>
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
                      plan.is_recommended
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : ""
                    }`}
                    variant={plan.is_recommended ? "default" : "outline"}
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