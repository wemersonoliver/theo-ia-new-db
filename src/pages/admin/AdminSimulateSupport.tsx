import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, FlaskConical, Wand2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type ChatMsg = { role: "user" | "assistant"; content: string };

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
  <Card className="flex flex-col bg-slate-900/50 border-slate-800" style={{ maxHeight: "600px" }}>
    <CardHeader className="pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Icon className={`h-4 w-4 ${accentClass}`} />
            {title}
          </CardTitle>
          <CardDescription className="text-xs mt-1 text-slate-500">{subtitle}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          className="gap-1.5 border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reiniciar
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {msgs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <EmptyIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs mt-1 max-w-xs">{emptyDesc}</p>
            </div>
          )}
          {msgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-amber-500 text-black rounded-br-sm"
                    : "bg-slate-800 text-slate-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  <span className="animate-pulse">Gerando resposta...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-slate-800 p-4 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
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
            className="flex-1 min-h-[80px] max-h-[200px] resize-y bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            rows={3}
          />
          <Button
            onClick={onSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AdminSimulateSupport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [testMessages, setTestMessages] = useState<ChatMsg[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const testEndRef = useRef<HTMLDivElement>(null);

  const [genMessages, setGenMessages] = useState<ChatMsg[]>([]);
  const [genInput, setGenInput] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const genEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [testMessages, testLoading]);

  useEffect(() => {
    genEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [genMessages, genLoading]);

  const handleTestSend = async () => {
    const text = testInput.trim();
    if (!text || testLoading || !user) return;
    setTestInput("");

    const newMessages: ChatMsg[] = [...testMessages, { role: "user", content: text }];
    setTestMessages(newMessages);
    setTestLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/test-support-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  const handleGenSend = async () => {
    const text = genInput.trim();
    if (!text || genLoading || !user) return;
    setGenInput("");

    const newMessages: ChatMsg[] = [...genMessages, { role: "user", content: text }];
    setGenMessages(newMessages);
    setGenLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/support-prompt-generator-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        toast.success("✅ Instruções da IA de Suporte atualizadas! Reinicie a simulação para validar.");
        queryClient.invalidateQueries({ queryKey: ["system-ai-config"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao chamar gerador");
      setGenMessages(genMessages);
    } finally {
      setGenLoading(false);
    }
  };

  const handleTestRestart = () => {
    setTestMessages([]);
    setTestInput("");
    toast.success("Simulação reiniciada!");
  };

  const handleGenRestart = () => {
    setGenMessages([]);
    setGenInput("");
    toast.success("Consultor reiniciado!");
  };

  return (
    <AdminLayout
      title="Simular Suporte"
      description="Teste a IA de Suporte e ajuste as instruções em tempo real"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChatPanel
          title="Simulador da IA de Suporte"
          subtitle="Teste como um cliente conversando com o Theo"
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
          emptyTitle="Simulador da IA de Suporte"
          emptyDesc="Envie uma mensagem para testar como a IA de Suporte está respondendo."
          accentClass="text-amber-400"
        />
        <ChatPanel
          title="Ajustar Instruções"
          subtitle="Analise a simulação e atualize o prompt em tempo real"
          icon={Wand2}
          messages={genMessages}
          input={genInput}
          setInput={setGenInput}
          onSend={handleGenSend}
          onRestart={handleGenRestart}
          loading={genLoading}
          endRef={genEndRef}
          placeholder="Peça análises ou ajustes nas instruções..."
          emptyIcon={Wand2}
          emptyTitle="Consultor de Prompt"
          emptyDesc="Converse com a IA para analisar a simulação ao lado e atualizar as instruções da IA de Suporte."
          accentClass="text-amber-400"
        />
      </div>
    </AdminLayout>
  );
}