import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAIConfig } from "@/hooks/useAIConfig";
import { AlertTriangle, Bell, Loader2 } from "lucide-react";

const DEFAULT_TEMPLATE =
  "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}.\n\nPor favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.";

export function RemindersTab() {
  const { config, isLoading, saveConfig } = useAIConfig();

  const [formData, setFormData] = useState({
    reminder_enabled: false,
    reminder_hours_before: 2,
    reminder_message_template: DEFAULT_TEMPLATE,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        reminder_enabled: config.reminder_enabled || false,
        reminder_hours_before: config.reminder_hours_before || 2,
        reminder_message_template: config.reminder_message_template || DEFAULT_TEMPLATE,
      });
    }
  }, [config]);

  const handleSave = () =>
    saveConfig.mutate({
      reminder_enabled: formData.reminder_enabled,
      reminder_hours_before: formData.reminder_hours_before,
      reminder_message_template: formData.reminder_message_template,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const templateHasHardcodedDay =
    /\b(hoje|amanhã|amanha)\b/i.test(formData.reminder_message_template || "") &&
    !/\{dia_referencia\}/i.test(formData.reminder_message_template || "");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Lembretes Automáticos
              </CardTitle>
              <CardDescription>
                Envie lembretes automáticos antes dos agendamentos via WhatsApp
              </CardDescription>
            </div>
            <Switch
              checked={formData.reminder_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, reminder_enabled: checked })
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.reminder_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reminder_hours">Horas antes do agendamento</Label>
                <Input
                  id="reminder_hours"
                  type="number"
                  value={formData.reminder_hours_before}
                  onChange={(e) =>
                    setFormData({ ...formData, reminder_hours_before: parseInt(e.target.value) || 2 })
                  }
                  min={1}
                  max={24}
                />
                <p className="text-sm text-muted-foreground">
                  Define quantas horas antes do agendamento o lembrete será enviado.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder_template">Mensagem do Lembrete</Label>
                <Textarea
                  id="reminder_template"
                  value={formData.reminder_message_template}
                  onChange={(e) =>
                    setFormData({ ...formData, reminder_message_template: e.target.value })
                  }
                  placeholder="Mensagem do lembrete..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Variáveis disponíveis: {"{nome}"}, {"{hora}"}, {"{dia_referencia}"} (hoje/amanhã),
                  {" "}{"{dia_semana}"}, {"{data_curta}"} (DD/MM), {"{data_br}"} (DD/MM/AAAA),
                  {" "}{"{titulo}"}, {"{data}"}
                </p>
                <p className="text-xs text-muted-foreground">
                  O sistema sempre acrescenta ao final da mensagem uma linha com o dia da semana e a data real do agendamento.
                </p>
                {templateHasHardcodedDay && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Você escreveu <strong>hoje</strong> ou <strong>amanhã</strong> direto no texto. Prefira usar{" "}
                      <code className="rounded bg-background/40 px-1">{"{dia_referencia}"}</code> — o sistema envia
                      lembretes tanto no dia quanto na véspera, e palavras fixas podem sair erradas.
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <h4 className="font-medium text-sm">⏰ Lógica Inteligente de Envio</h4>
                <p className="text-sm text-muted-foreground">
                  Se o horário calculado do lembrete cair fora do horário comercial, o sistema enviará o
                  lembrete automaticamente <strong>no dia anterior</strong>, 2 horas antes do fim do expediente.
                </p>
                <p className="text-sm text-muted-foreground">
                  Lembretes enviados no <strong>dia anterior</strong> ao agendamento são disparados no máximo
                  até <strong>18:00 (horário de Brasília)</strong>, inclusive aos domingos.
                </p>
                <p className="text-sm text-muted-foreground">
                  Quando o cliente confirmar respondendo "SIM" ou similar, a IA marcará automaticamente o
                  agendamento como <strong>confirmado</strong>.
                </p>
              </div>
            </>
          )}

          {!formData.reminder_enabled && (
            <p className="text-sm text-muted-foreground">
              Ative o switch acima para configurar os lembretes automáticos de agendamento.
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveConfig.isPending}>
        {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
}