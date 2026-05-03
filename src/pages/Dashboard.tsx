import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAuth } from "@/lib/auth";
import { PlayCircle, Smartphone, Bot, Sparkles, Eye, ArrowLeft, Lock, Rocket } from "lucide-react";
import { TutorialPopup } from "@/components/TutorialPopup";
import { Button } from "@/components/ui/button";
import { TrialBanner } from "@/components/TrialBanner";
import { DashboardFilters, type PeriodPreset } from "@/components/dashboard/DashboardFilters";
import { KPICards } from "@/components/dashboard/KPICards";
import { AvgServiceTimeCard } from "@/components/dashboard/AvgServiceTimeCard";
import { AvgWaitTimeCard } from "@/components/dashboard/AvgWaitTimeCard";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { GoalsVsActualChart } from "@/components/dashboard/GoalsVsActualChart";
import { SellerPerformanceTable } from "@/components/dashboard/SellerPerformanceTable";
import { OnlineUsersCard } from "@/components/dashboard/OnlineUsersCard";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { presetRange } from "@/lib/dashboard-metrics";
import { Badge } from "@/components/ui/badge";
import { useAccountPlan } from "@/hooks/useAccountPlan";
import { usePlans } from "@/hooks/usePlans";
import { MOCK_DASHBOARD_METRICS } from "@/lib/dashboard-mock";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { instance } = useWhatsAppInstance();
  const { config } = useAIConfig();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [sellerId, setSellerId] = useState<string>("all");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [previewAdvanced, setPreviewAdvanced] = useState(false);
  const [activatingProTrial, setActivatingProTrial] = useState(false);
  const { tier, baseTier, proTrialActive, trialDaysLeft, accountId } = useAccountPlan();
  const { data: plans = [] } = usePlans();
  const queryClient = useQueryClient();
  // Trial e Basic veem dashboard reduzida (a menos que trial ative o Pro Trial → tier vira "pro")
  const isBasic = tier === "basic" || tier === "trial";
  const canActivateProTrial = baseTier === "trial" && !proTrialActive && (trialDaysLeft ?? 0) > 0 && !!accountId;
  const proMonthly = plans.find((p) => p.tier === "pro" && p.billing_period === "monthly");
  const proAnnual = plans.find((p) => p.tier === "pro" && p.billing_period === "annual");

  const handleActivateProTrial = async () => {
    if (!accountId) return;
    setActivatingProTrial(true);
    const { error } = await supabase
      .from("accounts")
      .update({ pro_trial_activated: true, pro_trial_activated_at: new Date().toISOString() })
      .eq("id", accountId);
    setActivatingProTrial(false);
    if (error) {
      toast({ title: "Erro ao ativar teste Pro", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["account-trial-info"] });
    setUpgradeOpen(false);
    setPreviewAdvanced(false);
    toast({
      title: "Plano Pro liberado!",
      description: `Você tem acesso a todas as funcionalidades Pro até o fim do seu período de teste${trialDaysLeft ? ` (${trialDaysLeft} dias restantes)` : ""}.`,
    });
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Membros secundários (não-owner) não passam por onboarding
      const { data: ownAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!ownAccount) return;

      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .single();
      if (data && !(data as any).onboarding_completed) {
        navigate("/onboarding", { replace: true });
      }
    })();
  }, [user, navigate]);

  const range = useMemo(() => presetRange(period), [period]);
  const { metrics: realMetrics } = useDashboardMetrics(range, sellerId, pipelineId);
  const showPreview = isBasic && previewAdvanced;
  const showBasicOnly = isBasic && !previewAdvanced;
  const metrics = showPreview ? MOCK_DASHBOARD_METRICS : realMetrics;

  return (
    <DashboardLayout title="Dashboard" description="Visão geral do seu atendimento">
      <TrialBanner />
      <TutorialPopup externalOpen={tutorialOpen} onExternalClose={() => setTutorialOpen(false)} />

      {showPreview && (
        <Card className="mb-4 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-primary" />
              <span className="font-medium">Pré-visualização com dados fictícios</span>
              <span className="text-muted-foreground">— disponível no plano Pro</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewAdvanced(false)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Atualizar agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-4">
        <DashboardFilters
          period={period}
          onPeriod={setPeriod}
          sellerId={sellerId}
          onSeller={setSellerId}
          pipelineId={pipelineId}
          onPipeline={setPipelineId}
        />
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {showBasicOnly && (
            <Button variant="outline" onClick={() => setUpgradeOpen(true)} className="gap-2">
              <Lock className="h-4 w-4" /> Dashboard avançada
            </Button>
          )}
          <Button variant="outline" onClick={() => setTutorialOpen(true)} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Tutorial
          </Button>
        </div>
      </div>

      <KPICards metrics={metrics} variant={showBasicOnly ? "basic" : "full"} />

      {!showBasicOnly && (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ConversionFunnel metrics={metrics} />
            <GoalsVsActualChart metrics={metrics} />
            <AvgServiceTimeCard metrics={metrics} />
          </div>

          <div className="mt-4">
            <AvgWaitTimeCard metrics={metrics} />
          </div>

          <div className="mt-4">
            <OnlineUsersCard />
          </div>

          <div className="mt-4">
            <SellerPerformanceTable metrics={metrics} />
          </div>
        </>
      )}

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <span className="text-sm font-medium text-muted-foreground">Configuração rápida:</span>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">WhatsApp</span>
            <Badge variant={instance?.status === "connected" ? "default" : "destructive"} className={instance?.status === "connected" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" : ""}>
              {instance?.status === "connected" ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Agente IA</span>
            <Badge variant={config?.active ? "default" : "secondary"} className={config?.active ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" : ""}>
              {config?.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Disponível no plano Pro
            </DialogTitle>
            <DialogDescription>
              A dashboard avançada inclui funil de conversão, performance por vendedor, metas vs realizado, tempos médios de atendimento e espera, e muito mais.
            </DialogDescription>
          </DialogHeader>
          {canActivateProTrial && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Rocket className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Testar plano Pro grátis</p>
                    <p className="text-xs text-muted-foreground">
                      Libere todas as funcionalidades Pro até o fim do seu período de teste
                      {trialDaysLeft ? ` (${trialDaysLeft} dias restantes).` : "."}
                    </p>
                  </div>
                </div>
                <Button onClick={handleActivateProTrial} disabled={activatingProTrial}>
                  {activatingProTrial ? "Ativando..." : "Testar Pro grátis"}
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {proMonthly && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pro Mensal</CardTitle>
                  <CardDescription>
                    {(proMonthly.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: proMonthly.currency || "BRL" })}/mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!proMonthly.checkout_url}
                    onClick={() => proMonthly.checkout_url && window.open(proMonthly.checkout_url, "_blank")}>
                    Atualizar agora
                  </Button>
                </CardContent>
              </Card>
            )}
            {proAnnual && (
              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    Pro Anual <Badge>Melhor oferta</Badge>
                  </CardTitle>
                  <CardDescription>
                    {(proAnnual.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: proAnnual.currency || "BRL" })}/ano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!proAnnual.checkout_url}
                    onClick={() => proAnnual.checkout_url && window.open(proAnnual.checkout_url, "_blank")}>
                    Atualizar agora
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Fechar</Button>
            {!previewAdvanced && (
              <Button variant="secondary" onClick={() => { setUpgradeOpen(false); setPreviewAdvanced(true); }}>
                <Eye className="mr-2 h-4 w-4" /> Visualizar dashboard
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
