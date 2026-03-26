import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminSupportTickets, useTicketMessages } from "@/hooks/useSupportTickets";
import { useAuth } from "@/lib/auth";
import {
  Ticket, MessageSquare, Clock, CheckCircle2, XCircle, Send, Loader2, AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Aberto", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: MessageSquare },
  resolved: { label: "Resolvido", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  closed: { label: "Fechado", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "text-slate-400" },
  medium: { label: "Média", color: "text-amber-400" },
  high: { label: "Alta", color: "text-red-400" },
};

function TicketDetail({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { user } = useAuth();
  const { tickets, updateTicket } = useAdminSupportTickets();
  const { messages, isLoading, sendMessage } = useTicketMessages(ticketId);
  const [reply, setReply] = useState("");
  const ticket = tickets.find((t) => t.id === ticketId);

  const handleSend = async () => {
    if (!reply.trim()) return;
    await sendMessage.mutateAsync({ content: reply, senderType: "admin" });
    setReply("");
  };

  if (!ticket) return null;

  const st = statusConfig[ticket.status] || statusConfig.open;

  return (
    <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 bg-[hsl(222,47%,8%)] border-slate-800 text-slate-200">
      <DialogHeader className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-white">{ticket.subject}</DialogTitle>
          <Badge className={cn("text-xs", st.color)}>{st.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Select
            value={ticket.status}
            onValueChange={(v) => updateTicket.mutate({
              id: ticket.id,
              status: v,
              ...(v === "closed" ? { closed_at: new Date().toISOString() } : {}),
            })}
          >
            <SelectTrigger className="w-40 h-8 bg-slate-800 border-slate-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={ticket.priority}
            onValueChange={(v) => updateTicket.mutate({ id: ticket.id, priority: v })}
          >
            <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-500">{ticket.description}</p>
      </DialogHeader>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.sender_type === "admin" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2",
                msg.sender_type === "admin" ? "bg-amber-500/20 text-slate-200 rounded-br-sm" : "bg-slate-800 text-slate-300 rounded-bl-sm"
              )}>
                <p className="text-xs mb-1 text-slate-500">{msg.sender_type === "admin" ? "Admin" : "Usuário"}</p>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <p className="mt-1 text-right text-xs text-slate-600">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {messages.length === 0 && !isLoading && (
            <p className="text-center text-slate-500 text-sm py-8">Nenhuma mensagem ainda</p>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-slate-800 p-4">
        <div className="flex gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Responder ao ticket..."
            rows={2}
            className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            onClick={handleSend}
            disabled={!reply.trim() || sendMessage.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-black self-end"
          >
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function AdminSupport() {
  const { tickets, isLoading } = useAdminSupportTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tab, setTab] = useState("open");

  const filtered = tickets.filter((t) => {
    if (tab === "open") return t.status === "open" || t.status === "in_progress";
    if (tab === "resolved") return t.status === "resolved";
    if (tab === "closed") return t.status === "closed";
    return true;
  });

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;

  return (
    <AdminLayout title="Suporte" description="Gerencie tickets de suporte dos usuários">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Abertos", count: openCount, icon: AlertTriangle, color: "text-amber-400" },
          { label: "Resolvidos", count: resolvedCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Fechados", count: closedCount, icon: XCircle, color: "text-slate-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-8 w-8", s.color)} />
              <div>
                <p className="text-2xl font-bold text-white">{s.count}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="open" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
            Abertos ({openCount})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            Resolvidos ({resolvedCount})
          </TabsTrigger>
          <TabsTrigger value="closed" className="data-[state=active]:bg-slate-500/10 data-[state=active]:text-slate-300">
            Fechados ({closedCount})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400">
            Todos ({tickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
          ) : filtered.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="flex flex-col items-center py-12">
                <Ticket className="h-12 w-12 text-slate-600" />
                <p className="mt-4 text-sm text-slate-500">Nenhum ticket nesta categoria</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((ticket) => {
                const st = statusConfig[ticket.status] || statusConfig.open;
                const pr = priorityConfig[ticket.priority] || priorityConfig.medium;
                return (
                  <Card
                    key={ticket.id}
                    className="bg-slate-900/50 border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-white truncate">{ticket.subject}</p>
                            <Badge className={cn("text-xs shrink-0", st.color)}>{st.label}</Badge>
                            <span className={cn("text-xs", pr.color)}>● {pr.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 truncate">{ticket.description}</p>
                        </div>
                        <span className="text-xs text-slate-600 shrink-0">
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        {selectedTicketId && <TicketDetail ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />}
      </Dialog>
    </AdminLayout>
  );
}
