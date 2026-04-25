import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAuth } from "@/lib/auth";
import { PlayCircle, Smartphone, Bot } from "lucide-react";
import { TutorialPopup } from "@/components/TutorialPopup";
import { Button } from "@/components/ui/button";
import { TrialBanner } from "@/components/TrialBanner";
import { DashboardFilters, type PeriodPreset } from "@/components/dashboard/DashboardFilters";
import { KPICards } from "@/components/dashboard/KPICards";
import { AvgServiceTimeCard } from "@/components/dashboard/AvgServiceTimeCard";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { GoalsVsActualChart } from "@/components/dashboard/GoalsVsActualChart";
import { SellerPerformanceTable } from "@/components/dashboard/SellerPerformanceTable";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { presetRange } from "@/lib/dashboard-metrics";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { instance } = useWhatsAppInstance();
  const { config } = useAIConfig();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [sellerId, setSellerId] = useState<string>("all");
  const [pipelineId, setPipelineId] = useState<string>("all");

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
  const { metrics } = useDashboardMetrics(range, sellerId, pipelineId);

  return (
    <DashboardLayout title="Dashboard" description="Visão geral do seu atendimento">
      <TrialBanner />
      <TutorialPopup externalOpen={tutorialOpen} onExternalClose={() => setTutorialOpen(false)} />

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-4">
        <DashboardFilters
          period={period}
          onPeriod={setPeriod}
          sellerId={sellerId}
          onSeller={setSellerId}
          pipelineId={pipelineId}
          onPipeline={setPipelineId}
        />
        <Button variant="outline" onClick={() => setTutorialOpen(true)} className="gap-2 w-full sm:w-auto">
          <PlayCircle className="h-4 w-4" />
          Tutorial
        </Button>
      </div>

      <KPICards metrics={metrics} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ConversionFunnel metrics={metrics} />
        <GoalsVsActualChart metrics={metrics} />
        <AvgServiceTimeCard metrics={metrics} />
      </div>

      <div className="mt-4">
        <SellerPerformanceTable metrics={metrics} />
      </div>

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
    </DashboardLayout>
  );
}
