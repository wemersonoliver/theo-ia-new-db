import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, MessageSquare, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useFlowMetrics } from "@/hooks/useFollowupWebhooks";
import { useCustomFollowup } from "@/hooks/useCustomFollowup";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function MetricsPanel() {
  const { flowsQuery } = useCustomFollowup();
  const [flowId, setFlowId] = useState<string>("all");
  const [days, setDays] = useState<string>("30");
  const { data: m, isLoading } = useFlowMetrics(flowId === "all" ? undefined : flowId, Number(days));

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const items = [
    { label: "Inscritos", value: m?.enrolled ?? 0, icon: TrendingUp, tone: "text-primary" },
    { label: "Mensagens enviadas", value: m?.sent ?? 0, icon: MessageSquare, tone: "text-blue-500" },
    { label: "Concluídos", value: m?.completed ?? 0, icon: CheckCircle2, tone: "text-emerald-500" },
    { label: "Pararam ao responder", value: m?.stopped_replied ?? 0, icon: MessageSquare, tone: "text-amber-500" },
    { label: "Pararam por handoff", value: m?.stopped_handoff ?? 0, icon: XCircle, tone: "text-orange-500" },
    { label: "Falhas", value: m?.failed ?? 0, icon: AlertCircle, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Métricas
              </CardTitle>
              <CardDescription>Resumo de desempenho dos seus fluxos.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={flowId} onValueChange={setFlowId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fluxos</SelectItem>
                  {(flowsQuery.data || []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((it) => (
          <Card key={it.label}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className="text-2xl font-semibold mt-1">{isLoading ? "…" : it.value}</div>
              </div>
              <it.icon className={`h-5 w-5 ${it.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Taxa de resposta</div>
            <div className="text-3xl font-semibold mt-1">{m ? pct(m.reply_rate) : "…"}</div>
            <div className="text-xs text-muted-foreground mt-1">% inscritos que responderam.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Taxa de conclusão</div>
            <div className="text-3xl font-semibold mt-1">{m ? pct(m.completion_rate) : "…"}</div>
            <div className="text-xs text-muted-foreground mt-1">% inscritos que completaram todas as etapas.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}