import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Bot, Loader2, Key, X, Plus, Bell } from "lucide-react";

export { PromptTestTab } from "@/components/ai/PromptTestTab";

export default function AIAgent() {
  const { config, isLoading, saveConfig, toggleActive } = useAIConfig();
  const { flags } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState("reminders");

  const [formData, setFormData] = useState({
    trigger_keywords: [] as string[],
    keyword_activation_enabled: false,
    reminder_enabled: false,
    reminder_hours_before: 2,
    reminder_message_template:
      "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
  });

  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (config) {
      setFormData({
        trigger_keywords: config.trigger_keywords || [],
        keyword_activation_enabled: config.keyword_activation_enabled || false,
        reminder_enabled: config.reminder_enabled || false,
        reminder_hours_before: config.reminder_hours_before || 2,
        reminder_message_template:
          config.reminder_message_template ||
          "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
      });
    }
  }, [config]);

  const handleSave = () => saveConfig.mutate(formData);

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !formData.trigger_keywords.includes(keyword)) {
      setFormData((prev) => ({ ...prev, trigger_keywords: [...prev.trigger_keywords, keyword] }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      trigger_keywords: prev.trigger_keywords.filter((k) => k !== keyword),
    }));
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Agente IA" description="Configure seu agente de atendimento">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Default first tab depends on flag
  const firstTab = flags.keyword_triggers ? "triggers" : "reminders";

  return (
    <DashboardLayout title="Agente IA" description="Configure como seu agente de IA responde às mensagens">
      {/* Toggle Principal */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Agente IA</h3>
              <p className="text-sm text-muted-foreground">
                {config?.active ? "Respondendo mensagens automaticamente" : "Desativado"}
              </p>
            </div>
          </div>
          <Switch
            checked={config?.active || false}
            onCheckedChange={(checked) => toggleActive.mutate(checked)}
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab || firstTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          {flags.keyword_triggers && (
            <TabsTrigger value="triggers" className="min-w-fit">Gatilhos</TabsTrigger>
          )}
          <TabsTrigger value="reminders" className="min-w-fit">Lembretes</TabsTrigger>
        </TabsList>

        {/* GATILHOS */}
        {flags.keyword_triggers && (
          <TabsContent value="triggers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Ativação por Palavras-Chave
                    </CardTitle>
                    <CardDescription>
                      A IA só responderá quando o cliente usar uma dessas palavras
                    </CardDescription>
                  </div>
                  <Switch
                    checked={formData.keyword_activation_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, keyword_activation_enabled: checked })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.keyword_activation_enabled && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="Digite uma palavra-chave..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddKeyword())}
                      />
                      <Button onClick={handleAddKeyword} variant="secondary">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>

                    {formData.trigger_keywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {formData.trigger_keywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="px-3 py-1 text-sm">
                            {keyword}
                            <button
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="ml-2 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma palavra-chave cadastrada. Adicione palavras como: "atendimento", "orçamento", "ajuda", "informação"
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground mt-4">
                      💡 Quando ativado, a IA só iniciará o atendimento se a primeira mensagem do cliente contiver uma das palavras-chave cadastradas.
                    </p>
                  </>
                )}

                {!formData.keyword_activation_enabled && (
                  <p className="text-sm text-muted-foreground">
                    Ative o switch acima para configurar as palavras-chave. Quando desativado, a IA responde a todas as mensagens normalmente.
                  </p>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saveConfig.isPending}>
              {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </TabsContent>
        )}

        {/* LEMBRETES */}
        <TabsContent value="reminders" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
