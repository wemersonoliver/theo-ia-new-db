import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot,
  Clock,
  Loader2,
  Key,
  X,
  Plus,
  Timer,
  Bell,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  FlaskConical,
  Wand2,
} from "lucide-react";

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const LOADING_MESSAGES = [
  "Analisando gargalos do setor...",
  "Mapeando dúvidas frequentes...",
  "Consultando base de conhecimento do nicho...",
  "Elaborando próxima pergunta...",
  "Identificando padrões do segmento...",
  "Processando contexto da empresa...",
];

type InterviewMessage = { role: "user" | "assistant"; content: string };
type InterviewState = "idle" | "chat" | "completed";

function InterviewTab({
  onPromptApplied,
}: {
  onPromptApplied: () => void;
}) {
  const { user } = useAuth();
  const { saveConfig } = useAIConfig();

  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [editablePrompt, setEditablePrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, []);

  const startLoadingAnimation = () => {
    let idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    setLoadingText(LOADING_MESSAGES[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingText(LOADING_MESSAGES[idx]);
    }, 2000);
  };

  const stopLoadingAnimation = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  const callInterviewAgent = async (
    currentMessages: InterviewMessage[],
    userMessage?: string
  ) => {
    if (!user) return;
    setIsLoading(true);
    startLoadingAnimation();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/interview-ai-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          interviewId,
          companyName,
          segment,
          messages: currentMessages,
          userMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na requisição");

      const assistantMsg: InterviewMessage = {
        role: "assistant",
        content: data.message,
      };

      const newMessages = [...currentMessages];
      if (userMessage && currentMessages.length > 0) {
        newMessages.push({ role: "user", content: userMessage });
      }
      newMessages.push(assistantMsg);
      setMessages(newMessages);

      if (data.finished) {
        setGeneratedPrompt(data.generatedPrompt || "");
        setEditablePrompt(data.generatedPrompt || "");
        setInterviewState("completed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao chamar o agente");
    } finally {
      setIsLoading(false);
      stopLoadingAnimation();
    }
  };

  const handleStart = async () => {
    if (!companyName.trim() || !segment.trim()) {
      toast.error("Preencha o nome da empresa e o segmento.");
      return;
    }
    if (!user) return;

    setIsLoading(true);
    startLoadingAnimation();

    try {
      const { data: interview, error } = await supabase
        .from("entrevistas_config")
        .insert({
          user_id: user.id,
          company_name: companyName.trim(),
          segment: segment.trim(),
          messages: [],
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;
      setInterviewId(interview.id);
      setInterviewState("chat");
      setMessages([]);
      setIsLoading(false);
      stopLoadingAnimation();

      // Primeira chamada — sem mensagem do usuário
      await callInterviewAgent([]);
    } catch (err) {
      toast.error("Erro ao iniciar entrevista");
      setIsLoading(false);
      stopLoadingAnimation();
    }
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || isLoading) return;
    setUserInput("");
    await callInterviewAgent(messages, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editablePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async () => {
    if (!editablePrompt.trim()) return;
    setIsApplying(true);
    try {
      // Salva prompt no banco da entrevista
      if (interviewId) {
        await supabase
          .from("entrevistas_config")
          .update({ generated_prompt: editablePrompt, status: "completed" })
          .eq("id", interviewId);
      }

      // Salva nas instruções do agente IA
      await saveConfig.mutateAsync({ custom_prompt: editablePrompt });
      toast.success("Prompt aplicado às Instruções Personalizadas!");
      onPromptApplied();
    } catch {
      toast.error("Erro ao aplicar o prompt");
    } finally {
      setIsApplying(false);
    }
  };

  const handleRestart = () => {
    setInterviewState("idle");
    setMessages([]);
    setInterviewId(null);
    setGeneratedPrompt("");
    setEditablePrompt("");
    setCompanyName("");
    setSegment("");
    setUserInput("");
  };

  // ─── TELA INICIAL ────────────────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Entrevista Consultiva com IA
            </CardTitle>
            <CardDescription>
              Nossa IA conduzirá uma consultoria personalizada para gerar automaticamente
              o melhor prompt de atendimento para o seu negócio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa</Label>
                <Input
                  id="company_name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Clínica Bem Estar"
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment">Segmento / Nicho</Label>
                <Input
                  id="segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  placeholder="Ex: Clínica de estética, E-commerce, Advocacia..."
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                />
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium">Como funciona:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  A IA analisa o seu segmento e identifica os gargalos do setor
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  Faz perguntas adaptadas para entender seu negócio (5-8 perguntas)
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  Gera um prompt completo com Persona, Protocolos e Call to Action
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  Aplica diretamente nas Instruções do seu Agente IA com 1 clique
                </li>
              </ul>
            </div>

            <Button
              onClick={handleStart}
              disabled={isLoading || !companyName.trim() || !segment.trim()}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingText}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Iniciar Entrevista com IA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TELA DE RESULTADO ────────────────────────────────────────────────────────
  if (interviewState === "completed") {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              Prompt Mestre Gerado!
            </CardTitle>
            <CardDescription>
              Revise, edite se necessário, e aplique às instruções do seu agente com um clique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={editablePrompt}
              onChange={(e) => setEditablePrompt(e.target.value)}
              rows={16}
              className="font-mono text-sm resize-y"
              placeholder="Prompt gerado..."
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleApply} disabled={isApplying} size="lg" className="flex-1">
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Aplicar às Instruções
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={handleRestart}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Nova Entrevista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── CHAT ATIVO ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Entrevista em andamento
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {companyName} · {segment}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRestart}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[420px] px-4">
            <div className="space-y-4 py-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      <span className="animate-pulse">{loadingText}</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua resposta..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!userInput.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ABA TESTAR PROMPT ────────────────────────────────────────────────────────

type TestMessage = { role: "user" | "assistant"; content: string };
type GeneratorMessage = { role: "user" | "assistant"; content: string };

const ChatPanel = ({
  title,
  subtitle,
  icon: Icon,
  messages: msgs,
  input,
  setInput,
  onSend,
  onRestart,
  loading,
  endRef,
  placeholder,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDesc,
  accentClass,
}: {
  title: string;
  subtitle: string;
  icon: any;
  messages: { role: string; content: string }[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onRestart: () => void;
  loading: boolean;
  endRef: React.RefObject<HTMLDivElement>;
  placeholder: string;
  emptyIcon: any;
  emptyTitle: string;
  emptyDesc: string;
  accentClass: string;
}) => (
  <Card className="flex flex-col" style={{ maxHeight: "600px" }}>
    <CardHeader className="pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-4 w-4 ${accentClass}`} />
            {title}
          </CardTitle>
          <CardDescription className="text-xs mt-1">{subtitle}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRestart} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Reiniciar
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {msgs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <EmptyIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs mt-1 max-w-xs">{emptyDesc}</p>
            </div>
          )}

          {msgs.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  <span className="animate-pulse">Gerando resposta...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={onSend} disabled={!input.trim() || loading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

function PromptTestTab() {
  const { user } = useAuth();

  // Test chat state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const testEndRef = useRef<HTMLDivElement>(null);

  // Generator chat state
  const [genMessages, setGenMessages] = useState<GeneratorMessage[]>([]);
  const [genInput, setGenInput] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const genEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [testMessages, testLoading]);

  useEffect(() => {
    genEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [genMessages, genLoading]);

  // ─── Test Chat ────────────────────────────────────────────────────
  const handleTestSend = async () => {
    const text = testInput.trim();
    if (!text || testLoading || !user) return;
    setTestInput("");

    const newMessages: TestMessage[] = [...testMessages, { role: "user", content: text }];
    setTestMessages(newMessages);
    setTestLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/test-ai-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: testMessages, userMessage: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na requisição");
      setTestMessages([...newMessages, { role: "assistant", content: data.message }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar prompt");
      setTestMessages(testMessages);
    } finally {
      setTestLoading(false);
    }
  };

  // ─── Generator Chat ──────────────────────────────────────────────
  const handleGenSend = async () => {
    const text = genInput.trim();
    if (!text || genLoading || !user) return;
    setGenInput("");

    const newMessages: GeneratorMessage[] = [...genMessages, { role: "user", content: text }];
    setGenMessages(newMessages);
    setGenLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/prompt-generator-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: genMessages,
          userMessage: text,
          testConversation: testMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na requisição");

      setGenMessages([...newMessages, { role: "assistant", content: data.message }]);

      if (data.promptUpdated) {
        toast.success("✅ Prompt atualizado com sucesso! Reinicie a conversa de teste para ver as mudanças.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao chamar gerador de prompt");
      setGenMessages(genMessages);
    } finally {
      setGenLoading(false);
    }
  };

  const handleTestRestart = () => {
    setTestMessages([]);
    setTestInput("");
    toast.success("Conversa de teste reiniciada!");
  };

  const handleGenRestart = () => {
    setGenMessages([]);
    setGenInput("");
    toast.success("Conversa do gerador reiniciada!");
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChatPanel
        title="Simulador de Atendimento"
        subtitle="Teste o prompt atual como um cliente"
        icon={FlaskConical}
        messages={testMessages}
        input={testInput}
        setInput={setTestInput}
        onSend={handleTestSend}
        onRestart={handleTestRestart}
        loading={testLoading}
        endRef={testEndRef}
        placeholder="Escreva como um cliente faria..."
        emptyIcon={FlaskConical}
        emptyTitle="Simulador de Atendimento"
        emptyDesc="Envie uma mensagem como se fosse um cliente para testar o prompt atual."
        accentClass="text-primary"
      />
      <ChatPanel
        title="IA Geradora de Prompt"
        subtitle="Analise o teste e ajuste o prompt em tempo real"
        icon={Wand2}
        messages={genMessages}
        input={genInput}
        setInput={setGenInput}
        onSend={handleGenSend}
        onRestart={handleGenRestart}
        loading={genLoading}
        endRef={genEndRef}
        placeholder="Peça análises ou ajustes no prompt..."
        emptyIcon={Wand2}
        emptyTitle="Consultor de Prompt"
        emptyDesc="Converse com a IA para analisar o atendimento ao lado e atualizar o prompt automaticamente."
        accentClass="text-warning"
      />
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function AIAgent() {
  const { config, isLoading, saveConfig, toggleActive } = useAIConfig();
  const [activeTab, setActiveTab] = useState("general");

  const [formData, setFormData] = useState({
    agent_name: "Assistente Virtual",
    custom_prompt: "",
    business_hours_start: "08:00",
    business_hours_end: "18:00",
    business_days: [1, 2, 3, 4, 5],
    out_of_hours_message: "Olá! Estou fora do horário de atendimento. Retornarei em breve!",
    handoff_message: "Um momento, vou transferir você para um atendente.",
    max_messages_without_human: 10,
    trigger_keywords: [] as string[],
    keyword_activation_enabled: false,
    response_delay_seconds: 5,
    reminder_enabled: false,
    reminder_hours_before: 2,
    reminder_message_template:
      "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
  });

  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (config) {
      setFormData({
        agent_name: config.agent_name || "Assistente Virtual",
        custom_prompt: config.custom_prompt || "",
        business_hours_start: config.business_hours_start || "08:00",
        business_hours_end: config.business_hours_end || "18:00",
        business_days: config.business_days || [1, 2, 3, 4, 5],
        out_of_hours_message: config.out_of_hours_message || "",
        handoff_message: config.handoff_message || "",
        max_messages_without_human: config.max_messages_without_human || 10,
        trigger_keywords: config.trigger_keywords || [],
        keyword_activation_enabled: config.keyword_activation_enabled || false,
        response_delay_seconds: config.response_delay_seconds ?? 5,
        reminder_enabled: config.reminder_enabled || false,
        reminder_hours_before: config.reminder_hours_before || 2,
        reminder_message_template:
          config.reminder_message_template ||
          "Olá {nome}! Lembrando que você tem um agendamento {dia_referencia} às {hora}. Por favor, confirme sua presença respondendo SIM ou informe se precisa reagendar.",
      });
    }
  }, [config]);

  const handleSave = () => {
    saveConfig.mutate(formData);
  };

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter((d) => d !== day)
        : [...prev.business_days, day].sort(),
    }));
  };

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !formData.trigger_keywords.includes(keyword)) {
      setFormData((prev) => ({
        ...prev,
        trigger_keywords: [...prev.trigger_keywords, keyword],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      trigger_keywords: prev.trigger_keywords.filter((k) => k !== keyword),
    }));
  };

  // Quando o prompt é aplicado, redireciona para aba Geral
  const handlePromptApplied = () => {
    setActiveTab("general");
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

  return (
    <DashboardLayout
      title="Agente IA"
      description="Configure como seu agente de IA responde às mensagens"
    >
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="general" className="min-w-fit">Geral</TabsTrigger>
          <TabsTrigger value="hours" className="min-w-fit">Horário</TabsTrigger>
          <TabsTrigger value="triggers" className="min-w-fit">Gatilhos</TabsTrigger>
          <TabsTrigger value="reminders" className="min-w-fit">Lembretes</TabsTrigger>
          <TabsTrigger value="interview" className="min-w-fit gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Entrevista IA
          </TabsTrigger>
          <TabsTrigger value="test" className="min-w-fit gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Testar Prompt
          </TabsTrigger>
        </TabsList>

        {/* ── ABA GERAL ── */}
        <TabsContent value="general" className="space-y-6">
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
        </TabsContent>

        {/* ── ABA HORÁRIO ── */}
        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horário de Funcionamento
              </CardTitle>
              <CardDescription>Define quando o agente responde automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hours_start">Início</Label>
                  <Input
                    id="hours_start"
                    type="time"
                    value={formData.business_hours_start}
                    onChange={(e) => setFormData({ ...formData, business_hours_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours_end">Fim</Label>
                  <Input
                    id="hours_end"
                    type="time"
                    value={formData.business_hours_end}
                    onChange={(e) => setFormData({ ...formData, business_hours_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Dias de Funcionamento</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.business_days.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="out_of_hours">Mensagem Fora do Horário</Label>
                <Textarea
                  id="out_of_hours"
                  value={formData.out_of_hours_message}
                  onChange={(e) => setFormData({ ...formData, out_of_hours_message: e.target.value })}
                  placeholder="Mensagem enviada fora do horário de atendimento"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saveConfig.isPending}>
            {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </TabsContent>

        {/* ── ABA GATILHOS ── */}
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

        {/* ── ABA LEMBRETES ── */}
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
                      Variáveis disponíveis: {"{nome}"}, {"{hora}"}, {"{dia_referencia}"} (hoje/amanhã), {"{titulo}"},{" "}
                      {"{data}"}
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

        {/* ── ABA ENTREVISTA IA ── */}
        <TabsContent value="interview">
          <InterviewTab onPromptApplied={handlePromptApplied} />
        </TabsContent>

        {/* ── ABA TESTAR PROMPT ── */}
        <TabsContent value="test">
          <PromptTestTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
