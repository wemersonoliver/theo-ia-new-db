import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import theoLogo from "@/assets/logo_theo_ia.png";
import {
  MessageSquare,
  Bot,
  CalendarCheck,
  BookOpen,
  Bell,
  CheckCircle2,
  Users,
  BarChart3,
  Clock,
  X,
  Check,
  Zap,
  Shield,
  ArrowRight,
  Star,
} from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Atendimento 24/7", desc: "Responda clientes automaticamente via WhatsApp, a qualquer hora do dia ou da noite." },
  { icon: Users, title: "Qualificação de Leads", desc: "Identifique e qualifique seus melhores clientes automaticamente com IA." },
  { icon: CalendarCheck, title: "Agendamento Automático", desc: "Agende consultas e reuniões sem intervenção humana." },
  { icon: BookOpen, title: "Base de Conhecimento", desc: "Ensine a IA sobre seu negócio com documentos e informações personalizadas." },
  { icon: Bell, title: "Lembretes Automáticos", desc: "Envie lembretes de compromissos e reduza faltas em até 80%." },
  { icon: CheckCircle2, title: "Confirmação por IA", desc: "Confirme agendamentos automaticamente com seus clientes." },
  { icon: Bot, title: "Múltiplas Conversas", desc: "Atenda dezenas de clientes simultaneamente sem perder qualidade." },
  { icon: Star, title: "Configuração via Chat", desc: "Um consultor de IA conversa com você, entende seu negócio e cria o prompt perfeito de atendimento — sem esforço." },
  { icon: Zap, title: "Ajustes com IA", desc: "Teste seu agente em tempo real e receba sugestões inteligentes para melhorar o atendimento automaticamente." },
  { icon: BarChart3, title: "Dashboard Completo", desc: "Acompanhe métricas, relatórios e o desempenho do seu atendimento." },
];

const cltVsTheo = [
  { label: "Custo mensal", clt: "R$ 3.000+ (salário + encargos)", theo: "R$ 97/mês" },
  { label: "Disponibilidade", clt: "8h por dia, 5 dias/semana", theo: "24h por dia, 7 dias/semana" },
  { label: "Férias", clt: "30 dias pagos por ano", theo: "Nunca tira férias" },
  { label: "13° Salário", clt: "Sim, obrigatório", theo: "Não se aplica" },
  { label: "Faltas e atestados", clt: "Fica doente, falta", theo: "Nunca fica doente" },
  { label: "Conversas simultâneas", clt: "1 por vez", theo: "Ilimitadas" },
  { label: "Tempo de resposta", clt: "Minutos a horas", theo: "Segundos" },
];

const faqItems = [
  { q: "Preciso ter conhecimento técnico?", a: "Não! O sistema é intuitivo e fácil de configurar. Em poucos minutos você conecta seu WhatsApp e começa a usar." },
  { q: "Funciona com qualquer tipo de negócio?", a: "Sim! Clínicas, escritórios, lojas, prestadores de serviço — qualquer negócio que atenda clientes pelo WhatsApp." },
  { q: "E se eu quiser cancelar?", a: "Você pode cancelar a qualquer momento, sem multa ou burocracia. Nos primeiros 7 dias, é totalmente grátis." },
  { q: "A IA substitui completamente o atendimento humano?", a: "A IA cuida do primeiro atendimento, qualificação e agendamentos. Quando necessário, transfere a conversa para um humano de forma transparente." },
  { q: "Quantos números de WhatsApp posso conectar?", a: "Você pode conectar seu número principal de WhatsApp e gerenciar todas as conversas pelo painel." },
  { q: "Como a IA aprende sobre meu negócio?", a: "Você alimenta a base de conhecimento com documentos, textos e informações sobre seus serviços. A IA usa isso para responder com precisão." },
  { q: "O que é a Configuração via Chat?", a: "É um consultor de IA que conversa com você, faz perguntas sobre seu negócio e gera automaticamente o prompt ideal de atendimento — adaptado para vendas, pré-atendimento, agendamentos ou suporte." },
  { q: "Como funcionam os Ajustes com IA?", a: "Você pode testar seu agente em um simulador e, ao lado, uma IA analisa a conversa em tempo real, sugere melhorias e pode aplicar ajustes no prompt automaticamente — tudo sem sair do painel." },
];

const included = [
  "Atendimento automático 24/7",
  "Qualificação inteligente de leads",
  "Agendamento automático",
  "Base de conhecimento personalizada",
  "Lembretes automáticos",
  "Confirmação de agendamentos",
  "Múltiplas conversas simultâneas",
  "Dashboard com métricas",
  "Configuração do agente via chat com IA",
  "Ajustes inteligentes com simulador + IA",
  "Suporte por WhatsApp",
  "Atualizações gratuitas",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,5%)] text-[hsl(210,40%,98%)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[hsl(217,33%,17%)] bg-[hsl(222,47%,5%)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={theoLogo} alt="Theo IA" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold">Theo IA</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-[hsl(210,40%,98%)] hover:text-[hsl(217,91%,60%)]">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)]">
              <Link to="/register">Começar Grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(217,91%,60%)]/10 to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <img src={theoLogo} alt="Theo IA" className="mx-auto mb-8 h-40 w-40 rounded-full drop-shadow-[0_0_25px_hsl(217,91%,60%,0.3)]" />
          <Badge className="mb-6 border-[hsl(217,91%,60%)]/30 bg-[hsl(217,91%,60%)]/10 text-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,60%)]/20">
            <Zap className="mr-1 h-3 w-3" /> 7 dias grátis — sem cartão de crédito
          </Badge>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Seu Funcionário Digital que Trabalha{" "}
            <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,36%)] bg-clip-text text-transparent">
              24h por Dia
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white md:text-xl">
            Automatize seu atendimento no WhatsApp com inteligência artificial.
            Qualifique leads, agende consultas e nunca perca uma venda — pagando apenas{" "}
            <strong className="text-[hsl(142,76%,36%)]">R$ 97/mês</strong>.
          </p>
           <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
             <Button size="lg" asChild className="h-14 px-6 sm:px-8 text-base bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)] w-full sm:w-auto">
               <Link to="/register">
                 Comece Seu Teste Grátis de 7 Dias <ArrowRight className="ml-2 h-5 w-5" />
               </Link>
             </Button>
           </div>
          <p className="mt-4 text-sm text-white">
            <Shield className="mr-1 inline h-4 w-4" /> Cancele quando quiser. Sem compromisso.
          </p>
        </div>
      </section>

       {/* Problema vs Solução */}
       <section className="px-4 py-20">
         <div className="mx-auto max-w-5xl">
           <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
             Por que continuar pagando <span className="text-[hsl(0,84%,60%)]">caro</span> por atendimento?
           </h2>
           <p className="mx-auto mb-12 max-w-2xl text-center text-white">
             Um funcionário CLT custa mais de R$ 3.000/mês com encargos. E ainda tira férias, fica doente e trabalha só 8 horas. Compare:
           </p>
          <div className="overflow-hidden rounded-xl border border-[hsl(217,33%,17%)]">
            <div className="grid grid-cols-3 bg-[hsl(222,47%,8%)]">
              <div className="p-4 font-semibold text-white" />
              <div className="flex items-center justify-center gap-2 border-l border-[hsl(217,33%,17%)] p-4 font-bold text-[hsl(0,84%,60%)]">
                <X className="h-5 w-5" /> CLT
              </div>
              <div className="flex items-center justify-center gap-2 border-l border-[hsl(217,33%,17%)] p-4 font-bold text-[hsl(142,76%,36%)]">
                <Check className="h-5 w-5" /> Theo IA
              </div>
            </div>
            {cltVsTheo.map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-t border-[hsl(217,33%,17%)]">
                <div className="p-4 text-sm font-medium text-white">{row.label}</div>
                <div className="border-l border-[hsl(217,33%,17%)] p-4 text-sm text-white">{row.clt}</div>
                <div className="border-l border-[hsl(217,33%,17%)] p-4 text-sm text-[hsl(142,76%,36%)]">{row.theo}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/5 p-6 text-center">
            <p className="text-lg font-semibold">
              💰 Economia de até <span className="text-2xl text-[hsl(142,76%,36%)]">R$ 34.836/ano</span> substituindo um atendente CLT pelo Theo IA
            </p>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Tudo que você precisa em <span className="text-[hsl(217,91%,60%)]">um só lugar</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Funcionalidades completas para automatizar e escalar seu atendimento via WhatsApp.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Card key={i} className="border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] text-white transition-all hover:border-[hsl(217,91%,60%)]/50 hover:shadow-lg hover:shadow-[hsl(217,91%,60%)]/5">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[hsl(217,91%,60%)]/10">
                    <f.icon className="h-6 w-6 text-[hsl(217,91%,60%)]" />
                  </div>
                  <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                  <p className="text-sm text-white">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Preço */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Investimento que se paga no <span className="text-[hsl(142,76%,36%)]">primeiro dia</span>
          </h2>
          <Card className="relative overflow-hidden border-2 border-[hsl(217,91%,60%)] bg-[hsl(222,47%,8%)] text-white">
            <div className="absolute right-0 top-0 rounded-bl-xl bg-[hsl(142,76%,36%)] px-4 py-1.5 text-sm font-bold text-white">
              7 DIAS GRÁTIS
            </div>
            <CardContent className="p-8 pt-12">
              <div className="mb-6 text-center">
                <p className="mb-1 text-sm text-white">Plano completo</p>
                <div className="flex items-baseline justify-center gap-1">
                   <span className="text-sm text-white">R$</span>
                   <span className="text-6xl font-extrabold text-white">97</span>
                   <span className="text-white">/mês</span>
                </div>
              </div>
              <ul className="mb-8 space-y-3">
                {included.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white">
                    <Check className="h-5 w-5 shrink-0 text-[hsl(142,76%,36%)]" />
                    {item}
                  </li>
                ))}
              </ul>
               <Button size="lg" asChild className="w-full h-14 text-base bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)]">
                 <Link to="/register">
                   Começar Agora — 7 Dias Grátis <ArrowRight className="ml-2 h-5 w-5" />
                 </Link>
               </Button>
              <p className="mt-3 text-center text-xs text-white">
                Cancele a qualquer momento. Sem multa.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-4 py-16">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-[hsl(217,91%,60%)]">24/7</p>
            <p className="text-sm text-white">Disponível sempre</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[hsl(142,76%,36%)]">&lt;5s</p>
            <p className="text-sm text-white">Tempo de resposta</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[hsl(38,92%,50%)]">∞</p>
            <p className="text-sm text-white">Conversas simultâneas</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[hsl(217,91%,60%)]">80%</p>
            <p className="text-sm text-white">Menos faltas</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Perguntas Frequentes
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) => (
               <AccordionItem key={i} value={`faq-${i}`} className="rounded-lg border border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] px-4 text-white">
                 <AccordionTrigger className="text-left text-white hover:no-underline">
                   {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-white">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[hsl(217,91%,60%)]/30 bg-gradient-to-br from-[hsl(217,91%,60%)]/10 to-[hsl(142,76%,36%)]/10 p-10 text-center md:p-16">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Comece hoje e veja resultados em minutos
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-white">
            Enquanto você hesita, seus concorrentes já estão automatizando o atendimento.
            Não perca mais clientes por falta de resposta.
          </p>
           <Button size="lg" asChild className="h-14 px-6 sm:px-10 text-base bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)] w-full sm:w-auto">
             <Link to="/register">
               Quero Meus 7 Dias Grátis <ArrowRight className="ml-2 h-5 w-5" />
             </Link>
           </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(217,33%,17%)] px-4 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-white">
          <p>© {new Date().getFullYear()} Theo IA. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Balão flutuante WhatsApp */}
      <a
        href="https://wa.me/5547984863023?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20sistema%20Theo%20IA"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-[#25D366] pl-5 pr-6 py-3 text-white shadow-xl transition-transform hover:scale-105 animate-in slide-in-from-bottom-4 duration-500"
      >
        <MessageSquare className="h-6 w-6 shrink-0" />
        <span className="text-sm font-semibold leading-tight">
          Está com dúvidas?<br />
          <span className="font-normal">Fale agora com nossa equipe!</span>
        </span>
      </a>
    </div>
  );
}
