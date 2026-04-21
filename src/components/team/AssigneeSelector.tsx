import { useMemo } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserCircle2 } from "lucide-react";

interface AssigneeSelectorProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  label?: string;
  compact?: boolean;
}

/**
 * Select de "Responsável" reutilizável.
 * - Owner/Manager: pode escolher qualquer membro ativo (ou ninguém).
 * - Outros: vê quem está atribuído e pode usar "Atribuir a mim".
 */
export function AssigneeSelector({ value, onChange, label = "Responsável", compact }: AssigneeSelectorProps) {
  const { user } = useAuth();
  const { isOwner, isManager, membership } = useAccount();
  const { members } = useTeamMembers();

  const canAssignToOthers = isOwner || isManager;

  const activeMembers = useMemo(
    () => (members || []).filter((m: any) => m.status === "active"),
    [members]
  );

  const currentMember = activeMembers.find((m: any) => m.user_id === value);
  const currentLabel = currentMember
    ? currentMember.full_name || currentMember.email || "Sem nome"
    : value === user?.id
      ? "Você"
      : "Não atribuído";

  // Para usuários sem permissão de reatribuir: exibe info + botão "Atribuir a mim"
  if (!canAssignToOthers) {
    return (
      <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
        {!compact && <Label className="flex items-center gap-1"><UserCircle2 className="h-3.5 w-3.5" /> {label}</Label>}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{currentLabel}</span>
          {value !== user?.id && membership && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onChange(user!.id)}
            >
              Atribuir a mim
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
      {!compact && <Label className="flex items-center gap-1"><UserCircle2 className="h-3.5 w-3.5" /> {label}</Label>}
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? null : v)}
      >
        <SelectTrigger className={compact ? "h-8 w-[180px] text-xs" : ""}>
          <SelectValue placeholder="Não atribuído" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não atribuído</SelectItem>
          {activeMembers.map((m: any) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || m.phone || "Membro"}
              {m.role === "owner" && " (Dono)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}