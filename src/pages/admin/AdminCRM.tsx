import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminKanbanBoard } from "@/components/admin/AdminKanbanBoard";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { PipelineSettingsDialog } from "@/components/crm/PipelineSettingsDialog";
import { useAdminCRMPipelines } from "@/hooks/useAdminCRMPipelines";
import { useAdminCRMStages } from "@/hooks/useAdminCRMStages";
import { useAdminCRMDeals } from "@/hooks/useAdminCRMDeals";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminCRM() {
  const { pipelines, activePipelineId, setActivePipelineId, loading: pipelinesLoading, createPipeline, renamePipeline, deletePipeline } = useAdminCRMPipelines();
  const { stages, loading: stagesLoading, addStage, updateStage, deleteStage } = useAdminCRMStages(activePipelineId);
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const { deals, loading: dealsLoading, createDeal, updateDeal, moveDeal, deleteDeal } = useAdminCRMDeals(activePipelineId, stageIds);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const activePipeline = useMemo(() => pipelines.find(p => p.id === activePipelineId) || null, [pipelines, activePipelineId]);

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  // Stats
  const totalDeals = deals.length;
  const onboardedCount = deals.filter(d => d.onboarding_completed).length;
  const activeSubsCount = deals.filter(d => d.subscription_status === "active").length;

  return (
    <AdminLayout title="CRM" description="Gestão do ciclo de vida dos clientes">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-6">
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
          <PipelineSelector
            pipelines={pipelines as any}
            activePipelineId={activePipelineId}
            onSelect={setActivePipelineId}
            onCreate={createPipeline}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <AdminKanbanBoard
            stages={stages}
            deals={deals}
            onCreateDeal={createDeal}
            onUpdateDeal={updateDeal}
            onMoveDeal={moveDeal}
            onDeleteDeal={deleteDeal}
          />
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
