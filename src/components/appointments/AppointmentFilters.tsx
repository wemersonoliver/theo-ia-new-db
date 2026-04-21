import { useMemo } from "react";
import { Search, Users, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import { getAssigneeColor, getInitials } from "@/lib/assignee-colors";

export type StatusFilter = "scheduled" | "confirmed" | "completed" | "cancelled";

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "scheduled", label: "Agendado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

interface Props {
  selectedAssignees: string[]; // user_ids; vazio = todos
  onAssigneesChange: (ids: string[]) => void;
  selectedStatuses: StatusFilter[]; // vazio = todos
  onStatusesChange: (s: StatusFilter[]) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function AppointmentFilters({
  selectedAssignees,
  onAssigneesChange,
  selectedStatuses,
  onStatusesChange,
  search,
  onSearchChange,
}: Props) {
  const { user } = useAuth();
  const { isOwner, isManager } = useAccount();
  const { members } = useTeamMembers();

  const canSeeAll = isOwner || isManager;

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m.status === "active"),
    [members]
  );

  const toggleAssignee = (id: string) => {
    if (!canSeeAll) return;
    if (selectedAssignees.includes(id)) {
      onAssigneesChange(selectedAssignees.filter((x) => x !== id));
    } else {
      onAssigneesChange([...selectedAssignees, id]);
    }
  };

  const toggleStatus = (s: StatusFilter) => {
    if (selectedStatuses.includes(s)) {
      onStatusesChange(selectedStatuses.filter((x) => x !== s));
    } else {
      onStatusesChange([...selectedStatuses, s]);
    }
  };

  const assigneeLabel = !canSeeAll
    ? "Meus agendamentos"
    : selectedAssignees.length === 0
      ? "Toda a equipe"
      : `${selectedAssignees.length} selecionado${selectedAssignees.length > 1 ? "s" : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Responsável */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2" disabled={!canSeeAll}>
            <Users className="h-4 w-4" />
            <span className="text-xs">{assigneeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">Responsáveis</span>
            {selectedAssignees.length > 0 && (
              <button
                onClick={() => onAssigneesChange([])}
                className="text-xs text-primary hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            <button
              onClick={() => onAssigneesChange([])}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent ${
                selectedAssignees.length === 0 ? "bg-accent" : ""
              }`}
            >
              <div className="h-5 w-5 rounded-full bg-muted" />
              <span>Toda a equipe</span>
            </button>
            {activeMembers.map((m) => {
              const color = getAssigneeColor(m.user_id);
              const checked = selectedAssignees.includes(m.user_id);
              return (
                <label
                  key={m.user_id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleAssignee(m.user_id)} />
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: color.dot, color: "white" }}
                  >
                    {getInitials(m.full_name || m.email)}
                  </div>
                  <span className="flex-1 truncate">
                    {m.full_name || m.email}
                    {m.user_id === user?.id && " (você)"}
                  </span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status chips */}
      <div className="flex items-center gap-1">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {STATUSES.map((s) => {
          const active = selectedStatuses.includes(s.value);
          return (
            <button
              key={s.value}
              onClick={() => toggleStatus(s.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        {selectedStatuses.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onStatusesChange([])}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="relative ml-auto flex-1 min-w-[180px] max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar nome, telefone..."
          className="h-9 pl-8"
        />
      </div>
    </div>
  );
}