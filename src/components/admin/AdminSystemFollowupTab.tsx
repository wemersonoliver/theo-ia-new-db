import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useSystemFollowupConfig } from "@/hooks/useSystemFollowupConfig";
import {
  Loader2, Repeat, Clock, Target, TrendingUp, Users, XCircle,
  CheckCircle2, Sun, Moon, Swords,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

export function AdminSystemFollowupTab() {
  const { config, configLoading, saveConfig, analytics, trackings } = useSystemFollowupConfig();

  const [formData, setFormData] = useState({
    enabled: false,
    inactivity_hours: 24,
    max_days: 6,
    morning_window_start: "08:00",
    morning_window_end: "12:00",
    evening_window_start: "13:00",
    evening_window_end: "19:00",
    bargaining_tools: "",
    exclude_handoff: true,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        enabled: config.enabled ?? false,
        inactivity_hours: config.inactivity_hours ?? 24,
        max_days: config.max_days ?? 6,
        morning_window_start: config.morning_window_start ?? "08:00",
        morning_window_end: config.morning_window_end ?? "12:00",
        evening_window_start: config.evening_window_start ?? "13:00",
        evening_window_end: config.evening_window_end ?? "19:00",
        bargaining_tools: config.bargaining_tools ?? "",
        exclude_handoff: config.exclude_handoff ?? true,
      });
    }
  }, [config]);

  const handleSave = () => saveConfig.mutate(formData);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const totalReactivated = analytics?.totalEngaged || 0;
  const totalTracked =
    (analytics?.totalPending || 0) + totalReactivated +
    (analytics?.totalExhausted || 0) + (analytics?.totalDeclined || 0);
  const reactivationRate = totalTracked > 0 ? Math.round((totalReactivated / totalTracked) * 100) : 0;

  const chartColors = [
    "hsl(var(--primary))",
    "hsl(var(--primary) / 0.85)",
    "hsl(var(--primary) / 0.7)",
    "hsl(var(--primary) / 0.55)",
    "hsl(var(--accent))",
    "hsl(var(--accent) / 0.8)",
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <Repeat className="h-5 w-5" />
                Follow-Up Automático do Suporte
              </CardTitle>
              <CardDescription className="text-slate-400">
                Reative leads inativos do suporte com cadência inteligente baseada em psicologia de vendas
              </CardDescription>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {formData.enabled ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Clock className="h-4 w-4" /> Minutos de inatividade para iniciar
                  </Label>
                  <Input
                    type="number"
                    value={formData.inactivity_hours}
                    onChange={(e) => setFormData({ ...formData, inactivity_hours: parseInt(e.target.value) || 60 })}
                    min={1}
                    max={10080}
                  />
                  <p className="text-xs text-slate-500">Após esse tempo sem resposta, o follow-up inicia.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Target className="h-4 w-4" /> Máximo de dias de cadência
                  </Label>
                  <Input
                    type="number"
                    value={formData.max_days}
                    onChange={(e) => setFormData({ ...formData, max_days: parseInt(e.target.value) || 6 })}
                    min={1}
                    max={15}
                  />
                  <p className="text-xs text-slate-500">
                    2 disparos/dia × {formData.max_days} dias = {formData.max_days * 2} tentativas
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 p-4 space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2 text-slate-200">
                  <Sun className="h-4 w-4 text-amber-400" /> Janela da Manhã
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Início</Label>
                    <Input type="time" value={formData.morning_window_start}
                      onChange={(e) => setFormData({ ...formData, morning_window_start: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Fim</Label>
                    <Input type="time" value={formData.morning_window_end}
                      onChange={(e) => setFormData({ ...formData, morning_window_end: e.target.value })} />
                  </div>
                </div>
                <h4 className="font-medium text-sm flex items-center gap-2 pt-2 text-slate-200">
                  <Moon className="h-4 w-4 text-indigo-400" /> Janela da Tarde
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Início</Label>
                    <Input type="time" value={formData.evening_window_start}
                      onChange={(e) => setFormData({ ...formData, evening_window_start: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Fim</Label>
                    <Input type="time" value={formData.evening_window_end}
                      onChange={(e) => setFormData({ ...formData, evening_window_end: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  💡 Horários aleatórios dentro das janelas para simular comportamento humano.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-300">
                  <Swords className="h-4 w-4 text-amber-400" />
                  Armas de Negociação (Dias {Math.max(formData.max_days - 1, 1)}-{formData.max_days})
                </Label>
                <Textarea
                  value={formData.bargaining_tools}
                  onChange={(e) => setFormData({ ...formData, bargaining_tools: e.target.value })}
                  placeholder="Ex: 10% de desconto na primeira mensalidade, demo personalizada com o time, bônus de créditos de IA..."
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  🎯 Usadas SOMENTE nos últimos 2 dias da cadência como cartada final.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">Excluir conversas transferidas</p>
                  <p className="text-xs text-slate-500">
                    Não iniciar follow-up em conversas com IA desativada (handoff humano).
                  </p>
                </div>
                <Switch
                  checked={formData.exclude_handoff}
                  onCheckedChange={(checked) => setFormData({ ...formData, exclude_handoff: checked })}
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center space-y-2">
              <Repeat className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-sm text-slate-400">
                Ative o Follow-Up Automático para reengajar leads que pararam de responder ao suporte.
              </p>
              <p className="text-xs text-slate-500">
                A IA do Theo usará técnicas de persuasão (Cialdini + Chris Voss) em uma cadência de até 6 dias.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saveConfig.isPending}
        className="bg-amber-500 text-black hover:bg-amber-400"
      >
        {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>

      {formData.enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-500/10 p-2"><Users className="h-4 w-4 text-amber-400" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{analytics?.totalPending || 0}</p>
                    <p className="text-xs text-slate-500">Em Follow-Up</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-500/10 p-2"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{analytics?.totalEngaged || 0}</p>
                    <p className="text-xs text-slate-500">Reativados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-500/10 p-2"><XCircle className="h-4 w-4 text-red-400" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{analytics?.totalExhausted || 0}</p>
                    <p className="text-xs text-slate-500">Sem Resposta</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-500/10 p-2"><TrendingUp className="h-4 w-4 text-amber-400" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-100">{reactivationRate}%</p>
                    <p className="text-xs text-slate-500">Taxa de Reativação</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-200">Reativação por Dia</CardTitle>
                <CardDescription className="text-slate-500">Em qual dia da cadência os leads mais respondem</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.reactivationByDay && analytics.reactivationByDay.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.reactivationByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-800" />
                      <XAxis dataKey="day" tickFormatter={(v) => `Dia ${v}`} className="text-xs" />
                      <YAxis allowDecimals={false} className="text-xs" />
                      <Tooltip
                        labelFormatter={(v) => `Dia ${v}`}
                        formatter={(v: number) => [`${v} leads`, "Reativados"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {analytics.reactivationByDay.map((_, index) => (
                          <Cell key={index} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
                    Dados aparecerão quando houver leads reativados
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-200">Mapa de Calor por Turno</CardTitle>
                <CardDescription className="text-slate-500">Qual turno gera mais respostas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Sun className="h-5 w-5 text-amber-400" />
                      <span className="text-sm font-medium text-slate-300">Manhã</span>
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 rounded-full bg-slate-800 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500/80 transition-all duration-500"
                          style={{
                            width: `${analytics?.heatmap
                              ? (analytics.heatmap.morning / Math.max(analytics.heatmap.morning + analytics.heatmap.afternoon, 1)) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold w-8 text-right text-slate-200">{analytics?.heatmap?.morning || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Moon className="h-5 w-5 text-indigo-400" />
                      <span className="text-sm font-medium text-slate-300">Tarde</span>
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 rounded-full bg-slate-800 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-400/80 transition-all duration-500"
                          style={{
                            width: `${analytics?.heatmap
                              ? (analytics.heatmap.afternoon / Math.max(analytics.heatmap.morning + analytics.heatmap.afternoon, 1)) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold w-8 text-right text-slate-200">{analytics?.heatmap?.afternoon || 0}</span>
                  </div>
                  {(analytics?.heatmap?.morning || 0) + (analytics?.heatmap?.afternoon || 0) === 0 && (
                    <p className="text-xs text-slate-500 text-center pt-4">
                      Dados aparecerão quando houver leads reativados
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {trackings && trackings.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-200">Follow-Ups Ativos</CardTitle>
                <CardDescription className="text-slate-500">Leads em cadência de reativação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trackings.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-300">{t.phone}</span>
                        <Badge
                          variant={t.status === "engaged" ? "default" : t.status === "exhausted" ? "destructive" : "secondary"}
                        >
                          {t.status === "pending" ? "Em andamento"
                            : t.status === "engaged" ? "Reativado ✓"
                            : t.status === "exhausted" ? "Sem resposta"
                            : t.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        Etapa {t.current_step}/{(config?.max_days || 6) * 2} · Dia {Math.ceil(t.current_step / 2)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}