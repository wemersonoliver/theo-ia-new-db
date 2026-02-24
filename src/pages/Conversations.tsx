import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConversations, useConversation, Message } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { TagInput, tagClass } from "@/components/TagInput";
import {
  MessageSquare, Send, Loader2, User, Bot, Power, PowerOff,
  Mic, ImageIcon, FileText, Tag, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Chat messages ─────────────────────────────────────────────────────────────
function ChatMessages({ messages, className }: { messages: Message[]; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className={cn("flex-1", className)} ref={scrollRef}>
      <div className="space-y-3 p-3">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            className={cn("flex", msg.from_me ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2",
                msg.from_me
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              )}
            >
              {!msg.from_me && (
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {msg.sent_by === "ai" || msg.sent_by === "ai_first_contact" ? (
                    <><Bot className="h-3 w-3" /> IA</>
                  ) : (
                    <><User className="h-3 w-3" /> Cliente</>
                  )}
                </div>
              )}
              {msg.type === "audio" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Mic className="h-3 w-3" /> Áudio transcrito
                </span>
              )}
              {msg.type === "image" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <ImageIcon className="h-3 w-3" /> Imagem analisada
                </span>
              )}
              {msg.type === "document" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <FileText className="h-3 w-3" /> Documento analisado
                </span>
              )}
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <p className={cn(
                "mt-1 text-right text-xs",
                msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ── Tag Popover ───────────────────────────────────────────────────────────────
function TagPopover({ phone }: { phone: string }) {
  const { contacts, updateContact } = useContacts();
  const [open, setOpen] = useState(false);

  const contact = contacts.find((c) => c.phone === phone);
  const tags = contact?.tags ?? [];

  function handleChange(newTags: string[]) {
    if (!contact) return;
    updateContact.mutate({ id: contact.id, tags: newTags });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">Tags</span>
          {tags.length > 0 && (
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              {tags.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Tags do contato</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contact ? "Edite as tags deste contato" : "Contato ainda não cadastrado"}
            </p>
          </div>
          {contact ? (
            <>
              <TagInput tags={tags} onChange={handleChange} />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tagClass(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Sincronize os contatos para poder adicionar tags.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Conversations() {
  const navigate = useNavigate();
  const { conversations, isLoading, sendMessage, toggleAI } = useConversations();
  const [searchParams] = useSearchParams();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const { messages } = useConversation(selectedPhone || "");
  const isMobile = useIsMobile();

  // Seleciona automaticamente o contato se vier da página de Contatos
  useEffect(() => {
    const phone = searchParams.get("phone");
    if (phone && conversations.length > 0) {
      setSelectedPhone(phone);
    }
  }, [searchParams, conversations]);

  const handleSendMessage = async () => {
    if (!selectedPhone || !messageInput.trim()) return;
    await sendMessage.mutateAsync({ phone: selectedPhone, content: messageInput });
    setMessageInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);

  function openContactPage(phone: string) {
    navigate(`/contacts?open=${encodeURIComponent(phone)}`);
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Conversas" description="Gerencie suas conversas">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <DashboardLayout title="Conversas">
        <div className="space-y-2">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma conversa ainda</p>
              </CardContent>
            </Card>
          ) : (
            conversations.map((conv) => {
              const lastMessage = (conv.messages as Message[])?.[conv.messages?.length - 1];
              return (
                <Card
                  key={conv.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted"
                  onClick={() => setSelectedPhone(conv.phone)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {conv.contact_name || conv.phone}
                        </p>
                        {lastMessage && (
                          <p className="mt-0.5 text-sm text-muted-foreground truncate">
                            {lastMessage.from_me ? "Você: " : ""}{lastMessage.content}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {conv.ai_active ? (
                          <Badge variant="outline" className="text-xs">IA</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Humano</Badge>
                        )}
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Mobile Chat Dialog */}
        <Dialog open={!!selectedPhone} onOpenChange={(open) => !open && setSelectedPhone(null)}>
          <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[95vw] flex-col p-0 gap-0 rounded-xl">
            <DialogHeader className="flex-row items-center gap-2 border-b px-4 py-3 space-y-0">
              <div className="flex-1 min-w-0">
                <button
                  className="flex items-center gap-1 group text-left"
                  onClick={() => selectedPhone && openContactPage(selectedPhone)}
                >
                  <DialogTitle className="text-base truncate group-hover:text-primary transition-colors">
                    {selectedConversation?.contact_name || selectedPhone}
                  </DialogTitle>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
                <p className="text-xs text-muted-foreground truncate">{selectedPhone}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPhone && <TagPopover phone={selectedPhone} />}
                <Button
                  variant={selectedConversation?.ai_active ? "outline" : "default"}
                  size="sm"
                  onClick={() => selectedPhone && toggleAI.mutate({
                    phone: selectedPhone,
                    active: !selectedConversation?.ai_active,
                  })}
                  disabled={toggleAI.isPending}
                >
                  {toggleAI.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selectedConversation?.ai_active ? (
                    <PowerOff className="h-4 w-4" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </DialogHeader>

            <ChatMessages messages={messages} className="flex-1 min-h-0" />

            <div className="border-t bg-background p-3">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Mensagem..."
                  disabled={sendMessage.isPending}
                  className="text-base"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessage.isPending}
                  size="icon"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {selectedConversation?.ai_active ? "🤖 IA ativa" : "👤 Atendimento manual"}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout
      title="Conversas"
      description="Visualize e responda mensagens do WhatsApp"
    >
      <div className="grid gap-4 h-[calc(100vh-180px)] lg:grid-cols-3">
        {/* Conversation List */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Conversas ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto h-10 w-10 opacity-30" />
                  <p className="mt-3 text-sm">Nenhuma conversa ainda</p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => {
                    const lastMessage = (conv.messages as Message[])?.[conv.messages?.length - 1];
                    return (
                      <button
                        key={conv.id}
                        className={cn(
                          "w-full p-3 text-left transition-colors hover:bg-muted active:bg-muted/80",
                          selectedPhone === conv.phone && "bg-muted"
                        )}
                        onClick={() => setSelectedPhone(conv.phone)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate text-sm">
                            {conv.contact_name || conv.phone}
                          </span>
                          {conv.ai_active ? (
                            <Badge variant="outline" className="text-xs shrink-0">IA</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs shrink-0">Humano</Badge>
                          )}
                        </div>
                        {lastMessage && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {lastMessage.from_me ? "Você: " : ""}{lastMessage.content}
                          </p>
                        )}
                        {conv.last_message_at && (
                          <p className="mt-1 text-xs text-muted-foreground/70">
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

        {/* Chat View */}
        <Card className="lg:col-span-2">
          {selectedPhone ? (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {/* Clickable contact name */}
                    <button
                      className="flex items-center gap-1.5 group text-left"
                      onClick={() => openContactPage(selectedPhone)}
                    >
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {selectedConversation?.contact_name || selectedPhone}
                      </CardTitle>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                    <p className="text-sm text-muted-foreground">{selectedPhone}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <TagPopover phone={selectedPhone} />
                    <Button
                      variant={selectedConversation?.ai_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleAI.mutate({
                        phone: selectedPhone,
                        active: !selectedConversation?.ai_active,
                      })}
                      disabled={toggleAI.isPending}
                      className="gap-2"
                    >
                      {toggleAI.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : selectedConversation?.ai_active ? (
                        <><PowerOff className="h-4 w-4" /> Desativar IA</>
                      ) : (
                        <><Power className="h-4 w-4" /> Reativar IA</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex h-[calc(100vh-340px)] flex-col p-0">
                <ChatMessages messages={messages} className="flex-1" />

                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Digite sua mensagem..."
                      disabled={sendMessage.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessage.isPending}
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedConversation?.ai_active
                      ? "IA ativa - respondendo automaticamente"
                      : "IA desativada - ao enviar mensagem, você assume o atendimento"}
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-16 w-16 opacity-30" />
                <p className="mt-4">Selecione uma conversa para visualizar</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
