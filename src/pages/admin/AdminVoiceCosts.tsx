import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Volume2, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VoiceUsageRecord {
  id: string;
  user_id: string | null;
  phone: string;
  characters_count: number;
  cost_cents: number;
  source: string;
  created_at: string;
}

export default function AdminVoiceCosts() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "today":
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case "week":
        return { from: subDays(now, 7).toISOString(), to: now.toISOString() };
      case "month":
        return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    }
  };

  const { data: usage, isLoading } = useQuery({
    queryKey: ["ai-voice-usage", period],
    queryFn: async () => {
      const range = getDateRange();
      const { data, error } = await (supabase as any)
        .from("ai_voice_usage")
        .select("*")
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as VoiceUsageRecord[];
    },
  });

  const totalChars = usage?.reduce((s, r) => s + r.characters_count, 0) || 0;
  const totalCostCents = usage?.reduce((s, r) => s + r.cost_cents, 0) || 0;
  const supportUsage = usage?.filter((r) => r.source === "support") || [];
  const userUsage = usage?.filter((r) => r.source === "user_agent") || [];
  const totalRequests = usage?.length || 0;

  const costUSD = (totalCostCents / 100).toFixed(2);
  const costBRL = ((totalCostCents / 100) * 5.5).toFixed(2); // approx

  const periodLabels = { today: "Hoje", week: "Últimos 7 dias", month: "Este mês" };

  return (
    <AdminLayout title="Custos de Voz IA" description="Acompanhe o uso e custos do ElevenLabs TTS">
      <div className="space-y-6">
        {/* Period selector */}
        <div className="flex gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? "bg-amber-500 text-black"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-slate-700/50 bg-slate-900/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Total de Caracteres</CardTitle>
                  <Volume2 className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">{totalChars.toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-900/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Custo Estimado (USD)</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">${costUSD}</p>
                  <p className="text-xs text-slate-500">~R$ {costBRL}</p>
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-900/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Requisições TTS</CardTitle>
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">{totalRequests}</p>
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-slate-900/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Suporte vs Usuários</CardTitle>
                  <Calendar className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white">
                    <span className="text-amber-400">{supportUsage.length}</span> suporte
                    {" / "}
                    <span className="text-blue-400">{userUsage.length}</span> usuários
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent usage table */}
            <Card className="border-slate-700/50 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-white text-sm">Histórico de Uso — {periodLabels[period]}</CardTitle>
              </CardHeader>
              <CardContent>
                {usage && usage.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-left py-2 px-2">Telefone</th>
                          <th className="text-left py-2 px-2">Fonte</th>
                          <th className="text-right py-2 px-2">Caracteres</th>
                          <th className="text-right py-2 px-2">Custo (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.slice(0, 50).map((r) => (
                          <tr key={r.id} className="border-b border-slate-800 text-slate-300">
                            <td className="py-2 px-2 text-xs">
                              {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">{r.phone}</td>
                            <td className="py-2 px-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                r.source === "support"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}>
                                {r.source === "support" ? "Suporte" : "Usuário"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">{r.characters_count.toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-2 text-right">${(r.cost_cents / 100).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Nenhum uso de TTS registrado neste período.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
