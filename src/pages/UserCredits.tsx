import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserAiCredits } from "@/hooks/useAiCredits";
import { DollarSign, Volume2, TrendingDown, ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UserCredits() {
  const { credits, transactions, isLoading, loadingTx } = useUserAiCredits();

  if (isLoading) {
    return (
      <DashboardLayout title="Créditos de Voz IA" description="Seu saldo e histórico de uso">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!credits) {
    return (
      <DashboardLayout title="Créditos de Voz IA" description="Seu saldo e histórico de uso">
        <Card>
          <CardContent className="py-12 text-center">
            <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Recurso de Voz IA</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              O recurso de voz IA permite que seu agente envie respostas em áudio pelo WhatsApp.
              Entre em contato com o suporte para ativar este recurso e adicionar créditos.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Créditos de Voz IA" description="Seu saldo e histórico de uso">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Disponível</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${(credits.balance_cents / 100).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                ~R$ {((credits.balance_cents / 100) * 5.5).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Adicionado</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${(credits.total_added_cents / 100).toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Consumido</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${(credits.total_consumed_cents / 100).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Status */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Volume2 className={`h-5 w-5 ${credits.voice_enabled ? "text-green-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">
                  Voz IA: {credits.voice_enabled ? "Ativada" : "Desativada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {credits.voice_enabled
                    ? "Seu agente enviará respostas em áudio quando aplicável"
                    : "Entre em contato com o suporte para ativar"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Histórico de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTx ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {tx.type === "credit" ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm">{tx.description || (tx.type === "credit" ? "Recarga" : "Consumo")}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${tx.type === "credit" ? "text-green-500" : "text-orange-500"}`}>
                        {tx.type === "credit" ? "+" : "-"}${(tx.amount_cents / 100).toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: ${(tx.balance_after_cents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma transação registrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
