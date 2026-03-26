import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSystemAIConfig } from "@/hooks/useSystemAIConfig";
import { Bot, Save, Loader2 } from "lucide-react";

export default function AdminAIConfig() {
  const { config, isLoading, upsertConfig } = useSystemAIConfig();
  const [agentName, setAgentName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (config) {
      setAgentName(config.agent_name || "");
      setPrompt(config.custom_prompt || "");
      setActive(config.active);
    }
  }, [config]);

  const handleSave = () => {
    upsertConfig.mutate({ agent_name: agentName, custom_prompt: prompt, active });
  };

  return (
    <AdminLayout title="IA do Suporte" description="Configure o prompt e comportamento da IA de suporte">
      <div className="max-w-3xl space-y-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bot className="h-5 w-5 text-amber-400" /> Configurações da IA de Suporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-slate-200">IA Ativa</Label>
                <p className="text-xs text-slate-500">Ativar respostas automáticas via IA no WhatsApp do sistema</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Nome do Agente</Label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Suporte Theo IA"
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Prompt do Sistema</Label>
              <p className="text-xs text-slate-500">Instruções para a IA de suporte. Inclua informações sobre o produto, tom de voz, e orientações.</p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Você é um assistente de suporte da Theo IA..."
                rows={15}
                className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={upsertConfig.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black gap-2"
            >
              {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
