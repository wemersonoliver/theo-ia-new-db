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
  Check,
  Zap,
  Shield,
  ArrowRight,
  Star,
  Smartphone,
  Brain,
  TrendingUp,
  Timer,
  Target,
  Mic,
  Image as ImageIcon,
  Kanban,
  ListChecks,
  Repeat,
  HeartHandshake,
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
  { icon: Kanban, title: "CRM Kanban Integrado", desc: "Visualize e arraste seus leads pelo funil de vendas — do primeiro contato ao fechamento." },
  { icon: ListChecks, title: "Gestão de Tarefas", desc: "Crie e acompanhe tarefas vinculadas a clientes e negócios direto no painel." },
  { icon: Repeat, title: "Follow-up Automático", desc: "Cadência inteligente de 6 dias que reativa leads frios sem você lembrar." },
  { icon: Mic, title: "Resposta a Áudios", desc: "A IA escuta áudios do cliente, transcreve e responde no formato que ele preferir." },
  { icon: ImageIcon, title: "Análise de Imagens", desc: "Manda foto, documento ou comprovante? A IA lê, entende e responde com contexto." },
  { icon: HeartHandshake, title: "Persuasão com Ciência", desc: "Argumentos baseados em Cialdini, Chris Voss e os maiores nomes da negociação." },
];

const aiAdvantages = [
  {
    icon: Brain,
    title: "Vendedor treinado nos maiores livros de persuasão",
    desc: "Sua IA aplica gatilhos de Cialdini (Armas da Persuasão), técnicas de negociação de Chris Voss (Como Negociar Qualquer Coisa) e o método SPIN Selling em cada conversa — sem você precisar treinar ninguém.",
  },
  {
    icon: Timer,
    title: "Resposta em menos de 5 segundos, 24h por dia",
    desc: "Enquanto seus concorrentes demoram horas, sua IA responde no instante em que o cliente envia a mensagem — capturando a intenção de compra no momento mais quente.",
  },
  {
    icon: Target,
    title: "Atendimento consistente e sem dia ruim",
    desc: "Sem cansaço, sem mau humor, sem esquecer de fazer follow-up. Cada cliente recebe a melhor versão do seu atendimento, sempre.",
  },
  {
    icon: TrendingUp,
    title: "Escala infinita sem contratar ninguém",
    desc: "Atenda 1, 100 ou 10.000 clientes ao mesmo tempo com a mesma qualidade. Cresça sem dor de cabeça com folha de pagamento.",
  },
];

const responseStats = [
  { value: "78%", label: "dos clientes compram da empresa que responde primeiro", source: "Harvard Business Review" },
  { value: "5min", label: "é o tempo máximo para um lead esfriar drasticamente", source: "MIT Lead Response Study" },
  { value: "10x", label: "mais chances de converter respondendo em até 1 minuto", source: "InsideSales.com" },
  { value: "67%", label: "dos clientes desistem da compra por demora no atendimento", source: "Forrester Research" },
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
  "CRM Kanban com funil de vendas",
  "Gestão de tarefas e follow-up automático",
  "Transcrição de áudios e leitura de imagens",
  "Aplicativo 100% mobile — gerencie pelo celular",
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

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-[hsl(0,84%,60%)]/30 bg-[hsl(0,84%,60%)]/10 text-[hsl(0,84%,60%)]">
            <Clock className="mr-1 h-3 w-3" /> O custo invisível da demora
          </Badge>
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Cada minuto de espera é um cliente <span className="text-[hsl(0,84%,60%)]">perdido</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Estudos mostram que velocidade de resposta é o fator número 1 na decisão de compra moderna. E os números são assustadores:
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {responseStats.map((stat, i) => (
              <Card key={i} className="border-[hsl(0,84%,60%)]/20 bg-[hsl(222,47%,8%)] text-white">
                <CardContent className="p-6 text-center">
                  <p className="mb-2 text-4xl font-extrabold text-[hsl(0,84%,60%)]">{stat.value}</p>
                  <p className="mb-3 text-sm leading-snug text-white">{stat.label}</p>
                  <p className="text-xs italic text-slate-400">{stat.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/5 p-6 text-center">
            <p className="text-lg font-semibold text-white">
              ⚡ Com Theo IA, sua resposta sai em <span className="text-2xl text-[hsl(142,76%,36%)]">menos de 5 segundos</span> — 24h por dia, 7 dias por semana.
            </p>
          </div>
        </div>
      </section>

      {/* Vantagens da IA na Persuasão */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-[hsl(217,91%,60%)]/30 bg-[hsl(217,91%,60%)]/10 text-[hsl(217,91%,60%)]">
            <Brain className="mr-1 h-3 w-3" /> Inteligência que vende
          </Badge>
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Um assistente que <span className="text-[hsl(217,91%,60%)]">domina a arte da venda</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Theo IA não é um chatbot genérico. É um vendedor digital treinado nas técnicas dos melhores livros de persuasão e negociação do mundo.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {aiAdvantages.map((adv, i) => (
              <Card key={i} className="border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] text-white transition-all hover:border-[hsl(217,91%,60%)]/50">
                <CardContent className="p-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%)]/20 to-[hsl(142,76%,36%)]/20">
                    <adv.icon className="h-7 w-7 text-[hsl(217,91%,60%)]" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{adv.title}</h3>
                  <p className="text-sm leading-relaxed text-white">{adv.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 100% Mobile */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <Badge className="mb-4 flex w-fit items-center border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/10 text-[hsl(142,76%,36%)]">
                <Smartphone className="mr-1 h-3 w-3" /> Novidade
              </Badge>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                Gerencie tudo direto do <span className="text-[hsl(142,76%,36%)]">seu celular</span>
              </h2>
              <p className="mb-6 text-lg text-white">
                Esqueça a necessidade de computador. O Theo IA é 100% mobile — você configura sua IA, acompanha conversas, fecha vendas no CRM e responde clientes de qualquer lugar.
              </p>
              <ul className="space-y-3">
                {[
                  "Configure seu agente de IA pelo celular",
                  "Acompanhe leads e conversas em tempo real",
                  "Mova negociações no Kanban com o dedo",
                  "Receba notificações de cada novo lead",
                  "Atenda manualmente quando quiser assumir",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-white">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(142,76%,36%)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[hsl(217,91%,60%)]/20 to-[hsl(142,76%,36%)]/20 blur-2xl" />
              <div className="relative mx-auto aspect-[9/16] max-w-xs rounded-[2.5rem] border-8 border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] p-4 shadow-2xl">
                <div className="flex h-full flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(217,91%,60%)]/10 to-[hsl(222,47%,5%)] p-4">
                  <div className="flex items-center gap-2 border-b border-[hsl(217,33%,17%)] pb-3">
                    <div className="h-9 w-9 rounded-full bg-[hsl(217,91%,60%)]" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-white">Theo IA</div>
                      <div className="text-[10px] text-[hsl(142,76%,36%)]">● online agora</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-[10px]">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[hsl(217,33%,17%)] p-2 text-white">
                      Olá! Vi seu interesse no produto X 👋
                    </div>
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[hsl(142,76%,36%)] p-2 text-white">
                      Quanto custa?
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[hsl(217,33%,17%)] p-2 text-white">
                      Posso te explicar! Quer agendar 15 min hoje?
                    </div>
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[hsl(142,76%,36%)] p-2 text-white">
                      Pode ser às 15h ✅
                    </div>
                  </div>
                  <div className="mt-auto rounded-xl border border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/10 p-2 text-center text-[10px] font-semibold text-[hsl(142,76%,36%)]">
                    ✨ Agendamento criado
                  </div>
                </div>
              </div>
            </div>
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
        href="https://wa.me/5547991293662?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20sistema%20Theo%20IA"
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
