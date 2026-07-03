import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSystemWaProvider, type SystemWaProvider } from "@/hooks/useSystemWaProvider";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Zap, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type InstanceRow = {
  id: string;
  instance_name: string;
  display_name: string | null;
  provider: string | null;
  status: string | null;
  account_id: string | null;
};

export default function AdminWhatsAppProvider() {
  const { provider, isLoading, updatedAt, setProvider, isSaving } = useSystemWaProvider();
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");

  const options: { value: SystemWaProvider; label: string; sub: string; icon: typeof Smartphone }[] = [
    { value: "evolution", label: "Evolution API", sub: "Padrão atual — legado", icon: Smartphone },
    { value: "waha", label: "WAHA (beta)", sub: "Novo provedor — em migração", icon: Zap },
  ];

  async function reload() {
    setLoadingList(true);
    const { data } = await (supabase as any)
      .from("whatsapp_instances")
      .select("id, instance_name, display_name, provider, status, account_id")
      .order("updated_at", { ascending: false })
      .limit(500);
    setInstances((data as InstanceRow[]) || []);
    setLoadingList(false);
  }

  useEffect(() => { reload(); }, []);

  async function switchInstance(row: InstanceRow, target: "evolution" | "waha") {
    if (row.provider === target) return;
    const confirmMsg =
      `Trocar a instância "${row.display_name || row.instance_name}" para ${target === "waha" ? "WAHA" : "Evolution API"}?\n\n` +
      `O cliente precisará escanear o QR Code novamente para o novo provedor.`;
    if (!confirm(confirmMsg)) return;
    const { data: updated, error } = await (supabase as any)
      .from("whatsapp_instances")
      .update({ provider: target, status: "disconnected", qr_code_base64: null, pairing_code: null })
      .eq("id", row.id)
      .select("id, provider");
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    if (!updated || updated.length === 0) {
      toast.error("Nada foi alterado. Sua conta não tem permissão para trocar esta instância (RLS bloqueou).");
      return;
    }
    toast.success(`Provedor alterado para ${updated[0].provider.toUpperCase()}. Peça ao cliente para reconectar.`);
    reload();
  }

  const filtered = instances.filter((i) =>
    !search ? true : `${i.instance_name} ${i.display_name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Provedor WhatsApp</h1>
          <p className="text-sm text-slate-400 mt-1">
            Escolha qual API o sistema usa como padrão para novos cadastros e, se precisar, migre instâncias individuais.
          </p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Provedor padrão para novos cadastros</CardTitle>
            <CardDescription className="text-slate-400">
              Só afeta instâncias criadas a partir de agora. Instâncias existentes continuam no provedor atual até serem migradas na lista abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((opt) => {
                  const Icon = opt.icon;
                  const active = provider === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => !active && setProvider(opt.value)}
                      disabled={isSaving || active}
                      className={cn(
                        "relative rounded-lg border p-5 text-left transition-all",
                        active
                          ? "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/30"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-md flex items-center justify-center",
                            active ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-300",
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className={cn("font-semibold", active ? "text-amber-300" : "text-white")}>
                              {opt.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                          </div>
                        </div>
                        {active && <CheckCircle2 className="h-5 w-5 text-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {updatedAt && (
              <div className="text-xs text-slate-500">
                Última atualização: {new Date(updatedAt).toLocaleString("pt-BR")}
              </div>
            )}

            <div className="text-xs text-slate-500 border-t border-slate-800 pt-4 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                Para ativar WAHA você precisa dos secrets <code className="text-amber-300">WAHA_API_URL</code> e{" "}
                <code className="text-amber-300">WAHA_API_KEY</code> configurados. Sem eles, novas instâncias em WAHA não conseguirão conectar.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Instâncias ativas</CardTitle>
            <CardDescription className="text-slate-400">
              Troque o provedor de uma instância específica. Ao trocar, o cliente precisará escanear novamente o QR Code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />

            {loadingList ? (
              <div className="flex items-center gap-2 text-slate-400 py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando instâncias...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">Nenhuma instância encontrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-amber-400/70 uppercase text-xs font-semibold">
                      <th className="text-left py-2 px-3">Instância</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Provedor atual</th>
                      <th className="text-right py-2 px-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const cur = row.provider === "waha" ? "waha" : "evolution";
                      return (
                        <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                          <td className="py-2 px-3">
                            <div className="text-white">{row.display_name || row.instance_name}</div>
                            <div className="text-xs text-slate-500">{row.instance_name}</div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              row.status === "connected" ? "border-emerald-500/50 text-emerald-400" : "border-slate-700 text-slate-400",
                            )}>
                              {row.status || "—"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              cur === "waha" ? "border-amber-500/50 text-amber-400" : "border-slate-700 text-slate-300",
                            )}>
                              {cur === "waha" ? "WAHA" : "Evolution"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              variant="outline" size="sm"
                              className="border-slate-700 text-slate-200 hover:bg-slate-800"
                              onClick={() => switchInstance(row, cur === "waha" ? "evolution" : "waha")}
                            >
                              Trocar para {cur === "waha" ? "Evolution" : "WAHA"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
