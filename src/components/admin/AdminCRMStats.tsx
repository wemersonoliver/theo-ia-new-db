import { useMemo } from "react";
import type { AdminCRMDeal } from "@/hooks/useAdminCRMDeals";
import type { AdminCRMStage } from "@/hooks/useAdminCRMStages";

interface Props {
  deals: AdminCRMDeal[];
  stages: AdminCRMStage[];
}

export function AdminCRMStats({ deals, stages }: Props) {
  const byStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stages) map[s.id] = 0;
    for (const d of deals) map[d.stage_id] = (map[d.stage_id] || 0) + 1;
    return map;
  }, [deals, stages]);

  if (stages.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {stages.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2"
        >
          <p className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
            {s.name}
          </p>
          <p className="text-xl font-bold text-white">{byStage[s.id] || 0}</p>
        </div>
      ))}
    </div>
  );
}