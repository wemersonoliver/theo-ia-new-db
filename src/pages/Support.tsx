import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSupportTickets, useTicketMessages } from "@/hooks/useSupportTickets";
import { useAuth } from "@/lib/auth";
import {
  MessageSquare, Ticket, Plus, Send, Loader2, Clock, CheckCircle2, XCircle, ExternalLink, ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const SUPPORT_PHONE = "5547991293662";
const SUPPORT_MESSAGE = encodeURIComponent("Olá! Preciso de suporte para o Theo IA");

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Aberto", variant: "default" },
  in_progress: { label: "Em Andamento", variant: "secondary" },
  resolved: { label: "Resolvido", variant: "outline" },
  closed: { label: "Fechado", variant: "outline" },
};

function TicketChat({ ticketId, fullHeight = false }: { ticketId: string; fullHeight?: boolean }) {
  const { messages, isLoading, sendMessage } = useTicketMessages(ticketId);
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim()) return;
    await sendMessage.mutateAsync({ content: reply, senderType: "user" });
    setReply("");
  };

  return (
    <div className={cn("flex flex-col", fullHeight ? "flex-1 min-h-0" : "h-[50vh]")}>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.sender_type === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2",
                msg.sender_type === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
              )}>
                <p className="text-xs mb-1 text-muted-foreground">{msg.sender_type === "admin" ? "Suporte" : "Você"}</p>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <p className="mt-1 text-right text-xs opacity-60">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {messages.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem. Envie sua primeira mensagem!</p>
          )}
        </div>
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escreva sua mensagem..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={sendMessage.isPending}
        />
        <Button onClick={handleSend} disabled={!reply.trim() || sendMessage.isPending} size="icon">
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function Support() {
  const { tickets, isLoading, createTicket } = useSupportTickets();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const isMobile = useIsMobile();

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) return;
    await createTicket.mutateAsync({ subject, description, priority });
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCreateOpen(false);
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  return (
    <DashboardLayout title="Suporte" description="Fale conosco ou abra um ticket">
      {/* WhatsApp CTA */}
      <Card className="mb-6">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Precisa de ajuda rápida?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fale diretamente com nosso suporte via WhatsApp para atendimento imediato.
            </p>
          </div>
          <a
            href={`https://wa.me/${SUPPORT_PHONE}?text=${SUPPORT_MESSAGE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[hsl(142,70%,45%)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[hsl(142,70%,40%)] shrink-0"
          >
            <MessageSquare className="h-5 w-5" />
            Falar via WhatsApp
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      {/* Tickets header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Ticket className="h-5 w-5" /> Meus Tickets
        </h2>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Ticket
        </Button>
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Ticket className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">Nenhum ticket aberto</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Criar Primeiro Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const st = statusLabels[ticket.status] || statusLabels.open;
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{ticket.subject}</p>
                        <Badge variant={st.variant} className="text-xs shrink-0">{st.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{ticket.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ticket de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do problema" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o problema em detalhes..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!subject.trim() || !description.trim() || createTicket.isPending}>
              {createTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicketId && !isMobile} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          {selectedTicket && (
            <>
              <DialogHeader className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <DialogTitle>{selectedTicket.subject}</DialogTitle>
                  <Badge variant={statusLabels[selectedTicket.status]?.variant || "default"} className="text-xs">
                    {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedTicket.description}</p>
              </DialogHeader>
              <TicketChat ticketId={selectedTicket.id} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile fullscreen */}
      {isMobile && selectedTicket && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-200">
          <div className="flex items-center gap-2 border-b bg-background px-3 py-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setSelectedTicketId(null)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{selectedTicket.subject}</p>
                <Badge variant={statusLabels[selectedTicket.status]?.variant || "default"} className="text-xs shrink-0">
                  {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{selectedTicket.description}</p>
            </div>
          </div>
          <TicketChat ticketId={selectedTicket.id} fullHeight />
        </div>
      )}
    </DashboardLayout>
  );
}
