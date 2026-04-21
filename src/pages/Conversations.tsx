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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useConversations, useConversation, Message } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { useCRMPipelines } from "@/hooks/useCRMPipelines";
import { useCRMStages } from "@/hooks/useCRMStages";
import { useCRMDeals } from "@/hooks/useCRMDeals";
import { DealDialog } from "@/components/crm/DealDialog";
import { TagInput, tagClass } from "@/components/TagInput";
import { MediaBubble } from "@/components/MediaBubble";
import { AssigneeSelector } from "@/components/team/AssigneeSelector";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare, Send, Loader2, User, Bot, Power, PowerOff,
  Tag, ExternalLink, Kanban, CheckCircle, Trash2, ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";
import { toast } from "sonner";

// ── Chat messages ─────────────────────────────────────────────────────────────
function ChatMessages({ messages, className }: { messages: Message[]; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Aguarda o próximo frame para garantir que o DOM foi renderizado
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages]);

  return (
    <div ref={scrollRef} className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}>
      <div className="space-y-3 p-3">
        {messages.filter(msg => msg.type !== "context_summary").map((msg, index) => (
          <div
            key={msg.id || index}
            className={cn("flex", msg.from_me ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] overflow-hidden rounded-2xl px-3 py-2 [overflow-wrap:anywhere]",
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
              {(msg.type === "audio" || msg.type === "image" || msg.type === "video" || msg.type === "document") && (
                <MediaBubble msg={msg} />
              )}
              {msg.content && (
                <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
              )}
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
    </div>
  );
}

// ── Tag Popover ───────────────────────────────────────────────────────────────
function TagPopover({ phone, className }: { phone: string; className?: string }) {
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
        <Button variant="outline" size="sm" className={cn("gap-1.5 shrink-0", className)}>
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

// ── Create Deal Button ────────────────────────────────────────────────────────
function CreateDealButton({ phone, contactName, className }: { phone: string; contactName?: string | null; className?: string }) {
  const { contacts } = useContacts();
  const { pipelines, activePipelineId } = useCRMPipelines();
  const { stages } = useCRMStages(activePipelineId);
  const stageIds = useMemo(() => stages.map((s) => s.id), [stages]);
  const { createDeal } = useCRMDeals(activePipelineId, stageIds);
  const [open, setOpen] = useState(false);

  const contact = contacts.find((c) => c.phone === phone);
  const contactsList = useMemo(
    () => (contacts || []).map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    [contacts]
  );

  const handleSave = async (data: any) => {
    await createDeal(data);
    toast.success("Negociação criada no CRM!");
  };

  if (!activePipelineId || stages.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-1.5 shrink-0", className)}
        onClick={() => setOpen(true)}
      >
        <Kanban className="h-4 w-4" />
        <span className="hidden sm:inline">Criar Deal</span>
      </Button>

      <DealDialog
        open={open}
        onOpenChange={setOpen}
        stages={stages}
        defaultStageId={stages[0]?.id}
        contacts={contactsList}
        defaultContactId={contact?.id}
        defaultTitle={contactName ? `Deal - ${contactName}` : `Deal - ${phone}`}
        onSave={handleSave}
        onDelete={() => {}}
      />
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Conversations() {
  const navigate = useNavigate();
  const { conversations, isLoading, sendMessage, toggleAI, finishConversation, deleteConversation, assignConversation } = useConversations();
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

        {/* Mobile Chat Fullscreen Overlay */}
        <Sheet open={!!selectedPhone} onOpenChange={(open) => !open && setSelectedPhone(null)}>
          <SheetContent side="right" hideClose className="z-[70] flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden border-l-0 p-0 sm:max-w-none">
            {/* Header */}
            <div className="flex items-center gap-2 border-b bg-background px-3 py-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPhone(null)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => openContactPage(selectedPhone)}
              >
                <p className="font-medium text-sm truncate">
                  {selectedConversation?.contact_name || selectedPhone}
                </p>
                <p className="text-xs text-muted-foreground truncate">{selectedPhone}</p>
              </button>
              <Button
                variant={selectedConversation?.ai_active ? "outline" : "default"}
                size="sm"
                onClick={() => toggleAI.mutate({
                  phone: selectedPhone,
                  active: !selectedConversation?.ai_active,
                })}
                disabled={toggleAI.isPending}
                className="shrink-0"
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

            {/* Action bar */}
            <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 px-3 py-2 shrink-0">
              <CreateDealButton phone={selectedPhone} contactName={selectedConversation?.contact_name} className="w-full justify-center" />
              <TagPopover phone={selectedPhone} className="w-full justify-center" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 justify-center">
                    <CheckCircle className="h-4 w-4" />
                    <span>Finalizar</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar conversa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As mensagens serão limpas, mas um resumo será salvo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      finishConversation.mutate({ phone: selectedPhone! });
                      setSelectedPhone(null);
                    }}>Finalizar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 justify-center text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span>Excluir</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A conversa será removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
                      deleteConversation.mutate({ phone: selectedPhone! });
                      setSelectedPhone(null);
                    }}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages */}
            <ChatMessages messages={messages} className="flex-1 min-h-0" />

            {/* Input */}
            <div className="border-t bg-background p-3 shrink-0">
              <div className="flex items-end gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Mensagem..."
                  disabled={sendMessage.isPending}
                  className="min-w-0 flex-1 text-base"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessage.isPending}
                  size="icon"
                  className="shrink-0"
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
          </SheetContent>
        </Sheet>
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

                  <div className="flex items-center gap-2 shrink-0">
                    <CreateDealButton phone={selectedPhone} contactName={selectedConversation?.contact_name} />
                    <TagPopover phone={selectedPhone} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <CheckCircle className="h-4 w-4" />
                          <span className="hidden xl:inline">Finalizar</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Finalizar conversa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            As mensagens serão limpas, mas um resumo será salvo. Quando o lead entrar em contato novamente, a IA o reconhecerá pelo nome.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            finishConversation.mutate({ phone: selectedPhone });
                            setSelectedPhone(null);
                          }}>Finalizar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden xl:inline">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A conversa será removida permanentemente. O lead será tratado como novo contato no próximo atendimento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
                            deleteConversation.mutate({ phone: selectedPhone });
                            setSelectedPhone(null);
                          }}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
