import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAIConfig } from "@/hooks/useAIConfig";
import { Bell, Loader2 } from "lucide-react";

export function RemindersTab() {
  const { config, isLoading, saveConfig } = useAIConfig();

  const [formData, setFormData] = useState({
    reminder_enabled: false,
    reminder_hours_before: 2,
    reminder_message_template:
      "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        reminder_enabled: config.reminder_enabled || false,
        reminder_hours_before: config.reminder_hours_before || 2,
        reminder_message_template:
          config.reminder_message_template ||
          "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
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
                  Variáveis disponíveis: {"{nome}"}, {"{hora}"}, {"{dia_referencia}"} (hoje/amanhã), {"{titulo}"}, {"{data}"}
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <h4 className="font-medium text-sm">⏰ Lógica Inteligente de Envio</h4>
                <p className="text-sm text-muted-foreground">
                  Se o horário calculado do lembrete cair fora do horário comercial, o sistema enviará o
                  lembrete automaticamente <strong>no dia anterior</strong>, 2 horas antes do fim do expediente.
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