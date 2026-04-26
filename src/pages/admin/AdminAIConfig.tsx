import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSystemAIConfig } from "@/hooks/useSystemAIConfig";
import { useAdminNotificationContacts } from "@/hooks/useAdminNotificationContacts";
import { useWelcomeQueue } from "@/hooks/useWelcomeQueue";
import { Bot, Save, Loader2, Plus, Trash2, Bell, Clock, Volume2, MessageSquare, Send, ArrowUp, ArrowDown, Play, Repeat } from "lucide-react";
import { AdminSystemFollowupTab } from "@/components/admin/AdminSystemFollowupTab";

const DEFAULT_WELCOME_MESSAGES = [
  "Oi {primeiro_nome}! 👋",
  "Eu sou o *Theo*, seu assistente virtual aqui da plataforma 🤖✨",
  "Vi que você acabou de criar sua conta — seja muito bem-vindo(a)! 🎉",
  "Estou aqui pra te ajudar em qualquer dúvida ou dificuldade na configuração.",
  "Se preferir, posso até agendar uma *call rápida com nosso time* pra te ajudar na implementação 😉",
  "Posso te ajudar com algo agora?",
];

export default function AdminAIConfig() {
  const { config, isLoading, upsertConfig } = useSystemAIConfig();
  const { contacts, createContact, toggleContact, deleteContact } = useAdminNotificationContacts();
  const { items, sendTest, runNow } = useWelcomeQueue();

  const [agentName, setAgentName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState(false);
  const [responseDelay, setResponseDelay] = useState(35);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.5);
  const [voiceSimilarityBoost, setVoiceSimilarityBoost] = useState(0.75);
  const [voiceStyle, setVoiceStyle] = useState(0.3);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");

  // Welcome
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeDelayMin, setWelcomeDelayMin] = useState(3);
  const [welcomeMsgDelay, setWelcomeMsgDelay] = useState(4);
  const [welcomeMessages, setWelcomeMessages] = useState<string[]>(DEFAULT_WELCOME_MESSAGES);
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("");

  useEffect(() => {
    if (config) {
      setAgentName(config.agent_name || "");
      setPrompt(config.custom_prompt || "");
      setActive(config.active);
      setResponseDelay(config.response_delay_seconds ?? 35);
      setVoiceEnabled(config.voice_enabled ?? false);
      setVoiceId(config.voice_id || "");
      setVoiceSpeed(config.voice_speed ?? 1.0);
      setVoiceStability(config.voice_stability ?? 0.5);
      setVoiceSimilarityBoost(config.voice_similarity_boost ?? 0.75);
      setVoiceStyle(config.voice_style ?? 0.3);
      setWelcomeEnabled(config.welcome_sequence_enabled ?? true);
      setWelcomeDelayMin(config.welcome_delay_minutes ?? 3);
      setWelcomeMsgDelay(config.welcome_message_delay_seconds ?? 4);
      setWelcomeMessages(
        Array.isArray(config.welcome_messages) && config.welcome_messages.length > 0
          ? config.welcome_messages
          : DEFAULT_WELCOME_MESSAGES,
      );
    }
  }, [config]);

  const handleSave = () => {
    upsertConfig.mutate({
      agent_name: agentName,
      custom_prompt: prompt,
      active,
      response_delay_seconds: responseDelay,
      voice_enabled: voiceEnabled,
      voice_id: voiceId || null,
      voice_speed: voiceSpeed,
      voice_stability: voiceStability,
      voice_similarity_boost: voiceSimilarityBoost,
      voice_style: voiceStyle,
    } as any);
  };

  const handleSaveWelcome = () => {
    upsertConfig.mutate({
      welcome_sequence_enabled: welcomeEnabled,
      welcome_delay_minutes: welcomeDelayMin,
      welcome_message_delay_seconds: welcomeMsgDelay,
      welcome_messages: welcomeMessages.filter((m) => m.trim().length > 0),
    } as any);
  };

  const updateMsg = (i: number, v: string) => {
    setWelcomeMessages((prev) => prev.map((m, idx) => (idx === i ? v : m)));
  };
  const moveMsg = (i: number, dir: -1 | 1) => {
    setWelcomeMessages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const removeMsg = (i: number) => setWelcomeMessages((prev) => prev.filter((_, idx) => idx !== i));
  const addMsg = () => setWelcomeMessages((prev) => [...prev, ""]);

  const handleAddContact = () => {
    if (!newPhone.trim()) return;
    createContact.mutate({ phone: newPhone.trim(), name: newName.trim() || undefined }, {
      onSuccess: () => { setNewPhone(""); setNewName(""); }
    });
  };

  return (
    <AdminLayout title="IA do Suporte" description="Configure o prompt, voz e fluxos da IA de suporte">
      <div className="max-w-4xl">
        <Tabs defaultValue="agent" className="space-y-4">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="agent" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
              <Bot className="h-4 w-4 mr-2" /> Agente
            </TabsTrigger>
            <TabsTrigger value="welcome" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
              <MessageSquare className="h-4 w-4 mr-2" /> Boas-vindas
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
              <Bell className="h-4 w-4 mr-2" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="followup" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
              <Repeat className="h-4 w-4 mr-2" /> Follow-Up
            </TabsTrigger>
          </TabsList>

          {/* AGENTE */}
          <TabsContent value="agent" className="space-y-6">
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
                  <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Suporte Theo IA" className="bg-slate-800 border-slate-700 text-slate-200" />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Prompt do Sistema</Label>
                  <p className="text-xs text-slate-500">Instruções adicionais para a IA. O agente já tem conhecimento completo do sistema.</p>
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Instruções adicionais..." rows={12} className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 font-mono text-sm" />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-400" /> Tempo de Espera (segundos)</Label>
                  <p className="text-xs text-slate-500">Tempo que a IA aguarda antes de responder.</p>
                  <Input type="number" min={5} max={120} value={responseDelay} onChange={(e) => setResponseDelay(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-200 w-32" />
                </div>

                <div className="border-t border-slate-700 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-slate-200 flex items-center gap-2"><Volume2 className="h-4 w-4 text-amber-400" /> Respostas por Voz (ElevenLabs)</Label>
                      <p className="text-xs text-slate-500">Espelha o formato: áudio do cliente → áudio do agente.</p>
                    </div>
                    <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                  </div>

                  {voiceEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-200">ID da Voz</Label>
                        <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="CwhRBWXzGAHq8TQ4Fs17 (Roger - padrão)" className="bg-slate-800 border-slate-700 text-slate-200 font-mono text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Velocidade: {voiceSpeed.toFixed(1)}x</Label>
                        <Slider value={[voiceSpeed]} onValueChange={([v]) => setVoiceSpeed(v)} min={0.7} max={1.2} step={0.1} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Estabilidade: {voiceStability.toFixed(2)}</Label>
                        <Slider value={[voiceStability]} onValueChange={([v]) => setVoiceStability(v)} min={0} max={1} step={0.05} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Similaridade: {voiceSimilarityBoost.toFixed(2)}</Label>
                        <Slider value={[voiceSimilarityBoost]} onValueChange={([v]) => setVoiceSimilarityBoost(v)} min={0} max={1} step={0.05} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Estilo: {voiceStyle.toFixed(2)}</Label>
                        <Slider value={[voiceStyle]} onValueChange={([v]) => setVoiceStyle(v)} min={0} max={1} step={0.05} />
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleSave} disabled={upsertConfig.isPending} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
                  {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Agente
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOAS-VINDAS */}
          <TabsContent value="welcome" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquare className="h-5 w-5 text-amber-400" /> Sequência de Boas-vindas
                </CardTitle>
                <p className="text-xs text-slate-500">Mensagem automática enviada após o cadastro de um novo usuário. Não é enviada se já houver conversa anterior.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-200">Ativar sequência</Label>
                    <p className="text-xs text-slate-500">Envia automaticamente após X minutos do cadastro.</p>
                  </div>
                  <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Delay após cadastro (minutos)</Label>
                    <Input type="number" min={1} max={60} value={welcomeDelayMin} onChange={(e) => setWelcomeDelayMin(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Delay entre mensagens (segundos)</Label>
                    <Input type="number" min={1} max={30} value={welcomeMsgDelay} onChange={(e) => setWelcomeMsgDelay(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-200" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200">Mensagens (use <code className="text-amber-400">{"{primeiro_nome}"}</code> para personalizar)</Label>
                    <Button size="sm" variant="outline" onClick={addMsg} className="border-slate-700 text-slate-200 hover:bg-slate-800"><Plus className="h-3 w-3 mr-1" /> Mensagem</Button>
                  </div>
                  {welcomeMessages.map((msg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[10px] text-slate-500 text-center">{i + 1}</span>
                        <Button size="icon" variant="ghost" onClick={() => moveMsg(i, -1)} disabled={i === 0} className="h-6 w-6 text-slate-400"><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveMsg(i, 1)} disabled={i === welcomeMessages.length - 1} className="h-6 w-6 text-slate-400"><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                      <Textarea value={msg} onChange={(e) => updateMsg(i, e.target.value)} rows={2} className="bg-slate-800 border-slate-700 text-slate-200 flex-1" />
                      <Button size="icon" variant="ghost" onClick={() => removeMsg(i)} className="text-red-400 hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSaveWelcome} disabled={upsertConfig.isPending} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
                  {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Boas-vindas
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Testar agora</CardTitle>
                <p className="text-xs text-slate-500">Enfileira um envio imediato para o telefone informado.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Nome (ex: João)" value={testName} onChange={(e) => setTestName(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
                  <Input placeholder="Telefone (ex: 47999999999)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => sendTest.mutate({ phone: testPhone, full_name: testName })} disabled={sendTest.isPending || !testPhone} className="bg-amber-500 hover:bg-amber-600 text-black gap-2">
                    <Send className="h-4 w-4" /> Enfileirar teste
                  </Button>
                  <Button onClick={() => runNow.mutate()} disabled={runNow.isPending} variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2">
                    <Play className="h-4 w-4" /> Processar agora
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Histórico (últimos 20)</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum envio ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((it) => {
                      const status = it.skipped_reason
                        ? { label: it.skipped_reason === "existing_conversation" ? "ignorado (já tinha conversa)" : `ignorado: ${it.skipped_reason}`, color: "bg-slate-700 text-slate-300" }
                        : it.error_message
                          ? { label: "erro", color: "bg-red-900/40 text-red-300" }
                          : it.processed
                            ? { label: "enviado", color: "bg-emerald-900/40 text-emerald-300" }
                            : { label: "pendente", color: "bg-amber-900/40 text-amber-300" };
                      return (
                        <div key={it.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700 text-xs">
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-medium">{it.full_name || "—"} · {it.phone}</span>
                            <span className="text-slate-500">agendado {new Date(it.scheduled_at).toLocaleString("pt-BR")}</span>
                            {it.error_message && <span className="text-red-400 truncate max-w-md">{it.error_message}</span>}
                          </div>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICAÇÕES */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Bell className="h-5 w-5 text-amber-400" /> Contatos de Notificação
                </CardTitle>
                <p className="text-xs text-slate-500">Pessoas que recebem alertas via WhatsApp em transferências para humano e novos agendamentos.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className="bg-slate-800 border-slate-700 text-slate-200 w-1/3" />
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5511999999999" className="bg-slate-800 border-slate-700 text-slate-200 flex-1" />
                  <Button onClick={handleAddContact} disabled={createContact.isPending || !newPhone.trim()} size="icon" className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum contato cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-3">
                          <Switch checked={contact.active} onCheckedChange={(checked) => toggleContact.mutate({ id: contact.id, active: checked })} />
                          <div>
                            <p className="text-sm font-medium text-slate-200">{contact.name || "Sem nome"}</p>
                            <p className="text-xs text-slate-500">{contact.phone}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteContact.mutate(contact.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
