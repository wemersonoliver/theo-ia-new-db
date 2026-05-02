import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shuffle, Users, AlertCircle } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useRouletteConfig } from "@/hooks/useRouletteConfig";
import { useAccount } from "@/hooks/useAccount";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function RouletteTab() {
  const { isOwner } = useAccount();
  const { members, isLoading: loadingMembers } = useTeamMembers();
  const { config, isLoading: loadingCfg, upsert } = useRouletteConfig();

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m.status === "active"),
    [members],
  );
  const isMultiUser = activeMembers.length >= 2;

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (config?.participant_user_ids && config.participant_user_ids.length > 0) {
      setSelected(config.participant_user_ids);
    } else {
      setSelected(activeMembers.map((m) => m.user_id));
    }
  }, [config, activeMembers]);

  if (loadingMembers || loadingCfg) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isMultiUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Roleta de Atendimento
          </CardTitle>
          <CardDescription>
            Distribui automaticamente os atendimentos transferidos pela IA entre os membros da equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta funcionalidade só fica disponível com <strong>2 ou mais usuários</strong> na conta.
              Convide membros pela aba <strong>Equipe</strong> para habilitar a roleta.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const enabled = !!config?.enabled;

  const toggleParticipant = (userId: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shuffle className="h-5 w-5" />
          Roleta de Atendimento
        </CardTitle>
        <CardDescription>
          Quando a IA transfere uma conversa para humano, ela é distribuída em rodízio entre os membros selecionados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label className="text-base">Roleta ativa</Label>
            <p className="text-sm text-muted-foreground">
              Habilite para começar a distribuir os handoffs automaticamente.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={!isOwner || upsert.isPending}
            onCheckedChange={(v) => upsert.mutate({ enabled: v, participant_user_ids: selected })}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base">Participantes da roleta</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Selecione quais membros devem receber atendimentos. Se nenhum estiver marcado ao salvar, todos participam.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeMembers.map((m) => {
              const checked = selected.includes(m.user_id);
              return (
                <label
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!isOwner}
                    onCheckedChange={(v) => toggleParticipant(m.user_id, !!v)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || m.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {isOwner && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => upsert.mutate({ participant_user_ids: selected })}
                disabled={upsert.isPending}
              >
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar participantes
              </Button>
            </div>
          )}
        </div>

        {config?.last_assigned_at && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Último sorteio: {new Date(config.last_assigned_at).toLocaleString("pt-BR")}
          </div>
        )}

        {!isOwner && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Apenas o dono da conta pode alterar a configuração da roleta.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
