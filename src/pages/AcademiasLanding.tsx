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
import { FloatingSparkles } from "@/components/fx/FloatingSparkles";
import {
  MessageSquare,
  Dumbbell,
  CalendarCheck,
  Bell,
  CheckCircle2,
  Users,
  BarChart3,
  Clock,
  Check,
  Zap,
  Shield,
  ArrowRight,
  Brain,
  TrendingUp,
  Timer,
  Target,
  HeartHandshake,
  Repeat,
  Sparkles,
  Trophy,
  UserCheck,
} from "lucide-react";

const gymFeatures = [
  { icon: Users, title: "Atendimento no WhatsApp 24/7", desc: "Responde leads instantaneamente em qualquer horário, sem fila de espera e sem perder mensagem." },
  { icon: CalendarCheck, title: "Agendamento de aula experimental", desc: "A IA agenda aula experimental, avaliação física ou visita direto na agenda da sua academia." },
  { icon: Bell, title: "Lembretes automáticos de agendamento", desc: "Envia lembrete antes do horário agendado, reduzindo faltas em aulas experimentais e avaliações." },
  { icon: Repeat, title: "Follow-up automático de leads", desc: "Cadência inteligente para reengajar quem pediu informação e não fechou — sem você precisar lembrar." },
  { icon: Trophy, title: "Vende planos com argumentação", desc: "Treinada com técnicas de venda, responde objeções comuns (preço, tempo, indecisão) e direciona para o fechamento." },
  { icon: UserCheck, title: "Qualifica leads automaticamente", desc: "Separa curioso de comprador. Você só fala com quem realmente está pronto pra matricular." },
  { icon: BarChart3, title: "CRM Kanban de matrículas", desc: "Funil visual de leads — do primeiro contato à matrícula fechada — para acompanhar cada oportunidade." },
  { icon: Brain, title: "Base de conhecimento personalizada", desc: "Você cadastra planos, horários, modalidades e regras. A IA responde com as informações da SUA academia." },
  { icon: MessageSquare, title: "Áudio e imagem entendidos pela IA", desc: "Aluno mandou áudio? Foto da ficha de outro plano? A IA transcreve, lê e responde normalmente." },
];

const gymPains = [
  {
    icon: Clock,
    title: "Lead que chama no WhatsApp às 22h",
    desc: "Sem Theo IA: você só responde no outro dia e ele já fechou na concorrência. Com Theo IA: respondido em segundos, com aula experimental agendada para amanhã.",
  },
  {
    icon: TrendingUp,
    title: "Lead que pediu informação e sumiu",
    desc: "Sem Theo IA: ele esquece da sua academia e fecha em outra. Com Theo IA: follow-up automático em cadência reaquece o lead até a decisão.",
  },
  {
    icon: Target,
    title: "Recepção sobrecarregada",
    desc: "Sem Theo IA: a recepcionista perde venda atendendo dúvida por WhatsApp. Com Theo IA: ela cuida do aluno na porta enquanto a IA fecha matrícula online.",
  },
  {
    icon: Timer,
    title: "Falta em aula experimental marcada",
    desc: "Sem Theo IA: o lead esquece do horário e não aparece. Com Theo IA: lembrete automático antes do horário agendado reduz drasticamente o no-show.",
  },
];

const gymStats = [
  { value: "78%", label: "dos alunos escolhem a academia que responde primeiro", source: "Adaptado de Harvard Business Review" },
  { value: "5min", label: "é o tempo máximo para o lead da academia esfriar", source: "MIT Lead Response Study" },
  { value: "80%", label: "das vendas exigem 5+ follow-ups após o primeiro contato", source: "National Sales Executive Association" },
  { value: "3x", label: "mais matrículas com agendamento automático de aula experimental", source: "Estudo interno Theo IA" },
];

const faqItems = [
  { q: "Funciona pra qualquer tipo de academia?", a: "Sim. Academias de musculação, crossfit, pilates, funcional, lutas, yoga, natação — qualquer modalidade que precise captar e reter alunos pelo WhatsApp." },
  { q: "A IA consegue fechar matrícula sozinha?", a: "A IA qualifica o lead, agenda aula experimental e tira todas as dúvidas sobre planos e horários. O fechamento final pode ser automatizado ou transferido pra recepção — você escolhe." },
  { q: "Preciso entender de tecnologia?", a: "Não. Você responde algumas perguntas sobre sua academia (planos, horários, modalidades) e o Theo IA monta o atendente automaticamente." },
  { q: "E se o aluno quiser falar com pessoa real?", a: "A IA identifica e transfere a conversa pra você ou pra recepção de forma transparente, sem o aluno perceber atrito." },
  { q: "Posso conectar mais de um número?", a: "Sim. No plano Pro você conecta até 3 números — ideal pra separar comercial, recepção e personal trainer." },
  { q: "Funciona com Instagram Direct também?", a: "Não. O Theo IA opera exclusivamente no WhatsApp, que é onde a maior parte das matrículas é fechada hoje no Brasil." },
  { q: "A IA controla frequência de aluno ou inadimplência?", a: "Não. O Theo IA é focado em atendimento, vendas e agendamento via WhatsApp. Controle de frequência e financeiro continuam no seu sistema atual." },
  { q: "O que é o plano Theo Personalitê?", a: "É um sistema personalizado feito exclusivamente para a sua academia: integrações específicas, fluxos sob medida e suporte dedicado. Inclui tudo do Pro como base." },
];

const basicIncluded = [
  "1 número de WhatsApp conectado",
  "Atendimento com IA 24/7",
  "Agendamento de aula experimental",
  "Base de conhecimento personalizada",
  "Lembretes automáticos de agendamento",
  "Transcrição de áudios e leitura de imagens",
  "Suporte por WhatsApp",
];

const proIncluded = [
  "Tudo do Basic",
  "Até 3 números de WhatsApp conectados",
  "CRM Kanban com funil de matrículas",
  "Follow-up automático de leads",
  "Follow up avançado",
  "Dashboard avançada",
  "Gestão de tarefas da equipe",
  "Múltiplos atendentes na mesma conta",
  "Suporte prioritário por WhatsApp",
];

const personaliteIncluded = [
  "Tudo do Plano Pro",
  "Sistema personalizado para a sua academia",
  "Integrações sob medida conforme a necessidade",
  "Fluxos de atendimento customizados",
  "Treinamento da IA com a identidade da sua marca",
  "Onboarding assistido por especialista",
  "Suporte dedicado e exclusivo",
  "Evoluções e ajustes contínuos",
];

export default function AcademiasLanding() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,5%)] text-[hsl(210,40%,98%)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[hsl(217,33%,17%)] bg-[hsl(222,47%,5%)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={theoLogo} alt="Theo IA" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold">Theo IA <span className="text-[hsl(142,76%,36%)]">| Academias</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-[hsl(210,40%,98%)] hover:text-[hsl(142,76%,36%)]">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)]">
              <Link to="/register">Testar Grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(142,76%,36%)]/10 to-transparent" />
        <FloatingSparkles count={20} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(142,76%,36%)] to-[hsl(217,91%,60%)] shadow-[0_0_45px_hsl(142,76%,36%,0.4)]">
            <Dumbbell className="h-12 w-12 text-white" />
          </div>
          <Badge className="mb-6 border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/10 text-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,36%)]/20">
            <Zap className="mr-1 h-3 w-3" /> Feito sob medida para donos de academia
          </Badge>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Pare de perder aluno por{" "}
            <span className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(217,91%,60%)] bg-clip-text text-transparent">
              demora no WhatsApp
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white md:text-xl">
            O Theo IA atende seus leads no WhatsApp em segundos, agenda aulas experimentais
            e faz follow-up automático até a matrícula —
            <strong className="text-[hsl(142,76%,36%)]"> 24 horas por dia, 7 dias por semana</strong>.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="h-14 px-6 sm:px-8 text-base bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] w-full sm:w-auto">
              <Link to="/register">
                Quero Testar Grátis por 7 Dias <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white">
            <Shield className="mr-1 inline h-4 w-4" /> Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Pains */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-[hsl(0,84%,60%)]/30 bg-[hsl(0,84%,60%)]/10 text-[hsl(0,84%,60%)]">
            <Clock className="mr-1 h-3 w-3" /> A realidade de quem gerencia academia
          </Badge>
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Você já <span className="text-[hsl(0,84%,60%)]">perdeu matrícula</span> assim?
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Toda academia perde aluno todo mês pelos mesmos motivos. O Theo IA resolve cada um deles:
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {gymPains.map((p, i) => (
              <Card key={i} className="border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] text-white transition-all hover:border-[hsl(142,76%,36%)]/50">
                <CardContent className="p-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(0,84%,60%)]/20 to-[hsl(142,76%,36%)]/20">
                    <p.icon className="h-7 w-7 text-[hsl(142,76%,36%)]" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-white">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Os números do mercado fitness <span className="text-[hsl(142,76%,36%)]">não mentem</span>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {gymStats.map((stat, i) => (
              <Card key={i} className="border-[hsl(142,76%,36%)]/20 bg-[hsl(222,47%,8%)] text-white">
                <CardContent className="p-6 text-center">
                  <p className="mb-2 text-4xl font-extrabold text-[hsl(142,76%,36%)]">{stat.value}</p>
                  <p className="mb-3 text-sm leading-snug text-white">{stat.label}</p>
                  <p className="text-xs italic text-slate-400">{stat.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features pra academia */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Tudo que sua academia precisa <span className="text-[hsl(142,76%,36%)]">automatizado</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Captação, retenção, agendamento e cobrança — em um único sistema, no WhatsApp que você já usa.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gymFeatures.map((f, i) => (
              <Card key={i} className="border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] text-white transition-all hover:border-[hsl(142,76%,36%)]/50">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[hsl(142,76%,36%)]/10">
                    <f.icon className="h-6 w-6 text-[hsl(142,76%,36%)]" />
                  </div>
                  <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                  <p className="text-sm text-white">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Escolha o plano da sua academia
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white">
            Três planos pensados para crescer com você — do estúdio pequeno até a rede com várias unidades.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Basic */}
            <Card className="relative overflow-hidden border border-[hsl(217,33%,17%)] bg-[hsl(222,47%,8%)] text-white">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h3 className="mb-1 text-2xl font-extrabold text-white">Plano Basic</h3>
                  <p className="text-sm text-white/70">Para estúdios e academias iniciando</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-white">R$</span>
                    <span className="text-5xl font-extrabold text-white">97</span>
                    <span className="text-white">/mês</span>
                  </div>
                </div>
                <ul className="mb-8 space-y-3">
                  {basicIncluded.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <Check className="h-5 w-5 shrink-0 text-[hsl(217,91%,60%)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button size="lg" asChild variant="outline" className="w-full h-14 text-base border-[hsl(217,91%,60%)] text-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,60%)] hover:text-white">
                  <Link to="/register">
                    Testar 7 Dias Grátis <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="relative overflow-hidden border-2 border-[hsl(142,76%,36%)] bg-[hsl(222,47%,8%)] text-white">
              <div className="absolute right-0 top-0 rounded-bl-xl bg-[hsl(142,76%,36%)] px-4 py-1.5 text-sm font-bold text-white">
                MAIS POPULAR
              </div>
              <CardContent className="p-8 pt-12">
                <div className="mb-6">
                  <h3 className="mb-1 text-2xl font-extrabold text-white">Plano Pro</h3>
                  <p className="text-sm text-white/70">Para academias que querem escalar matrículas</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-white">R$</span>
                    <span className="text-5xl font-extrabold text-white">149</span>
                    <span className="text-white">/mês</span>
                  </div>
                </div>
                <ul className="mb-8 space-y-3">
                  {proIncluded.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <Check className="h-5 w-5 shrink-0 text-[hsl(142,76%,36%)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button size="lg" asChild className="w-full h-14 text-base bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)]">
                  <Link to="/register">
                    Testar 7 Dias Grátis <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Theo Personalitê */}
            <Card className="relative overflow-hidden border-2 border-[hsl(45,93%,55%)] bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(45,93%,10%)] text-white">
              <div className="absolute right-0 top-0 rounded-bl-xl bg-gradient-to-r from-[hsl(45,93%,55%)] to-[hsl(38,92%,50%)] px-4 py-1.5 text-sm font-bold text-[hsl(222,47%,5%)]">
                <Sparkles className="mr-1 inline h-3 w-3" /> EXCLUSIVO
              </div>
              <CardContent className="p-8 pt-12">
                <div className="mb-6">
                  <h3 className="mb-1 text-2xl font-extrabold text-[hsl(45,93%,55%)]">Theo Personalitê</h3>
                  <p className="text-sm text-white/70">Sistema feito sob medida pra sua academia</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">Sob consulta</span>
                  </div>
                  <p className="mt-1 text-xs text-white/60">Conversamos pra montar o plano ideal pra você</p>
                </div>
                <ul className="mb-8 space-y-3">
                  {personaliteIncluded.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <Check className="h-5 w-5 shrink-0 text-[hsl(45,93%,55%)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  asChild
                  className="w-full h-14 text-base bg-[hsl(45,93%,55%)] hover:bg-[hsl(45,93%,48%)] text-[hsl(222,47%,5%)] font-bold"
                >
                  <a
                    href="https://wa.me/5547991293662?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20plano%20Theo%20Personalit%C3%AA%20para%20minha%20academia"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Falar com Especialista <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Brain advantage */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-[hsl(217,91%,60%)]/30 bg-[hsl(217,91%,60%)]/10 text-[hsl(217,91%,60%)]">
            <Brain className="mr-1 h-3 w-3" /> Não é um chatbot qualquer
          </Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Um vendedor digital treinado pra <span className="text-[hsl(142,76%,36%)]">academia</span>
          </h2>
          <p className="mx-auto max-w-2xl text-white">
            O Theo IA usa técnicas de persuasão de Cialdini, Chris Voss e SPIN Selling adaptadas
            para o universo fitness: ele entende objeções como "vou pensar", "tá caro" ou
            "tô sem tempo" e responde com o argumento certo pra converter.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Perguntas frequentes de quem tem academia
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
        <div className="mx-auto max-w-3xl rounded-2xl border border-[hsl(142,76%,36%)]/30 bg-gradient-to-br from-[hsl(142,76%,36%)]/10 to-[hsl(217,91%,60%)]/10 p-10 text-center md:p-16">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Enquanto você lê isso, um lead está pedindo plano no WhatsApp
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-white">
            Cada hora sem resposta é uma matrícula que vai pra concorrência.
            Coloca o Theo IA pra trabalhar pela sua academia hoje mesmo.
          </p>
          <Button size="lg" asChild className="h-14 px-6 sm:px-10 text-base bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] w-full sm:w-auto">
            <Link to="/register">
              Começar Meus 7 Dias Grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(217,33%,17%)] px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-3 text-center text-sm text-white">
          <p>© {new Date().getFullYear()} Theo IA. Todos os direitos reservados.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/70">
            <a href="/terms" className="hover:text-white transition-colors">Termos de Uso</a>
            <span className="text-white/30">•</span>
            <a href="/privacy" className="hover:text-white transition-colors">Política de Privacidade</a>
          </nav>
        </div>
      </footer>

      {/* WhatsApp floating */}
      <a
        href="https://wa.me/5547991293662?text=Ol%C3%A1!%20Tenho%20uma%20academia%20e%20quero%20saber%20mais%20sobre%20o%20Theo%20IA"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-[#25D366] pl-5 pr-6 py-3 text-white shadow-xl transition-transform hover:scale-105"
      >
        <MessageSquare className="h-6 w-6 shrink-0" />
        <span className="text-sm font-semibold leading-tight">
          Tem academia?<br />
          <span className="font-normal">Fale com nossa equipe!</span>
        </span>
      </a>
    </div>
  );
}