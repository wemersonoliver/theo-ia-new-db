import { useState, useEffect, useRef } from "react";
import { AudioRecordButton } from "@/components/AudioRecordButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Send, Copy, Check, RefreshCw, ChevronRight } from "lucide-react";

const LOADING_MESSAGES = [
  "Analisando gargalos do setor...",
  "Mapeando dúvidas frequentes...",
  "Consultando base de conhecimento do nicho...",
  "Elaborando próxima pergunta...",
  "Identificando padrões do segmento...",
  "Processando contexto da empresa...",
];

const ANALYSIS_LOADING_MESSAGES = [
  "Analisando conversas reais do WhatsApp...",
  "Identificando padrões de atendimento...",
  "Filtrando conversas com clientes...",
  "Extraindo dúvidas frequentes...",
  "Mapeando objeções e hesitações...",
  "Analisando tom de atendimento...",
  "Consolidando informações reais...",
];

type InterviewMessage = { role: "user" | "assistant"; content: string };
type InterviewState = "idle" | "chat" | "completed";

const INTERVIEW_DRAFT_KEY = "theo-ai-interview-draft";

export function InterviewTab({ onPromptApplied }: { onPromptApplied?: () => void }) {
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
  const [analysisMode, setAnalysisMode] = useState<"idle" | "awaiting_consent" | "awaiting_choice" | "entering_phones" | "analyzing">("idle");
  const [phonesInput, setPhonesInput] = useState("");
  const [phonesError, setPhonesError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const draft = sessionStorage.getItem(INTERVIEW_DRAFT_KEY);
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      setInterviewState(parsed.interviewState ?? "idle");
      setCompanyName(parsed.companyName ?? "");
      setSegment(parsed.segment ?? "");
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
      setInterviewId(parsed.interviewId ?? null);
      setUserInput(parsed.userInput ?? "");
      setGeneratedPrompt(parsed.generatedPrompt ?? "");
      setEditablePrompt(parsed.editablePrompt ?? "");
      setAnalysisMode(parsed.analysisMode ?? "idle");
      setPhonesInput(parsed.phonesInput ?? "");
    } catch {
      sessionStorage.removeItem(INTERVIEW_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(INTERVIEW_DRAFT_KEY, JSON.stringify({
      interviewState,
      companyName,
      segment,
      messages,
      interviewId,
      userInput,
      generatedPrompt,
      editablePrompt,
      analysisMode,
      phonesInput,
    }));
  }, [interviewState, companyName, segment, messages, interviewId, userInput, generatedPrompt, editablePrompt, analysisMode, phonesInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, []);

  const startLoadingAnimation = (useAnalysisMessages = false) => {
    const msgs = useAnalysisMessages ? ANALYSIS_LOADING_MESSAGES : LOADING_MESSAGES;
    let idx = Math.floor(Math.random() * msgs.length);
    setLoadingText(msgs[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setLoadingText(msgs[idx]);
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
    userMessage?: string,
    analyzeConversations?: boolean,
    specificPhones?: string[],
  ) => {
    if (!user) return;
    setIsLoading(true);
    startLoadingAnimation(!!analyzeConversations);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/interview-ai-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          interviewId,
          companyName,
          segment,
          messages: currentMessages,
          userMessage,
          analyzeConversations,
          specificPhones,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na requisição");

      const assistantMsg: InterviewMessage = { role: "assistant", content: data.message };
      const newMessages = [...currentMessages];
      if (userMessage && currentMessages.length > 0) {
        newMessages.push({ role: "user", content: userMessage });
      }
      if (analyzeConversations && !data.finished) {
        newMessages.push({
          role: "assistant",
          content: "✅ Análise de conversas reais concluída! Incorporando padrões identificados no prompt...",
        });
      }
      newMessages.push(assistantMsg);
      setMessages(newMessages);

      if (data.requestAnalyzeAuto || data.requestAnalyzePhones) {
        setAnalysisMode("awaiting_choice");
      }

      if (data.finished) {
        setGeneratedPrompt(data.generatedPrompt || "");
        setEditablePrompt(data.generatedPrompt || "");
        setInterviewState("completed");
        setAnalysisMode("idle");
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
      setMessages([]);
      await callInterviewAgent([]);
      setInterviewState("chat");
    } catch (err) {
      toast.error("Erro ao iniciar entrevista");
      setInterviewState("idle");
    } finally {
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

  const validatePhones = (input: string): string[] | null => {
    const phones = input
      .split(",")
      .map((p) => p.trim().replace(/\D/g, ""))
      .filter((p) => p.length >= 10 && p.length <= 13);
    if (phones.length < 5) {
      setPhonesError("Informe pelo menos 5 números válidos.");
      return null;
    }
    if (phones.length > 30) {
      setPhonesError("Máximo de 30 números permitidos.");
      return null;
    }
    setPhonesError("");
    return phones;
  };

  const handleAnalyzeAuto = async () => {
    setAnalysisMode("analyzing");
    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: "Prefiro análise automática das conversas mais recentes." },
    ];
    setMessages(updatedMessages);
    await callInterviewAgent(updatedMessages, undefined, true);
    setAnalysisMode("idle");
  };

  const handleAnalyzeWithPhones = async () => {
    const phones = validatePhones(phonesInput);
    if (!phones) return;
    setAnalysisMode("analyzing");
    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: `Quero que analise esses números específicos: ${phones.join(", ")}` },
    ];
    setMessages(updatedMessages);
    await callInterviewAgent(updatedMessages, undefined, true, phones);
    setAnalysisMode("idle");
  };

  const handleSkipAnalysis = async () => {
    setAnalysisMode("idle");
    await callInterviewAgent(messages, "Não, pode pular a análise e gerar o prompt diretamente.");
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
      if (interviewId) {
        await supabase
          .from("entrevistas_config")
          .update({ generated_prompt: editablePrompt, status: "completed" })
          .eq("id", interviewId);
      }
      await saveConfig.mutateAsync({
        custom_prompt: editablePrompt,
        active: true,
        business_hours_start: "00:00",
        business_hours_end: "23:59",
      });
      toast.success("Agente ativado com atendimento 24h!");
      sessionStorage.removeItem(INTERVIEW_DRAFT_KEY);
      onPromptApplied?.();
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
    setAnalysisMode("idle");
    setPhonesInput("");
    setPhonesError("");
    sessionStorage.removeItem(INTERVIEW_DRAFT_KEY);
  };

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
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
            {analysisMode === "awaiting_choice" ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Como deseja analisar suas conversas?</p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setAnalysisMode("entering_phones")}
                    variant="outline"
                    className="justify-start text-left h-auto py-3"
                  >
                    <span className="mr-2">1️⃣</span>
                    <span className="text-sm">Indicar números específicos de clientes</span>
                  </Button>
                  <Button
                    onClick={handleAnalyzeAuto}
                    variant="outline"
                    className="justify-start text-left h-auto py-3"
                    disabled={isLoading}
                  >
                    <span className="mr-2">2️⃣</span>
                    <span className="text-sm">Análise automática das conversas recentes</span>
                  </Button>
                  <Button
                    onClick={handleSkipAnalysis}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    disabled={isLoading}
                  >
                    Pular análise e gerar prompt diretamente
                  </Button>
                </div>
              </div>
            ) : analysisMode === "entering_phones" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Números dos clientes (com DDD, separados por vírgula)</Label>
                  <Textarea
                    value={phonesInput}
                    onChange={(e) => {
                      setPhonesInput(e.target.value);
                      setPhonesError("");
                    }}
                    placeholder="Ex: 11999998888, 21988887777, 31977776666..."
                    rows={3}
                    className="resize-none"
                  />
                  {phonesError && <p className="text-xs text-destructive">{phonesError}</p>}
                  <p className="text-xs text-muted-foreground">Mínimo 5, máximo 30 números</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAnalyzeWithPhones}
                    disabled={!phonesInput.trim() || isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {loadingText}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Analisar Conversas
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnalysisMode("awaiting_choice");
                      setPhonesInput("");
                      setPhonesError("");
                    }}
                    disabled={isLoading}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua resposta..."
                    disabled={isLoading}
                    className="flex-1 min-h-[80px] max-h-[200px] resize-y"
                    rows={3}
                  />
                  <AudioRecordButton
                    onTranscription={(text) => setUserInput((prev) => (prev ? prev + " " + text : text))}
                    disabled={isLoading}
                  />
                  <Button onClick={handleSend} disabled={!userInput.trim() || isLoading} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}