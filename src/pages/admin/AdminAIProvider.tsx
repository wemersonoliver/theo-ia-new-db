import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSystemAIProvider, type SystemAIProvider } from "@/hooks/useSystemAIProvider";
import { Bot, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminAIProvider() {
  const { provider, isLoading, updatedAt, setProvider, isSaving } = useSystemAIProvider();

  const options: { value: SystemAIProvider; label: string; sub: string; icon: typeof Bot }[] = [
    { value: "gemini", label: "Gemini (Google)", sub: "gemini-2.5-flash", icon: Sparkles },
    { value: "openai", label: "OpenAI (GPT)", sub: "gpt-4o-mini", icon: Bot },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Provedor de IA padrão</h1>
          <p className="text-sm text-slate-400 mt-1">
            Escolha qual IA o sistema usará por padrão. A outra será usada automaticamente como fallback em caso de falha.
          </p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">IA atual</CardTitle>
            <CardDescription className="text-slate-400">
              Aplica a todo o atendimento WhatsApp e ao suporte interno. O cache atualiza em até 30 segundos.
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
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-md flex items-center justify-center",
                            active ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-300"
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
                      <div className="mt-3 text-xs text-slate-400">
                        {active ? "IA padrão. A outra é usada como fallback." : "Clique para tornar esta a IA padrão do sistema."}
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

            <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
              <strong className="text-slate-400">Como funciona:</strong> ao receber uma mensagem, o sistema chama a IA escolhida.
              Se ela falhar (timeout, erro, sem créditos), a outra é acionada automaticamente para garantir resposta ao cliente.
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
