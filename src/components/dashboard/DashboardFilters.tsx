import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCRMPipelines } from "@/hooks/useCRMPipelines";

export type PeriodPreset = "today" | "7d" | "30d" | "month";

interface Props {
  period: PeriodPreset;
  onPeriod: (p: PeriodPreset) => void;
  sellerId: string;
  onSeller: (id: string) => void;
  pipelineId: string;
  onPipeline: (id: string) => void;
}

export function DashboardFilters({ period, onPeriod, sellerId, onSeller, pipelineId, onPipeline }: Props) {
  const { members } = useTeamMembers();
  const { pipelines } = useCRMPipelines();

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <Select value={period} onValueChange={(v) => onPeriod(v as PeriodPreset)}>
        <SelectTrigger className="w-full sm:w-[140px] min-w-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="7d">7 dias</SelectItem>
          <SelectItem value="30d">30 dias</SelectItem>
          <SelectItem value="month">Mês atual</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sellerId} onValueChange={onSeller}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[180px] min-w-0"><SelectValue placeholder="Atendente" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os atendentes</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || "Sem nome"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={pipelineId} onValueChange={onPipeline}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[180px] min-w-0"><SelectValue placeholder="Funil" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os funis</SelectItem>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}