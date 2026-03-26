import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSystemAIConfig } from "@/hooks/useSystemAIConfig";
import { useAdminNotificationContacts } from "@/hooks/useAdminNotificationContacts";
import { Bot, Save, Loader2, Plus, Trash2, Bell } from "lucide-react";

export default function AdminAIConfig() {
  const { config, isLoading, upsertConfig } = useSystemAIConfig();
  const { contacts, createContact, toggleContact, deleteContact } = useAdminNotificationContacts();
  const [agentName, setAgentName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");

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

  const handleAddContact = () => {
    if (!newPhone.trim()) return;
    createContact.mutate({ phone: newPhone.trim(), name: newName.trim() || undefined }, {
      onSuccess: () => { setNewPhone(""); setNewName(""); }
    });
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
              <p className="text-xs text-slate-500">Instruções adicionais para a IA de suporte. O agente já possui conhecimento completo do sistema.</p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Instruções adicionais para o agente de suporte..."
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

        {/* Notification Contacts */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bell className="h-5 w-5 text-amber-400" /> Contatos de Notificação
            </CardTitle>
            <p className="text-xs text-slate-500">
              Pessoas que serão notificadas via WhatsApp quando um cliente solicitar atendimento humano.
              Receberão um resumo automático da conversa.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome"
                className="bg-slate-800 border-slate-700 text-slate-200 w-1/3"
              />
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="5511999999999"
                className="bg-slate-800 border-slate-700 text-slate-200 flex-1"
              />
              <Button
                onClick={handleAddContact}
                disabled={createContact.isPending || !newPhone.trim()}
                size="icon"
                className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Nenhum contato cadastrado. Adicione números que receberão alertas de suporte.
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={contact.active}
                        onCheckedChange={(checked) =>
                          toggleContact.mutate({ id: contact.id, active: checked })
                        }
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {contact.name || "Sem nome"}
                        </p>
                        <p className="text-xs text-slate-500">{contact.phone}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteContact.mutate(contact.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
