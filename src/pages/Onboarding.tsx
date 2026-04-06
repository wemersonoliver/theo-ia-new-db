import { useState, useEffect, useRef } from "react";
import { AudioRecordButton } from "@/components/AudioRecordButton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { LocationPicker } from "@/components/LocationPicker";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAppointmentTypes } from "@/hooks/useAppointmentTypes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OnboardingVideo } from "@/components/OnboardingVideo";
import {
  Sparkles, Smartphone, QrCode, Loader2, RefreshCw, CheckCircle2, XCircle,
  Calendar, Bot, MapPin, FlaskConical, PartyPopper, ChevronRight, ArrowRight,
  Check, Send, Copy, Clock, Plus, Trash2, Power, Wand2, Tag, Pencil,
  MessageCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type OnboardingStep = "welcome" | "whatsapp" | "appointments_question" | "appointments_config" | "interview" | "location_question" | "location" | "test_prompt" | "completed";

type InterviewMessage = { role: "user" | "assistant"; content: string };

const STEP_ORDER: OnboardingStep[] = [
  "welcome", "whatsapp", "appointments_question", "appointments_config",
  "interview", "location_question", "location", "test_prompt", "completed"
];

const STEP_LABELS: Record<string, string> = {
  welcome: "Boas-vindas",
  whatsapp: "Conectar WhatsApp",
  appointments_question: "Agendamentos",
  appointments_config: "Configurar Horários",
  interview: "Entrevista IA",
  location_question: "Local de Atendimento",
  location: "Endereço",
  test_prompt: "Testar Prompt",
  completed: "Concluído",
};

const DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const LOADING_MESSAGES = [
  "Analisando gargalos do setor...",
  "Mapeando dúvidas frequentes...",
  "Consultando base de conhecimento do nicho...",
  "Elaborando próxima pergunta...",
  "Identificando padrões do segmento...",
  "Processando contexto da empresa...",
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [skippedSteps, setSkippedSteps] = useState<Set<OnboardingStep>>(new Set());
  const [usesAppointments, setUsesAppointments] = useState<boolean | null>(null);
  const [hasPublicLocation, setHasPublicLocation] = useState<boolean | null>(null);

  // Calculate visible steps (removing skipped)
  const visibleSteps = STEP_ORDER.filter(s => !skippedSteps.has(s));
  const currentIndex = visibleSteps.indexOf(currentStep);
  const progressPercent = ((currentIndex) / (visibleSteps.length - 1)) * 100;

  const goToStep = (step: OnboardingStep) => setCurrentStep(step);

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    for (let i = idx + 1; i < STEP_ORDER.length; i++) {
      if (!skippedSteps.has(STEP_ORDER[i])) {
        setCurrentStep(STEP_ORDER[i]);
        return;
      }
    }
  };

  const handleAppointmentsAnswer = (answer: boolean) => {
    setUsesAppointments(answer);
    if (!answer) {
      setSkippedSteps(prev => new Set([...prev, "appointments_config"]));
      setCurrentStep("interview");
    } else {
      setCurrentStep("appointments_config");
    }
  };

  const handleLocationAnswer = (answer: boolean) => {
    setHasPublicLocation(answer);
    if (!answer) {
      setSkippedSteps(prev => new Set([...prev, "location"]));
      setCurrentStep("test_prompt");
    } else {
      setCurrentStep("location");
    }
  };

  const handleFinish = async () => {
    if (!user) return;

    // Activate AI agent automatically
    await supabase
      .from("whatsapp_ai_config")
      .update({ active: true } as any)
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao finalizar configuração");
      return;
    }
    toast.success("Configuração concluída! Agente IA ativado e pronto para uso!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Progress Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Configuração Inicial</span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {currentIndex + 1} de {visibleSteps.length} passos
              </span>
              <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground hover:text-foreground">
                Pular
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Checklist */}
        <aside className="hidden lg:flex w-72 border-r bg-muted/30 p-6 flex-col gap-1">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Passos
          </h3>
          {visibleSteps.map((step, idx) => {
            const isCurrent = step === currentStep;
            const isDone = visibleSteps.indexOf(step) < currentIndex;
            return (
              <div
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isCurrent && "bg-primary/10 text-primary font-medium",
                  isDone && "text-muted-foreground",
                  !isCurrent && !isDone && "text-muted-foreground/60"
                )}
              >
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && !isDone && "bg-muted text-muted-foreground"
                )}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                {STEP_LABELS[step]}
              </div>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className={cn("mx-auto", currentStep === "test_prompt" ? "max-w-6xl" : "max-w-3xl")}>
            {currentStep === "welcome" && (
              <WelcomeStep onNext={() => goToStep("whatsapp")} />
            )}
            {currentStep === "whatsapp" && (
              <WhatsAppStep onNext={goNext} />
            )}
            {currentStep === "appointments_question" && (
              <AppointmentsQuestionStep onAnswer={handleAppointmentsAnswer} />
            )}
            {currentStep === "appointments_config" && (
              <AppointmentsConfigStep onNext={goNext} />
            )}
            {currentStep === "interview" && (
              <InterviewStep onNext={goNext} />
            )}
            {currentStep === "location_question" && (
              <LocationQuestionStep onAnswer={handleLocationAnswer} />
            )}
            {currentStep === "location" && (
              <LocationStep onNext={goNext} />
            )}
            {currentStep === "test_prompt" && (
              <TestPromptStep onNext={goNext} />
            )}
            {currentStep === "completed" && (
              <CompletedStep onFinish={handleFinish} />
            )}
          </div>
        </main>
      </div>

      {/* Floating Support Button */}
      <a
        href="https://wa.me/5547991293662?text=Olá! Preciso de ajuda durante a configuração inicial."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 shadow-lg transition-all hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">Precisa de ajuda?</span>
      </a>
    </div>
  );
}

// ─── STEP 1: WELCOME ───────────────────────────────────────────────────────────
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      <OnboardingVideo stepKey="welcome" />
      <div className="space-y-4">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Bem-vindo ao Theo IA! 🎉
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Vamos configurar sua ferramenta de atendimento inteligente em poucos passos.
          O processo leva cerca de <strong>5-10 minutos</strong>.
        </p>
      </div>

      <div className="grid gap-3 text-left max-w-md w-full">
        {[
          { icon: Smartphone, text: "Conectar seu WhatsApp" },
          { icon: Bot, text: "Configurar seu Agente IA personalizado" },
          { icon: Calendar, text: "Definir horários de atendimento (opcional)" },
          { icon: FlaskConical, text: "Testar tudo antes de começar" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onNext} className="gap-2 text-base px-8">
        Começar Configuração
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

// ─── STEP 2: WHATSAPP ───────────────────────────────────────────────────────────
function WhatsAppStep({ onNext }: { onNext: () => void }) {
  const { instance, isLoading, createInstance, disconnectInstance, refreshQRCode } = useWhatsAppInstance();
  const [countdown, setCountdown] = useState(30);
  const [cachedQRCode, setCachedQRCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const instanceStatusRef = useRef(instance?.status);

  useEffect(() => { instanceStatusRef.current = instance?.status; }, [instance?.status]);

  useEffect(() => {
    return () => {
      if (instanceStatusRef.current === "qr_ready") {
        disconnectInstance.mutate();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (instance?.qr_code_base64) {
      setCachedQRCode(instance.qr_code_base64);
      setIsRefreshing(false);
      setRefreshFailed(false);
    }
  }, [instance?.qr_code_base64]);

  // If instance is qr_ready but has no QR code (stale from previous session), auto-refresh once
  useEffect(() => {
    if (instance?.status === "qr_ready" && !instance?.qr_code_base64 && !cachedQRCode && !isRefreshing && !refreshFailed) {
      setIsRefreshing(true);
      refreshQRCode.mutate(undefined, {
        onError: () => {
          setIsRefreshing(false);
          setRefreshFailed(true);
          // Instance doesn't exist in Evolution API anymore, disconnect to allow reconnection
          disconnectInstance.mutate();
        },
      });
    }
  }, [instance?.status, instance?.qr_code_base64, cachedQRCode, isRefreshing, refreshFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasQR = Boolean(cachedQRCode || instance?.qr_code_base64);
    if (instance?.status !== "qr_ready" || !hasQR) { setCountdown(30); setIsRefreshing(false); return; }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsRefreshing(true);
          refreshQRCode.mutate(undefined, {
            onError: () => {
              setIsRefreshing(false);
              setRefreshFailed(true);
              disconnectInstance.mutate();
            },
          });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [instance?.status, instance?.qr_code_base64, cachedQRCode, refreshQRCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const isConnected = instance?.status === "connected";
  const qrCodeValue = cachedQRCode || instance?.qr_code_base64 || null;
  const qrImageSrc = qrCodeValue
    ? qrCodeValue.startsWith("data:image")
      ? qrCodeValue
      : `data:image/png;base64,${qrCodeValue}`
    : null;

  return (
    <div className="space-y-6">
      <OnboardingVideo stepKey="whatsapp" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" />
          Conectar WhatsApp
        </h2>
        <p className="text-muted-foreground">
          Escaneie o QR Code com seu WhatsApp para conectar. Abra o WhatsApp → Menu (⋮) → Dispositivos Conectados → Conectar Dispositivo.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : isConnected ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <p className="text-lg font-medium">WhatsApp Conectado!</p>
              <p className="text-sm text-muted-foreground">
                {instance?.profile_name} · {instance?.phone_number}
              </p>
            </div>
          ) : instance?.status === "qr_ready" ? (
            <div className="space-y-4 text-center">
              {qrImageSrc ? (
                <>
                  <div className="relative rounded-lg border bg-white p-4 inline-block">
                    <img
                      src={qrImageSrc}
                      alt="QR Code"
                      className={cn("h-64 w-64 transition-opacity", isRefreshing && "opacity-50")}
                    />
                    {isRefreshing && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    QR Code expira em <span className="font-bold text-primary">{countdown}s</span>
                  </p>
                </>
              ) : (
                <div className="py-6">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-3">Gerando QR Code...</p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); refreshQRCode.mutate(); setCountdown(30); }} disabled={isRefreshing}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Atualizar QR
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { disconnectInstance.mutate(); setCachedQRCode(null); }} disabled={disconnectInstance.isPending}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <QrCode className="h-16 w-16 mx-auto opacity-30" />
              <Button onClick={() => createInstance.mutate()} disabled={createInstance.isPending} size="lg">
                {createInstance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                Conectar WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isConnected} size="lg" className="gap-2">
          Próximo Passo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 3: APPOINTMENTS QUESTION ─────────────────────────────────────────────
function AppointmentsQuestionStep({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8">
      <OnboardingVideo stepKey="appointments" />
      <div className="space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Você trabalha com agendamentos?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Exemplos: consultas, aulas experimentais, serviços com horário marcado, reuniões, atendimentos agendados, etc.
        </p>
      </div>

      <div className="flex gap-4">
        <Button size="lg" onClick={() => onAnswer(true)} className="gap-2 px-8">
          <Check className="h-5 w-5" /> Sim, trabalho com agendamentos
        </Button>
        <Button size="lg" variant="outline" onClick={() => onAnswer(false)} className="gap-2 px-8">
          Não, pular esta etapa
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 4: APPOINTMENTS CONFIG ────────────────────────────────────────────────
function AppointmentsConfigStep({ onNext }: { onNext: () => void }) {
  const { appointmentTypes, isLoading, saveType, deleteType, toggleActive } = useAppointmentTypes();

  const emptyForm = {
    name: "", description: "", duration_minutes: 30,
    days_of_week: [1, 2, 3, 4, 5] as number[],
    start_time: "08:00", end_time: "18:00", max_appointments_per_slot: 1,
  };

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do serviço"); return; }
    if (form.days_of_week.length === 0) { toast.error("Selecione pelo menos um dia"); return; }
    saveType.mutate({
      id: editingId || undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.duration_minutes,
      days_of_week: form.days_of_week,
      start_time: form.start_time + (form.start_time.length === 5 ? ":00" : ""),
      end_time: form.end_time + (form.end_time.length === 5 ? ":00" : ""),
      max_appointments_per_slot: form.max_appointments_per_slot,
    });
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (type: typeof appointmentTypes[0]) => {
    setEditingId(type.id);
    setForm({
      name: type.name,
      description: type.description || "",
      duration_minutes: type.duration_minutes,
      days_of_week: type.days_of_week || [1, 2, 3, 4, 5],
      start_time: type.start_time?.slice(0, 5) || "08:00",
      end_time: type.end_time?.slice(0, 5) || "18:00",
      max_appointments_per_slot: type.max_appointments_per_slot || 1,
    });
  };

  const formatTime = (time: string) => time?.slice(0, 5) || "";
  const dayLabels = (days: number[]) => days.map(d => DAYS.find(dd => dd.value === d)?.label?.slice(0, 3)).filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <OnboardingVideo stepKey="appointments" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Configurar Agendamentos
        </h2>
        <p className="text-muted-foreground">
          Cadastre seus serviços com os dias e horários em que cada um está disponível. A IA usará essas informações para agendar automaticamente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> {editingId ? "Editar Serviço" : "Adicionar Serviço"}
            </CardTitle>
            <CardDescription>
              Defina o serviço, dias, horários e duração.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Serviço</Label>
              <Input
                placeholder="Ex: Corte de Cabelo, Consulta, Aula..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva brevemente o serviço..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Dias Disponíveis</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map(day => (
                  <label key={day.value} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent/50">
                    <Checkbox checked={form.days_of_week.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário Início</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário Fim</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" min={5} max={480} step={5} value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="space-y-2">
                <Label>Vagas por Horário</Label>
                <Input type="number" min={1} max={100} value={form.max_appointments_per_slot}
                  onChange={e => setForm({ ...form, max_appointments_per_slot: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={saveType.isPending}>
                {saveType.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? "Salvar Alterações" : "Adicionar Serviço"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de serviços */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" /> Serviços Cadastrados
            </CardTitle>
            <CardDescription>Cada serviço com seus dias e horários próprios</CardDescription>
          </CardHeader>
          <CardContent>
            {appointmentTypes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhum serviço cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {appointmentTypes.map(type => (
                  <div key={type.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={type.is_active}
                          onCheckedChange={checked => toggleActive.mutate({ id: type.id, isActive: checked })}
                        />
                        <p className={cn("font-medium text-sm", !type.is_active && "text-muted-foreground")}>{type.name}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteType.mutate(type.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {type.description && <p className="text-xs text-muted-foreground pl-12 line-clamp-1">{type.description}</p>}
                    <div className="text-xs text-muted-foreground pl-12 space-y-0.5">
                      <p>{type.duration_minutes}min · {type.max_appointments_per_slot === 1 ? "1 vaga" : `${type.max_appointments_per_slot} vagas`}</p>
                      <p>{dayLabels(type.days_of_week || [])} · {formatTime(type.start_time)} - {formatTime(type.end_time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg" className="gap-2">
          Próximo Passo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 5: INTERVIEW ──────────────────────────────────────────────────────────
function InterviewStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();
  const { saveConfig } = useAIConfig();

  const [state, setState] = useState<"idle" | "chat" | "completed">("idle");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); }; }, []);

  const startLoading = () => {
    let idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    setLoadingText(LOADING_MESSAGES[idx]);
    loadingIntervalRef.current = setInterval(() => { idx = (idx + 1) % LOADING_MESSAGES.length; setLoadingText(LOADING_MESSAGES[idx]); }, 2000);
  };
  const stopLoading = () => { if (loadingIntervalRef.current) { clearInterval(loadingIntervalRef.current); loadingIntervalRef.current = null; } };

  const callAgent = async (currentMsgs: InterviewMessage[], userMsg?: string) => {
    if (!user) return;
    setIsLoading(true);
    startLoading();
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) throw new Error("Não autenticado");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-ai-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interviewId, companyName, segment, messages: currentMsgs, userMessage: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      const newMsgs = [...currentMsgs];
      if (userMsg && currentMsgs.length > 0) newMsgs.push({ role: "user", content: userMsg });
      newMsgs.push({ role: "assistant", content: data.message });
      setMessages(newMsgs);
      if (data.finished) {
        setGeneratedPrompt(data.generatedPrompt || "");
        setEditablePrompt(data.generatedPrompt || "");
        setState("completed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao chamar o agente");
    } finally {
      setIsLoading(false);
      stopLoading();
    }
  };

  const handleStart = async () => {
    if (!companyName.trim() || !segment.trim() || !user) { toast.error("Preencha todos os campos"); return; }
    setIsLoading(true); startLoading();
    try {
      const { data: interview, error } = await supabase.from("entrevistas_config")
        .insert({ user_id: user.id, company_name: companyName.trim(), segment: segment.trim(), messages: [], status: "in_progress" })
        .select().single();
      if (error) throw error;
      setInterviewId(interview.id);
      setMessages([]);
      await callAgent([]);
      setState("chat");
    } catch { toast.error("Erro ao iniciar entrevista"); } finally { setIsLoading(false); stopLoading(); }
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || isLoading) return;
    setUserInput("");
    await callAgent(messages, text);
  };

  const handleApply = async () => {
    if (!editablePrompt.trim()) return;
    setIsApplying(true);
    try {
      if (interviewId) {
        await supabase.from("entrevistas_config").update({ generated_prompt: editablePrompt, status: "completed" }).eq("id", interviewId);
      }
      await saveConfig.mutateAsync({ custom_prompt: editablePrompt });
      toast.success("Prompt aplicado com sucesso!");
      onNext();
    } catch { toast.error("Erro ao aplicar prompt"); } finally { setIsApplying(false); }
  };

  return (
    <div className="space-y-6">
      <OnboardingVideo stepKey="interview" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Entrevista com IA
        </h2>
        <p className="text-muted-foreground">
          {state === "idle"
            ? "Nossa IA fará uma consultoria personalizada para criar o melhor prompt de atendimento para o seu negócio."
            : state === "completed"
            ? "Revise o prompt gerado e aplique-o ao seu agente."
            : "Responda as perguntas da IA para gerar o melhor prompt."
          }
        </p>
      </div>

      {state === "idle" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Clínica Bem Estar" />
              </div>
              <div className="space-y-2">
                <Label>Segmento / Nicho</Label>
                <Input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: Clínica de estética" />
              </div>
            </div>
            <Button onClick={handleStart} disabled={isLoading || !companyName.trim() || !segment.trim()} className="w-full" size="lg">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingText}</> : <><Sparkles className="mr-2 h-4 w-4" />Iniciar Entrevista</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "chat" && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] px-4">
              <div className="space-y-4 py-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                    )}>
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
                <Textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Digite sua resposta..."
                  disabled={isLoading}
                  className="flex-1 min-h-[60px] resize-none"
                  rows={2}
                />
                <AudioRecordButton
                  onTranscription={(text) => setUserInput(prev => prev ? prev + " " + text : text)}
                  disabled={isLoading}
                />
                <Button onClick={handleSend} disabled={!userInput.trim() || isLoading} size="icon" className="self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state === "completed" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" /> Prompt Gerado!
            </CardTitle>
            <CardDescription>Revise e aplique ao seu agente IA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={editablePrompt} onChange={e => setEditablePrompt(e.target.value)} rows={12} className="font-mono text-sm resize-y" />
            <Button onClick={handleApply} disabled={isApplying} size="lg" className="w-full">
              {isApplying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando...</> : <><Check className="mr-2 h-4 w-4" />Aplicar Prompt e Continuar</>}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── STEP 6: LOCATION QUESTION ──────────────────────────────────────────────────
function LocationQuestionStep({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8">
      <OnboardingVideo stepKey="location_question" />
      <div className="space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Você tem um local de atendimento?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Se seus clientes podem ir até um local físico (clínica, loja, escritório, academia), configure o endereço para a IA enviar a localização no WhatsApp.
        </p>
      </div>

      <div className="flex gap-4">
        <Button size="lg" onClick={() => onAnswer(true)} className="gap-2 px-8">
          <Check className="h-5 w-5" /> Sim, tenho um local
        </Button>
        <Button size="lg" variant="outline" onClick={() => onAnswer(false)} className="gap-2 px-8">
          Não, pular esta etapa
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 7: LOCATION ───────────────────────────────────────────────────────────
function LocationStep({ onNext }: { onNext: () => void }) {
  const { config, saveConfig } = useAIConfig();

  const handleLocationUpdate = async (data: {
    business_address: string;
    business_latitude: number | null;
    business_longitude: number | null;
    business_location_name: string;
  }) => {
    await saveConfig.mutateAsync(data);
  };

  return (
    <div className="space-y-6">
      <OnboardingVideo stepKey="location" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Localização do Negócio
        </h2>
        <p className="text-muted-foreground">
          Configure o endereço do seu local. Quando um cliente perguntar "onde fica?", a IA enviará automaticamente a localização.
        </p>
      </div>

      <LocationPicker
        address={config?.business_address || ""}
        latitude={config?.business_latitude || null}
        longitude={config?.business_longitude || null}
        locationName={config?.business_location_name || ""}
        onUpdate={handleLocationUpdate}
      />

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg" className="gap-2">
          Próximo Passo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 8: TEST PROMPT (Dual Panel - Test + AI Generator) ─────────────────
function TestPromptStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();

  // Test chat state
  const [testMessages, setTestMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const testEndRef = useRef<HTMLDivElement>(null);

  // Generator chat state
  const [genMessages, setGenMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [genInput, setGenInput] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const genEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { testEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [testMessages, testLoading]);
  useEffect(() => { genEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [genMessages, genLoading]);

  const handleTestSend = async () => {
    const text = testInput.trim();
    if (!text || testLoading || !user) return;
    setTestInput("");
    const newMsgs = [...testMessages, { role: "user" as const, content: text }];
    setTestMessages(newMsgs);
    setTestLoading(true);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) throw new Error("Não autenticado");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-ai-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: testMessages, userMessage: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setTestMessages([...newMsgs, { role: "assistant", content: data.message }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar");
      setTestMessages(testMessages);
    } finally { setTestLoading(false); }
  };

  const handleGenSend = async () => {
    const text = genInput.trim();
    if (!text || genLoading || !user) return;
    setGenInput("");
    const newMsgs = [...genMessages, { role: "user" as const, content: text }];
    setGenMessages(newMsgs);
    setGenLoading(true);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) throw new Error("Não autenticado");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompt-generator-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: genMessages, userMessage: text, testConversation: testMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setGenMessages([...newMsgs, { role: "assistant", content: data.message }]);
      if (data.promptUpdated) {
        toast.success("✅ Prompt atualizado! Reinicie a conversa de teste para ver as mudanças.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao chamar gerador");
      setGenMessages(genMessages);
    } finally { setGenLoading(false); }
  };

  const renderChatPanel = (
    title: string,
    subtitle: string,
    Icon: any,
    msgs: { role: string; content: string }[],
    input: string,
    setInput: (v: string) => void,
    onSend: () => void,
    onRestart: () => void,
    loading: boolean,
    endRef: React.RefObject<HTMLDivElement>,
    placeholder: string,
    EmptyIcon: any,
    emptyTitle: string,
    emptyDesc: string,
    accentClass: string,
  ) => (
    <Card className="flex flex-col" style={{ maxHeight: "500px" }}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Icon className={`h-4 w-4 ${accentClass}`} />
              {title}
            </CardTitle>
            <CardDescription className="text-xs mt-1">{subtitle}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRestart} className="gap-1.5 h-7 text-xs">
            <RefreshCw className="h-3 w-3" />
            Reiniciar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-3">
            {msgs.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <EmptyIcon className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs font-medium">{emptyTitle}</p>
                <p className="text-xs mt-1 max-w-xs">{emptyDesc}</p>
              </div>
            )}
            {msgs.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="animate-pulse">Gerando resposta...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder={placeholder} disabled={loading}
              className="flex-1 min-h-[50px] resize-none text-sm" rows={2}
            />
            <Button onClick={onSend} disabled={!input.trim() || loading} size="icon" className="self-end h-8 w-8">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <OnboardingVideo stepKey="test_prompt" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Testar e Ajustar seu Agente IA
        </h2>
        <p className="text-muted-foreground">
          Teste o atendimento à esquerda e use a IA à direita para analisar e ajustar o prompt em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderChatPanel(
          "Simulador de Atendimento",
          "Teste como um cliente",
          FlaskConical,
          testMessages, testInput, setTestInput, handleTestSend,
          () => { setTestMessages([]); setTestInput(""); toast.success("Conversa reiniciada!"); },
          testLoading, testEndRef,
          "Escreva como um cliente faria...",
          FlaskConical, "Simulador de Atendimento", "Envie uma mensagem como se fosse um cliente.",
          "text-primary"
        )}
        {renderChatPanel(
          "IA Geradora de Prompt",
          "Analise e ajuste o prompt",
          Wand2,
          genMessages, genInput, setGenInput, handleGenSend,
          () => { setGenMessages([]); setGenInput(""); toast.success("Conversa reiniciada!"); },
          genLoading, genEndRef,
          "Peça análises ou ajustes no prompt...",
          Wand2, "Consultor de Prompt", "Converse para analisar o teste e atualizar o prompt.",
          "text-warning"
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg" className="gap-2">
          Finalizar Configuração <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 9: COMPLETED ──────────────────────────────────────────────────────────
function CompletedStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      <div className="space-y-4">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <PartyPopper className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Tudo Pronto! 🎉</h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Sua ferramenta de atendimento está configurada e pronta para trabalhar.
          Agora é só acompanhar as conversas pelo painel.
        </p>
      </div>

      <div className="grid gap-3 text-left max-w-md w-full">
        {[
          "WhatsApp conectado",
          "Agente IA configurado",
          "Prompt personalizado aplicado",
        ].map((text, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">{text}</span>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onFinish} className="gap-2 text-base px-8">
        Ir para o Painel <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
