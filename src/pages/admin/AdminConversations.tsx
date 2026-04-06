import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemConversations, useSystemConversation } from "@/hooks/useSystemConversations";
import type { Message } from "@/hooks/useConversations";
import {
  MessageSquare, Send, Loader2, User, Bot, Power, PowerOff, Mic, ImageIcon, FileText, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function ChatMessages({ messages }: { messages: Message[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="space-y-3 p-3">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={cn("flex", msg.from_me ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2",
              msg.from_me ? "bg-amber-500/20 text-slate-200 rounded-br-sm" : "bg-slate-800 rounded-bl-sm text-slate-300"
            )}>
              {!msg.from_me && (
                <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
                  {msg.sent_by === "ai" || msg.sent_by === "ai_first_contact" ? <><Bot className="h-3 w-3" /> IA</> : <><User className="h-3 w-3" /> Cliente</>}
                </div>
              )}
              {msg.type === "audio" && <span className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Mic className="h-3 w-3" /> Áudio</span>}
              {msg.type === "image" && <span className="text-xs text-slate-500 flex items-center gap-1 mb-1"><ImageIcon className="h-3 w-3" /> Imagem</span>}
              {msg.type === "document" && <span className="text-xs text-slate-500 flex items-center gap-1 mb-1"><FileText className="h-3 w-3" /> Doc</span>}
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <p className="mt-1 text-right text-xs text-slate-600">
                {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function AdminConversations() {
  const { conversations, isLoading, toggleAI, sendMessage, deleteConversation } = useSystemConversations();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const { messages } = useSystemConversation(selectedPhone || "");

  const selectedConv = conversations.find((c) => c.phone === selectedPhone);

  const handleSend = async () => {
    if (!selectedPhone || !messageInput.trim()) return;
    await sendMessage.mutateAsync({ phone: selectedPhone, content: messageInput });
    setMessageInput("");
  };

  return (
    <AdminLayout title="Conversas do Sistema" description="Conversas via WhatsApp do sistema">
      <div className="grid gap-4 h-[calc(100vh-160px)] lg:grid-cols-3">
        {/* List */}
        <Card className="lg:col-span-1 bg-slate-900/50 border-slate-800">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <MessageSquare className="h-4 w-4" /> Conversas ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-260px)]">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <MessageSquare className="mx-auto h-10 w-10 opacity-30" />
                  <p className="mt-3 text-sm">Nenhuma conversa</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {conversations.map((conv) => {
                    const last = conv.messages?.[conv.messages.length - 1];
                    return (
                      <button
                        key={conv.id}
                        className={cn(
                          "w-full p-3 text-left transition-colors hover:bg-slate-800",
                          selectedPhone === conv.phone && "bg-slate-800"
                        )}
                        onClick={() => setSelectedPhone(conv.phone)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate text-sm text-slate-200">{conv.contact_name || conv.phone}</span>
                          {conv.ai_active ? (
                            <Badge className="bg-amber-500/10 text-amber-400 text-xs border-amber-500/20">IA</Badge>
                          ) : (
                            <Badge className="bg-slate-700 text-slate-400 text-xs">Humano</Badge>
                          )}
                        </div>
                        {last && <p className="mt-1 truncate text-xs text-slate-500">{last.from_me ? "Você: " : ""}{last.content}</p>}
                        {conv.last_message_at && (
                          <p className="mt-1 text-xs text-slate-600">
                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
          {selectedPhone ? (
            <>
              <CardHeader className="border-b border-slate-800 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm text-white">{selectedConv?.contact_name || selectedPhone}</CardTitle>
                    <p className="text-xs text-slate-500">{selectedPhone}</p>
                  </div>
                   <div className="flex items-center gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => toggleAI.mutate({ phone: selectedPhone, active: !selectedConv?.ai_active })}
                       disabled={toggleAI.isPending}
                       className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
                     >
                       {selectedConv?.ai_active ? <><PowerOff className="h-4 w-4" /> Assumir</> : <><Power className="h-4 w-4" /> Reativar IA</>}
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         if (confirm("Excluir esta conversa? Isso apagará todo o histórico.")) {
                           deleteConversation.mutate(selectedPhone);
                           setSelectedPhone(null);
                         }
                       }}
                       disabled={deleteConversation.isPending}
                       className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300 gap-2"
                     >
                       <Trash2 className="h-4 w-4" /> Excluir
                     </Button>
                   </div>
                </div>
              </CardHeader>
              <CardContent className="flex h-[calc(100vh-310px)] flex-col p-0">
                <ChatMessages messages={messages} />
                <div className="border-t border-slate-800 p-4">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Mensagem..."
                      disabled={sendMessage.isPending}
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sendMessage.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 text-center">
                    {selectedConv?.ai_active ? "🤖 IA ativa" : "👤 Atendimento manual"}
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-full items-center justify-center">
              <div className="text-center text-slate-500">
                <MessageSquare className="mx-auto h-16 w-16 opacity-30" />
                <p className="mt-4">Selecione uma conversa</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
