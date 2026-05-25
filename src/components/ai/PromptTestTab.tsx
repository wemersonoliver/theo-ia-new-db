import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, FlaskConical, Wand2, Paperclip, X, FileText, Image as ImageIcon, Mic } from "lucide-react";

// ─── ABA TESTAR PROMPT ────────────────────────────────────────────────────────

type TestMessage = { role: "user" | "assistant"; content: string };
type GeneratorMessage = { role: "user" | "assistant"; content: string };
type PendingAttachment = { id: string; file: File; mimeType: string; previewUrl?: string };

const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // 16 MB
const ACCEPT_ATTACHMENTS =
  "image/*,audio/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AttachmentChip({ att, onRemove, disabled }: { att: PendingAttachment; onRemove: () => void; disabled?: boolean }) {
  const isImage = att.mimeType.startsWith("image/");
  const isAudio = att.mimeType.startsWith("audio/");
  const Icon = isImage ? ImageIcon : isAudio ? Mic : FileText;
  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/50 pl-2 pr-1 py-1 text-xs max-w-[220px]">
      {isImage && att.previewUrl ? (
        <img src={att.previewUrl} alt="" className="h-6 w-6 rounded object-cover" />
      ) : (
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="truncate">{att.file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="ml-1 rounded p-0.5 hover:bg-background disabled:opacity-50"
        aria-label="Remover anexo"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

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
  attachments,
  onPickFile,
  onRemoveAttachment,
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
  attachments?: PendingAttachment[];
  onPickFile?: (files: FileList | null) => void;
  onRemoveAttachment?: (id: string) => void;
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
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                att={att}
                disabled={loading}
                onRemove={() => onRemoveAttachment?.(att.id)}
              />
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          {onPickFile && (
            <FilePickButton onPick={onPickFile} disabled={loading} />
          )}
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
            className="flex-1 min-h-[80px] max-h-[200px] resize-y"
            rows={3}
          />
          <Button
            onClick={onSend}
            disabled={(!input.trim() && (!attachments || attachments.length === 0)) || loading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

function FilePickButton({ onPick, disabled }: { onPick: (files: FileList | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Anexar arquivo"
        className="shrink-0"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTACHMENTS}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function PromptTestTab() {
  const { user } = useAuth();

  // Test chat state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testAttachments, setTestAttachments] = useState<PendingAttachment[]>([]);
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

  // Clear ephemeral attachments when this component unmounts (menu change).
  useEffect(() => {
    return () => {
      setTestAttachments((prev) => {
        prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        return [];
      });
    };
  }, []);

  const handleAddAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: PendingAttachment[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`"${file.name}" excede 16 MB.`);
        return;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        mimeType: file.type || "application/octet-stream",
        previewUrl,
      });
    });
    if (next.length === 0) return;
    setTestAttachments((prev) => [...prev, ...next].slice(0, 5));
  };

  const handleRemoveAttachment = (id: string) => {
    setTestAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  // ─── Test Chat ────────────────────────────────────────────────────
  const handleTestSend = async () => {
    const text = testInput.trim();
    if ((!text && testAttachments.length === 0) || testLoading || !user) return;
    setTestInput("");

    const attachmentSummary = testAttachments.length
      ? `\n\n📎 ${testAttachments.map((a) => a.file.name).join(", ")}`
      : "";
    const displayText = (text || "(anexo enviado)") + attachmentSummary;
    const newMessages: TestMessage[] = [...testMessages, { role: "user", content: displayText }];
    setTestMessages(newMessages);
    setTestLoading(true);
    const sendingAttachments = testAttachments;
    setTestAttachments([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const encodedAttachments = await Promise.all(
        sendingAttachments.map(async (a) => ({
          name: a.file.name,
          mimeType: a.mimeType,
          data: await fileToBase64(a.file),
        }))
      );

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/test-ai-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: testMessages,
          userMessage: text || "(arquivo anexado pelo cliente)",
          attachments: encodedAttachments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na requisição");
      setTestMessages([...newMessages, { role: "assistant", content: data.message }]);
      // Liberar object URLs após o envio bem-sucedido
      sendingAttachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar prompt");
      setTestMessages(testMessages);
      // Restaurar anexos para o usuário tentar novamente
      setTestAttachments(sendingAttachments);
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
    setTestAttachments((prev) => {
      prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
      return [];
    });
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
        placeholder="Escreva como um cliente faria... (anexe imagem, áudio ou PDF se quiser testar)"
        emptyIcon={FlaskConical}
        emptyTitle="Simulador de Atendimento"
        emptyDesc="Envie uma mensagem como se fosse um cliente para testar o prompt atual."
        accentClass="text-primary"
        attachments={testAttachments}
        onPickFile={handleAddAttachments}
        onRemoveAttachment={handleRemoveAttachment}
      />
      <ChatPanel
        title="Ajustar Atendimento"
        subtitle="Analise o teste e ajuste o seu assistente em tempo real"
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
        emptyDesc="Converse com a IA para analisar o atendimento ao lado e atualizar o seu agente automaticamente."
        accentClass="text-warning"
      />
    </div>
  );
}
