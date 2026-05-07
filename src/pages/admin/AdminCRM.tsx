import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminKanbanBoard } from "@/components/admin/AdminKanbanBoard";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { PipelineSettingsDialog } from "@/components/crm/PipelineSettingsDialog";
import { AdminCRMFilters, EMPTY_ADMIN_FILTERS, useFilteredAdminDeals, type AdminCRMFilterState } from "@/components/admin/AdminCRMFilters";
import { AdminCRMStats } from "@/components/admin/AdminCRMStats";
import { useAdminCRMPipelines } from "@/hooks/useAdminCRMPipelines";
import { useAdminCRMStages } from "@/hooks/useAdminCRMStages";
import { useAdminCRMDeals } from "@/hooks/useAdminCRMDeals";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminCRM() {
  const { pipelines, activePipelineId, setActivePipelineId, loading: pipelinesLoading, createPipeline, renamePipeline, deletePipeline } = useAdminCRMPipelines();
  const { stages, loading: stagesLoading, addStage, updateStage, deleteStage } = useAdminCRMStages(activePipelineId);
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const { deals, loading: dealsLoading, createDeal, updateDeal, moveDeal, deleteDeal, refetch } = useAdminCRMDeals(activePipelineId, stageIds);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState<AdminCRMFilterState>(EMPTY_ADMIN_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const { toast } = useToast();
  const activePipeline = useMemo(() => pipelines.find(p => p.id === activePipelineId) || null, [pipelines, activePipelineId]);

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  const filteredDeals = useFilteredAdminDeals(deals, filters);

  const handleSyncWhatsApp = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-statuses");
      if (error) throw error;
      toast({
        title: "Status sincronizado",
        description: `${data?.updated ?? 0} instâncias atualizadas (${data?.total_evolution ?? 0} na Evolution).`,
      });
      await refetch();
    } catch (e: any) {
      toast({ title: "Falha ao sincronizar", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfillBusiness = async () => {
    if (!confirm("Preencher nome, segmento e resumo dos negócios para todos os deals com entrevista concluída? (não sobrescreve dados já preenchidos)")) return;
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-business-data", { body: { overwrite: false, limit: 200 } });
      if (error) throw error;
      toast({
        title: "Preenchimento concluído",
        description: `Atualizados: ${data?.updated ?? 0} • Pulados: ${data?.skipped ?? 0} • Sem deal: ${data?.missing ?? 0}`,
      });
      await refetch();
    } catch (e: any) {
      toast({ title: "Falha no preenchimento", description: e?.message ?? "Erro", variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  // Stats
  const totalDeals = filteredDeals.length;
  const onboardedCount = filteredDeals.filter(d => d.onboarding_completed).length;
  const activeSubsCount = filteredDeals.filter(d => d.subscription_status === "active").length;

  return (
    <AdminLayout title="CRM" description="Gestão do ciclo de vida dos clientes">
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{totalDeals}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{onboardedCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Onboarding</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{activeSubsCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Assinantes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 lg:justify-end flex-wrap">
            <AdminCRMFilters filters={filters} onChange={setFilters} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncWhatsApp}
              disabled={syncing}
              className="h-9 gap-1.5 bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackfillBusiness}
              disabled={backfilling}
              className="h-9 gap-1.5 bg-amber-600/20 border-amber-600/50 text-amber-200 hover:bg-amber-600/30 hover:text-amber-100"
            >
              <Sparkles className={`h-3.5 w-3.5 ${backfilling ? "animate-pulse" : ""}`} />
              {backfilling ? "Preenchendo..." : "Preencher negócios (IA)"}
            </Button>
            <PipelineSelector
              pipelines={pipelines as any}
              activePipelineId={activePipelineId}
              onSelect={setActivePipelineId}
              onCreate={createPipeline}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
          <AdminCRMStats deals={filteredDeals} stages={stages} />
          <AdminKanbanBoard
            stages={stages}
            deals={filteredDeals}
            onCreateDeal={createDeal}
            onUpdateDeal={updateDeal}
            onMoveDeal={moveDeal}
            onDeleteDeal={deleteDeal}
          />
          </>
        )}
      </div>

      <PipelineSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        pipeline={activePipeline as any}
        stages={stages as any}
        onRenamePipeline={renamePipeline}
        onDeletePipeline={deletePipeline}
        onAddStage={addStage}
        onUpdateStage={updateStage}
        onDeleteStage={deleteStage}
      />
    </AdminLayout>
  );
}
