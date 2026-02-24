import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useConversations } from "@/hooks/useConversations";
import { useAIConfig } from "@/hooks/useAIConfig";
import { MessageSquare, Smartphone, Bot, TrendingUp, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TutorialPopup } from "@/components/TutorialPopup";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { instance } = useWhatsAppInstance();
  const { conversations } = useConversations();
  const { config } = useAIConfig();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const todayMessages = conversations.reduce((total, conv) => {
    const todayMsgs = (conv.messages || []).filter((msg) => {
      const msgDate = new Date(msg.timestamp);
      const today = new Date();
      return (
        msgDate.getDate() === today.getDate() &&
        msgDate.getMonth() === today.getMonth() &&
        msgDate.getFullYear() === today.getFullYear()
      );
    });
    return total + todayMsgs.length;
  }, 0);

  const activeConversations = conversations.filter((conv) => {
    if (!conv.last_message_at) return false;
    const lastMsg = new Date(conv.last_message_at);
    const now = new Date();
    const diffHours = (now.getTime() - lastMsg.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  }).length;

  const stats = [
    {
      title: "Status WhatsApp",
      value: instance?.status === "connected" ? "Conectado" : "Desconectado",
      icon: Smartphone,
      variant: instance?.status === "connected" ? "success" : "destructive",
    },
    {
      title: "Agente IA",
      value: config?.active ? "Ativo" : "Inativo",
      icon: Bot,
      variant: config?.active ? "success" : "secondary",
    },
    {
      title: "Mensagens Hoje",
      value: todayMessages.toString(),
      icon: MessageSquare,
      variant: "default",
    },
    {
      title: "Conversas Ativas",
      value: activeConversations.toString(),
      icon: TrendingUp,
      variant: "default",
    },
  ];

  return (
    <DashboardLayout 
      title="Dashboard" 
      description="Visão geral do seu sistema de atendimento"
    >
      <TutorialPopup externalOpen={tutorialOpen} onExternalClose={() => setTutorialOpen(false)} />
      
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={() => setTutorialOpen(true)} className="gap-2">
          <PlayCircle className="h-4 w-4" />
          Tutorial
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stat.variant === "success" || stat.variant === "destructive" || stat.variant === "secondary" ? (
                  <Badge 
                    variant={stat.variant === "success" ? "default" : stat.variant}
                    className={stat.variant === "success" ? "bg-accent text-accent-foreground" : ""}
                  >
                    {stat.value}
                  </Badge>
                ) : (
                  <span className="text-2xl font-bold">{stat.value}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversas Recentes</CardTitle>
            <CardDescription>
              Últimas conversas no seu WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa ainda
              </p>
            ) : (
              <div className="space-y-3">
                {conversations.slice(0, 5).map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{conv.contact_name || conv.phone}</p>
                      <p className="text-sm text-muted-foreground">
                        {conv.total_messages} mensagens
                      </p>
                    </div>
                    {conv.ai_active ? (
                      <Badge variant="outline" className="text-accent">IA Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Humano</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuração Rápida</CardTitle>
            <CardDescription>
              Passos para configurar seu atendimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${instance?.status === "connected" ? "bg-accent" : "bg-destructive"}`} />
                <span>Conectar WhatsApp</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${config?.custom_prompt ? "bg-accent" : "bg-muted"}`} />
                <span>Configurar Agente IA</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
