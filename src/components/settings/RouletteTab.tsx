import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Shuffle, Users, AlertCircle, Clock, Wifi, Hand } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useRouletteConfig } from "@/hooks/useRouletteConfig";
import { useAccount } from "@/hooks/useAccount";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function RouletteTab() {
  const { isOwner, membership } = useAccount();
  const { members, isLoading: loadingMembers } = useTeamMembers();
  const { config, isLoading: loadingCfg, upsert } = useRouletteConfig();
  const qc = useQueryClient();

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m.status === "active"),
    [members],
  );
  const isMultiUser = activeMembers.length >= 2;

  const [selected, setSelected] = useState<string[]>([]);
  const [timeoutMin, setTimeoutMin] = useState<number>(5);

  useEffect(() => {
    if (config?.participant_user_ids && config.participant_user_ids.length > 0) {
      setSelected(config.participant_user_ids);
    } else {
      setSelected(activeMembers.map((m) => m.user_id));
    }
    if (config?.accept_timeout_minutes) {
      setTimeoutMin(config.accept_timeout_minutes);
    }
  }, [config, activeMembers]);

  // Auto-refresh status online a cada 30s
  useEffect(() => {
    if (!isMultiUser) return;
    const id = window.setInterval(
      () => qc.invalidateQueries({ queryKey: ["team-members", membership?.account_id] }),
      30_000,
    );
    return () => window.clearInterval(id);
  }, [isMultiUser, qc, membership?.account_id]);

  const onlineThresholdMs = (config?.online_threshold_seconds ?? 120) * 1000;
  const isOnline = (lastSeen: string | null) =>
    !!lastSeen && Date.now() - new Date(lastSeen).getTime() < onlineThresholdMs;

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
  const requireOnline = !!config?.require_online;
  const requireAcceptance = !!config?.require_acceptance;
  const onlineCount = activeMembers.filter((m) => isOnline(m.last_seen_at)).length;

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

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label className="text-base flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Exigir usuário online
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativo, somente atendentes online no sistema participam do rodízio.
            </p>
          </div>
          <Switch
            checked={requireOnline}
            disabled={!isOwner || upsert.isPending}
            onCheckedChange={(v) => upsert.mutate({ require_online: v })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label className="text-base flex items-center gap-2">
              <Hand className="h-4 w-4" />
              Exigir aceite do atendimento
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando a roleta atribuir um lead, o atendente precisa clicar em <strong>Aceitar</strong> antes de ver a conversa.
              A partir desse momento o lead vira responsabilidade dele e passa a contar nas suas métricas.
            </p>
          </div>
          <Switch
            checked={requireAcceptance}
            disabled={!isOwner || upsert.isPending || !enabled}
            onCheckedChange={(v) => upsert.mutate({ require_acceptance: v })}
          />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo para iniciar o atendimento
            </Label>
            <p className="text-sm text-muted-foreground">
              Se o atendente sorteado não enviar a primeira mensagem dentro deste prazo, perde a vez e o sistema repassa para o próximo da fila.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={60}
              value={timeoutMin}
              disabled={!isOwner}
              onChange={(e) => setTimeoutMin(Math.max(1, Math.min(60, Number(e.target.value) || 5)))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutos</span>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => upsert.mutate({ accept_timeout_minutes: timeoutMin })}
                disabled={upsert.isPending || timeoutMin === config?.accept_timeout_minutes}
              >
                Salvar
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base">Participantes da roleta</Label>
            {requireOnline && (
              <span className="ml-auto text-xs text-muted-foreground">
                {onlineCount} de {activeMembers.length} online
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Selecione quais membros devem receber atendimentos. Se nenhum estiver marcado ao salvar, todos participam.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeMembers.map((m) => {
              const checked = selected.includes(m.user_id);
              const online = isOnline(m.last_seen_at);
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
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                          online ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                        title={online ? "Online agora" : m.last_seen_at ? `Visto em ${new Date(m.last_seen_at).toLocaleString("pt-BR")}` : "Nunca visto"}
                      />
                      <span className="truncate">{m.full_name || m.email}</span>
                    </p>
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
