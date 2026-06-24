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
import { FloatingSparkles } from "@/components/fx/FloatingSparkles";
import {
  MessageSquare,
  Bot,
  CheckCircle2,
  Users,
  Clock,
  Check,
  Zap,
  Shield,
  ArrowRight,
  Smartphone,
  Brain,
  TrendingUp,
  Timer,
  Target,
  Mic,
  Image as ImageIcon,
  Repeat,
  Leaf,
  Sun,
  DollarSign,
  FileText,
  Sparkles,
  AlertCircle,
} from "lucide-react";

const igreenFeatures = [
  { icon: Sun, title: "Treinado em Energia por Assinatura", desc: "A IA já entende o modelo Igreen, energia limpa, desconto na conta e como explicar tudo isso em linguagem simples." },
  { icon: DollarSign, title: "Simulação de Economia Automática", desc: "Quando o lead manda o valor da conta, a IA já calcula e apresenta a economia mensal e anual de forma persuasiva." },
  { icon: FileText, title: "Coleta de Documentos pelo WhatsApp", desc: "A IA solicita conta de luz, RG/CNH e CPF/CNPJ e organiza tudo no painel pronto para o cadastro." },
  { icon: Users, title: "Qualificação de Lead Igreen", desc: "Filtra automaticamente CPF x CNPJ, região atendida pela Igreen e perfil de consumo antes de marcar reunião." },
  { icon: AlertCircle, title: "Quebra de Objeções Prontas", desc: "Respostas testadas para 'é golpe?', 'preciso instalar painel?', 'e se eu mudar de endereço?' e as principais dúvidas do cliente Igreen." },
  { icon: MessageSquare, title: "Atendimento 24/7 no seu Número", desc: "Trabalha enquanto você dorme. Nunca mais perca um lead que chegou de madrugada ou no fim de semana." },
  { icon: Repeat, title: "Follow-up Igreen de 2 Meses", desc: "Cadência automática de 60 dias que reativa leads frios — tanto quem pediu para 'pensar' quanto quem nunca respondeu a primeira mensagem — e te avisa assim que o lead voltar a interagir." },
  { icon: Mic, title: "Entende Áudio do Cliente", desc: "Cliente Igreen adora mandar áudio. A IA escuta, transcreve e responde do mesmo jeito — texto ou áudio." },
  { icon: ImageIcon, title: "Valida a Conta de Luz Automaticamente", desc: "Cliente mandou foto da fatura? A IA confirma se é uma conta de luz real, identifica titular, distribuidora e valor — bloqueando documentos inválidos antes de seguir o atendimento." },
  { icon: Bot, title: "Transferência Inteligente", desc: "Quando o lead está quente, a IA te avisa no WhatsApp para você só assinar o contrato." },
  { icon: Smartphone, title: "100% Mobile", desc: "Configure, acompanhe leads e feche contratos Igreen direto do celular, em qualquer lugar." },
];

const igreenPains = [
  { value: "70%", label: "dos leads de energia por assinatura desistem por demora na resposta", source: "Benchmark interno parceiros Igreen" },
  { value: "3x", label: "mais contratos fechados quando o lead é respondido em menos de 1 minuto", source: "InsideSales.com" },
  { value: "60%", label: "do tempo do representante Igreen vai embora em conversas que não fecham", source: "Estudo de produtividade comercial" },
  { value: "24h", label: "é o tempo médio que um lead Igreen espera por uma resposta humana", source: "Pesquisa de campo" },
];

const igreenAdvantages = [
  {
    icon: Brain,
    title: "Discurso Igreen na ponta da língua",
    desc: "A IA já vem treinada com os argumentos que funcionam no nicho de energia: desconto garantido em contrato, sem obra, sem instalação, energia limpa. Você não precisa montar prompt do zero.",
  },
  {
    icon: Timer,
    title: "Atende lead de campanha em segundos",
    desc: "Rodou anúncio no Instagram, Facebook ou TikTok? A IA pega o lead no momento exato do interesse e leva ele do 'oi' até a reunião marcada — sem você travar atendendo um por um.",
  },
  {
    icon: Target,
    title: "Filtra quem realmente vale a pena",
    desc: "Para de perder tempo com cliente fora da área de atendimento ou com conta baixa demais. A IA qualifica e só passa para você os leads com perfil real de fechamento.",
  },
  {
    icon: TrendingUp,
    title: "Escala sua operação Igreen",
    desc: "Quer atender 10, 100 ou 500 leads por dia? A IA escala junto com sua campanha — sem contratar SDR, sem treinamento, sem dor de cabeça.",
  },
];

const igreenIncluded = [
  "Agente IA já treinado para vender Igreen",
  "Simulação automática de economia",
  "Coleta de documentos pelo WhatsApp",
  "Follow-up automático de 2 meses para reativar leads frios",
  "Transcrição de áudios e leitura da conta de luz",
  "Agendamento de reuniões e confirmação",
  "CRM Kanban com funil Igreen",
  "Dashboard de leads e conversões",
  "Aplicativo 100% mobile",
  "Atualizações e melhorias constantes",
  "Suporte por WhatsApp com a nossa equipe",
  "7 dias grátis para testar antes de pagar",
];

const igreenFaq = [
  { q: "Preciso já ser parceiro Igreen para usar?", a: "Sim. O sistema é otimizado para representantes e parceiros oficiais da Igreen Energy que já têm acesso ao portal de cadastro." },
  { q: "A IA conhece os planos e regras da Igreen?", a: "Sim. O agente vem com base de conhecimento focada em energia por assinatura, descontos, áreas atendidas, perfil CPF/CNPJ e principais objeções. Você ainda pode personalizar com seu próprio script." },
  { q: "Funciona com o WhatsApp que eu já uso para atender?", a: "Sim. Conectamos via QR Code ao seu número atual. Você continua atendendo do mesmo número, com a IA trabalhando em paralelo." },
  { q: "A IA fecha o contrato sozinha?", a: "Não. A IA qualifica o lead, simula a economia, quebra objeções e marca a reunião. O fechamento e cadastro no portal Igreen continuam com você — do jeito que a Igreen exige." },
  { q: "Por que R$ 97 e o preço vai subir?", a: "É um valor promocional de lançamento exclusivo para parceiros Igreen. Em breve sobe para R$ 157/mês. Quem entrar agora mantém R$ 97 enquanto a assinatura estiver ativa." },
  { q: "Se eu cancelar e voltar depois, mantenho os R$ 97?", a: "Não. O valor promocional só é travado enquanto a assinatura estiver ativa. Cancelou, volta no preço da tabela vigente." },
  { q: "Posso testar antes de pagar?", a: "Pode. São 7 dias grátis, sem cartão de crédito. Conecta seu WhatsApp, ativa a IA e vê funcionando com seus próprios leads." },
];

export default function IgreenLanding() {
  return (
    <div className="min-h-screen bg-[hsl(140,40%,6%)] text-[hsl(140,20%,96%)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[hsl(140,40%,6%)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-amber-400 text-white">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Theo IA <span className="text-emerald-400">· Igreen</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hover:text-emerald-300">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Link to="/igreen-trial">Testar 7 dias grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/15 via-amber-500/5 to-transparent" />
        <FloatingSparkles count={20} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-400 text-white shadow-[0_0_40px_rgba(16,185,129,0.4)]">
            <Leaf className="h-10 w-10" />
          </div>
          <Badge className="mb-6 border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20">
            <Sparkles className="mr-1 h-3 w-3" /> Versão exclusiva para parceiros Igreen Energy
          </Badge>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            A IA que vende{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-transparent">
              Energia Igreen
            </span>{" "}
            por você no WhatsApp
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg md:text-xl">
            Sistema personalizado para representantes Igreen Energy. A IA qualifica o lead,
            simula a economia, coleta documentos e marca a reunião — você só assina o contrato.
          </p>

          <div className="mx-auto mb-8 inline-flex flex-col items-center gap-1 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-6 py-4">
            <span className="text-xs uppercase tracking-wider text-amber-300">Promoção de lançamento</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-white/60 line-through">R$ 157</span>
              <span className="text-4xl font-extrabold text-amber-300">R$ 97</span>
              <span className="text-sm">/mês</span>
            </div>
            <span className="text-xs text-white/70">Em breve volta para R$ 157 — garanta agora</span>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="h-14 px-6 sm:px-8 text-base bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto">
              <Link to="/igreen-trial">
                Quero meus 7 dias grátis <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/80">
            <Shield className="mr-1 inline h-4 w-4" /> Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Dores Igreen */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-red-500/30 bg-red-500/10 text-red-300">
            <Clock className="mr-1 h-3 w-3" /> O que está te fazendo perder contratos Igreen
          </Badge>
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Cada lead Igreen sem resposta é dinheiro <span className="text-red-400">indo embora</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center">
            O cliente de energia por assinatura é desconfiado e impaciente. Se não tiver resposta rápida e clara, ele assina com o concorrente.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {igreenPains.map((s, i) => (
              <Card key={i} className="border-red-500/20 bg-[hsl(140,40%,9%)] text-white">
                <CardContent className="p-6 text-center">
                  <p className="mb-2 text-4xl font-extrabold text-red-400">{s.value}</p>
                  <p className="mb-3 text-sm leading-snug">{s.label}</p>
                  <p className="text-xs italic text-emerald-200/60">{s.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <p className="text-lg font-semibold">
              ⚡ Com Theo IA Igreen, todo lead é respondido em <span className="text-2xl text-emerald-300">menos de 5 segundos</span> — 24h por dia.
            </p>
          </div>
        </div>
      </section>

      {/* Por que feito para Igreen */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Badge className="mx-auto mb-4 flex w-fit items-center border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Leaf className="mr-1 h-3 w-3" /> Personalizado para o seu nicho
          </Badge>
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Não é um chatbot genérico. É um{" "}
            <span className="text-emerald-300">SDR treinado para vender Igreen</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center">
            Construído junto com representantes Igreen Energy. A IA já sabe falar a língua do cliente de energia por assinatura.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {igreenAdvantages.map((adv, i) => (
              <Card key={i} className="border-emerald-900/50 bg-[hsl(140,40%,9%)] text-white transition-all hover:border-emerald-500/50">
                <CardContent className="p-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-400/20">
                    <adv.icon className="h-7 w-7 text-emerald-300" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold">{adv.title}</h3>
                  <p className="text-sm leading-relaxed text-white/85">{adv.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades Igreen */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Tudo que um representante Igreen precisa em <span className="text-amber-300">um só lugar</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center">
            Cada funcionalidade foi pensada para o dia a dia de quem vende energia por assinatura.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {igreenFeatures.map((f, i) => (
              <Card key={i} className="border-emerald-900/50 bg-[hsl(140,40%,9%)] text-white transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                    <f.icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h3 className="mb-2 font-bold">{f.title}</h3>
                  <p className="text-sm text-white/80">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Preço */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Preço de lançamento — <span className="text-amber-300">enquanto durar</span>
          </h2>
          <p className="mb-10 text-center text-white/80">
            Estamos com vagas promocionais para os primeiros parceiros Igreen. Em breve o valor passa para R$ 157/mês.
          </p>
          <Card className="relative overflow-hidden border-2 border-emerald-500 bg-[hsl(140,40%,9%)] text-white">
            <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-400 px-4 py-1.5 text-sm font-bold text-emerald-950">
              7 DIAS GRÁTIS
            </div>
            <CardContent className="p-8 pt-12">
              <div className="mb-6 text-center">
                <p className="mb-1 text-sm">Plano Theo IA · Igreen Energy</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-base text-white/50 line-through">R$ 157</span>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm">R$</span>
                  <span className="text-6xl font-extrabold text-amber-300">97</span>
                  <span>/mês</span>
                </div>
                <p className="mt-2 text-xs text-amber-300/90">Em breve volta para R$ 157 — trave seu preço agora</p>
              </div>
              <ul className="mb-8 space-y-3">
                {igreenIncluded.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button size="lg" asChild className="w-full h-14 text-base bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-600 hover:to-amber-500 text-white">
                <Link to="/igreen-trial">
                  Começar agora — 7 dias grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <p className="mt-3 text-center text-xs text-white/70">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Perguntas frequentes dos parceiros Igreen
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {igreenFaq.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-lg border border-emerald-900/50 bg-[hsl(140,40%,9%)] px-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-white/85">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-amber-400/10 p-10 text-center md:p-16">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Trave o valor de R$ 97 antes do reajuste
          </h2>
          <p className="mx-auto mb-8 max-w-xl">
            Enquanto você decide, outro parceiro Igreen está fechando o lead que era seu.
            Ative agora seus 7 dias grátis e veja a IA trabalhando com seus próprios leads.
          </p>
          <Button size="lg" asChild className="h-14 px-6 sm:px-10 text-base bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto">
            <Link to="/igreen-trial">
              Quero meus 7 dias grátis <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="mt-3 text-xs text-white/70">
            Depois do teste, R$ 97/mês — em breve R$ 157.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-emerald-900/50 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-3 text-center text-sm">
          <p>© {new Date().getFullYear()} Theo IA · Versão Igreen Energy. Todos os direitos reservados.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/60">
            <a href="/terms" className="hover:text-white transition-colors">Termos de Uso</a>
            <span className="text-white/30">•</span>
            <a href="/privacy" className="hover:text-white transition-colors">Política de Privacidade</a>
          </nav>
        </div>
      </footer>

      {/* Balão flutuante WhatsApp */}
      <a
        href="https://wa.me/5547991293662?text=Ol%C3%A1!%20Sou%20parceiro%20Igreen%20e%20quero%20saber%20mais%20sobre%20o%20Theo%20IA"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-[#25D366] pl-5 pr-6 py-3 text-white shadow-xl transition-transform hover:scale-105"
      >
        <MessageSquare className="h-6 w-6 shrink-0" />
        <span className="text-sm font-semibold leading-tight">
          Dúvidas?<br />
          <span className="font-normal">Fale com nossa equipe</span>
        </span>
      </a>
    </div>
  );
}