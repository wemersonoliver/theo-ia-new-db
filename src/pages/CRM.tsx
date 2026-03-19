import { DashboardLayout } from "@/components/DashboardLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { CRMStats } from "@/components/crm/CRMStats";
import { CRMFilters, useFilteredDeals, type CRMFilterState } from "@/components/crm/CRMFilters";
import { useCRMPipelines } from "@/hooks/useCRMPipelines";
import { useCRMStages } from "@/hooks/useCRMStages";
import { useCRMDeals } from "@/hooks/useCRMDeals";
import { useContacts } from "@/hooks/useContacts";
import { useProducts } from "@/hooks/useProducts";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

export default function CRM() {
  const { pipelines, activePipelineId, setActivePipelineId, loading: pipelinesLoading, createPipeline } = useCRMPipelines();
  const { stages, loading: stagesLoading } = useCRMStages(activePipelineId);
  const stageIds = useMemo(() => stages.map((s) => s.id), [stages]);
  const { deals, loading: dealsLoading, createDeal, updateDeal, moveDeal, deleteDeal } = useCRMDeals(activePipelineId, stageIds);
  const { contacts } = useContacts();
  const { products } = useProducts();

  const [filters, setFilters] = useState<CRMFilterState>({ search: "", priorities: [], tags: [], minValue: 0, maxValue: 0 });

  const contactsList = useMemo(
    () => (contacts || []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone })),
    [contacts]
  );

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => d.tags?.forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [deals]);

  const maxDealValue = useMemo(() => Math.max(0, ...deals.map((d) => d.value_cents || 0)), [deals]);

  const filteredDeals = useFilteredDeals(deals, filters);

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  return (
    <DashboardLayout title="CRM">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas negociações no funil de vendas</p>
          </div>
          <PipelineSelector
            pipelines={pipelines}
            activePipelineId={activePipelineId}
            onSelect={setActivePipelineId}
            onCreate={createPipeline}
          />
        </div>

        <CRMFilters
          filters={filters}
          onChange={setFilters}
          availableTags={availableTags}
          maxDealValue={maxDealValue}
        />

        <CRMStats deals={filteredDeals} stages={stages} />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <KanbanBoard
            stages={stages}
            deals={filteredDeals}
            contacts={contactsList}
            onCreateDeal={createDeal}
            onUpdateDeal={updateDeal}
            onMoveDeal={moveDeal}
            onDeleteDeal={deleteDeal}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
