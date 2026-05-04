import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Timer } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useEffect, useState } from "react";

export function AIGeneralTab() {
  const { config, saveConfig } = useAIConfig();
  const [formData, setFormData] = useState({
    agent_name: "Assistente Virtual",
    business_niche: "",
    business_description: "",
    custom_prompt: "",
    max_messages_without_human: 10,
    response_delay_seconds: 5,
    handoff_message: "Um momento, vou transferir você para um atendente.",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        agent_name: config.agent_name || "Assistente Virtual",
        business_niche: config.business_niche || "",
        business_description: config.business_description || "",
        custom_prompt: config.custom_prompt || "",
        max_messages_without_human: config.max_messages_without_human || 10,
        response_delay_seconds: config.response_delay_seconds ?? 5,
        handoff_message: config.handoff_message || "",
      });
    }
  }, [config]);

  const handleSave = () => saveConfig.mutate(formData);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Agente</CardTitle>
          <CardDescription>Personalize o comportamento do seu agente IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent_name">Nome do Agente</Label>
            <Input
              id="agent_name"
              value={formData.agent_name}
              onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
              placeholder="Assistente Virtual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_niche">Nicho do Negócio</Label>
            <Input
              id="business_niche"
              value={formData.business_niche}
              onChange={(e) => setFormData({ ...formData, business_niche: e.target.value })}
              placeholder="Ex: Clínica odontológica, Loja de roupas femininas, Imobiliária…"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Estética", "Saúde", "Educação", "Imobiliária", "E-commerce", "Restaurante", "Consultoria", "Advocacia"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setFormData({ ...formData, business_niche: suggestion })}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Define o segmento em que a IA atua. Quanto mais específico, mais natural a conversa.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_description">Descrição rápida do negócio</Label>
            <Textarea
              id="business_description"
              value={formData.business_description}
              onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
              placeholder="O que vocês vendem, ticket médio, perfil do cliente ideal, principais diferenciais…"
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Opcional. Dá contexto extra pra IA usar exemplos e tom adequados ao seu negócio.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_prompt">Instruções Personalizadas</Label>
            <Textarea
              id="custom_prompt"
              value={formData.custom_prompt}
              onChange={(e) => setFormData({ ...formData, custom_prompt: e.target.value })}
              placeholder="Descreva como o agente deve se comportar, tom de voz, informações importantes sobre sua empresa..."
              rows={8}
            />
            <p className="text-sm text-muted-foreground">
              O agente usará essas instruções junto com a base de conhecimento para responder.
              Use a aba <strong>Entrevista IA</strong> para gerar automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_messages">Máximo de mensagens sem humano</Label>
            <Input
              id="max_messages"
              type="number"
              value={formData.max_messages_without_human}
              onChange={(e) =>
                setFormData({ ...formData, max_messages_without_human: parseInt(e.target.value) || 10 })
              }
              min={1}
              max={50}
            />
            <p className="text-sm text-muted-foreground">
              Após essa quantidade, a IA sugere transferir para humano.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-primary" />
              <Label htmlFor="response_delay">Tempo de espera antes de responder (segundos)</Label>
            </div>
            <Input
              id="response_delay"
              type="number"
              value={formData.response_delay_seconds}
              onChange={(e) =>
                setFormData({ ...formData, response_delay_seconds: parseInt(e.target.value) || 5 })
              }
              min={0}
              max={60}
            />
            <p className="text-sm text-muted-foreground">
              💡 A IA aguardará esse tempo após a última mensagem do cliente antes de responder.
              Use 0 para resposta imediata.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="handoff_message">Mensagem de Transferência</Label>
            <Textarea
              id="handoff_message"
              value={formData.handoff_message}
              onChange={(e) => setFormData({ ...formData, handoff_message: e.target.value })}
              placeholder="Mensagem enviada quando transferir para atendente"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveConfig.isPending}>
        {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
}