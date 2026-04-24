import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Zap,
  Clock,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  BarChart3,
  Rocket,
  Award,
  Eye,
  Sparkles,
  Bot,
  Mic,
  Image as ImageIcon,
  Calendar,
  KanbanSquare,
  CheckCircle2,
  ArrowUpRight,
  Briefcase,
  Stethoscope,
  Scale,
  UtensilsCrossed,
  Dumbbell,
  Sun,
  Wrench,
  User,
} from "lucide-react";

type Slide = {
  id: string;
  render: () => JSX.Element;
};

const Investors = () => {
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    { id: "cover", render: () => <CoverSlide /> },
    { id: "problem", render: () => <ProblemSlide /> },
    { id: "solution", render: () => <SolutionSlide /> },
    { id: "crm", render: () => <CRMSlide /> },
    { id: "market", render: () => <MarketSlide /> },
    { id: "audience", render: () => <AudienceSlide /> },
    { id: "model", render: () => <ModelSlide /> },
    { id: "traction", render: () => <TractionSlide /> },
    { id: "growth", render: () => <GrowthSlide /> },
    { id: "strategy", render: () => <StrategySlide /> },
    { id: "edge", render: () => <EdgeSlide /> },
    { id: "vision", render: () => <VisionSlide /> },
    { id: "closing", render: () => <ClosingSlide /> },
  ];

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") next();
      if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="min-h-screen w-full bg-[hsl(222,47%,4%)] text-white overflow-hidden relative">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[hsl(217,91%,60%)]/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-[hsl(142,76%,36%)]/15 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(280,80%,60%)]/10 blur-[120px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Theo IA</span>
          <span className="text-xs text-white/40 ml-3 hidden sm:inline">Investor Deck · 2026</span>
        </div>
        <div className="text-xs text-white/50 font-mono">
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
      </header>

      {/* Slide canvas */}
      <main className="relative z-10 px-6 md:px-16 lg:px-24 pb-32 pt-4 min-h-[calc(100vh-80px)] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[index].id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-7xl mx-auto"
          >
            {slides[index].render()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer controls */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 px-6 md:px-12 py-5 bg-gradient-to-t from-[hsl(222,47%,4%)] to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={prev}
            disabled={index === 0}
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-white" : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={index === slides.length - 1}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[hsl(217,91%,60%)]/20 transition hover:shadow-[hsl(217,91%,60%)]/40 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

/* ---------- Reusable bits ---------- */

const Eyebrow = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70 backdrop-blur">
    <Icon className="h-3.5 w-3.5" />
    {label}
  </div>
);

const BigStat = ({
  value,
  label,
  accent = "blue",
}: {
  value: string;
  label: string;
  accent?: "blue" | "green" | "purple";
}) => {
  const grad =
    accent === "green"
      ? "from-[hsl(142,76%,56%)] to-[hsl(160,84%,46%)]"
      : accent === "purple"
        ? "from-[hsl(280,80%,65%)] to-[hsl(217,91%,60%)]"
        : "from-[hsl(217,91%,65%)] to-[hsl(190,90%,55%)]";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className={`bg-gradient-to-br ${grad} bg-clip-text text-4xl md:text-5xl font-bold text-transparent`}>
        {value}
      </div>
      <div className="mt-2 text-sm text-white/60">{label}</div>
    </div>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) => (
  <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%)]/20 to-[hsl(142,76%,46%)]/20 text-[hsl(217,91%,70%)]">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="text-base font-semibold text-white">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-white/60">{desc}</p>
  </div>
);

const Quote = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(217,91%,60%)]/10 via-white/[0.02] to-[hsl(142,76%,46%)]/10 p-5 backdrop-blur">
    <p className="text-base md:text-lg font-medium text-white/90 italic">"{children}"</p>
  </div>
);

const Title = ({ eyebrow, eyebrowIcon, title, subtitle }: { eyebrow: string; eyebrowIcon: any; title: React.ReactNode; subtitle?: string }) => (
  <div className="mb-10">
    <Eyebrow icon={eyebrowIcon} label={eyebrow} />
    <h2 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">{title}</h2>
    {subtitle && <p className="mt-4 text-lg text-white/60 max-w-3xl">{subtitle}</p>}
  </div>
);

/* ---------- Slides ---------- */

const CoverSlide = () => (
  <div className="relative">
    <div className="flex flex-col items-start gap-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(142,76%,56%)] animate-pulse" />
        Atendimento inteligente · WhatsApp · CRM nativo
      </div>

      <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.95]">
        Theo
        <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] via-[hsl(190,90%,60%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">
          {" "}IA
        </span>
      </h1>

      <p className="text-2xl md:text-3xl text-white/80 font-light max-w-3xl">
        Seu atendente inteligente no <span className="font-semibold text-white">WhatsApp</span>.
      </p>

      <div className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(217,91%,60%)]/10 to-[hsl(142,76%,46%)]/10 p-6 backdrop-blur">
        <p className="text-xl md:text-2xl font-medium leading-snug">
          Enquanto você dorme, o <span className="text-[hsl(142,76%,66%)]">Theo continua vendendo</span> e atendendo.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-6 text-xs text-white/40 uppercase tracking-widest">
        <span>Pitch para Investidores</span>
        <span className="h-px w-12 bg-white/20" />
        <span>2026</span>
      </div>
    </div>
  </div>
);

const ProblemSlide = () => (
  <div>
    <Title
      eyebrow="O Problema"
      eyebrowIcon={Clock}
      title={<>Atendimento lento <br /><span className="text-white/40">= vendas perdidas.</span></>}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FeatureCard icon={Clock} title="Demora mata venda" desc="Cada minuto de espera reduz drasticamente a chance de conversão." />
      <FeatureCard icon={MessageCircle} title="Sem resposta imediata" desc="Leads vão para o concorrente que responder primeiro." />
      <FeatureCard icon={Zap} title="Não atende 24/7" desc="Negócios perdem oportunidades fora do horário comercial." />
      <FeatureCard icon={Target} title="Sem padrão, sem follow-up" desc="Atendimento inconsistente e leads esquecidos no funil." />
    </div>

    <Quote>Milhões de empresas perdem dinheiro todos os dias por não responderem seus clientes a tempo.</Quote>
  </div>
);

const SolutionSlide = () => (
  <div>
    <Title
      eyebrow="A Solução"
      eyebrowIcon={Sparkles}
      title={<>Um <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">funcionário digital</span> que nunca dorme.</>}
    />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FeatureCard icon={Clock} title="Atendimento 24/7" desc="Resposta imediata, em qualquer horário, todos os dias." />
      <FeatureCard icon={Target} title="Qualifica e agenda" desc="Conduz o lead até a conversão sem intervenção humana." />
      <FeatureCard icon={Mic} title="Áudios e imagens" desc="Entende mensagens multimodais como uma pessoa real." />
      <FeatureCard icon={MessageCircle} title="Follow-up automático" desc="Reativa leads frios e mantém a cadência de vendas." />
      <FeatureCard icon={Bot} title="IA treinada por negócio" desc="Aprende o tom, produtos e processo de cada cliente." />
      <FeatureCard icon={Calendar} title="Integra agenda" desc="Marca, confirma e lembra compromissos sozinho." />
    </div>

    <Quote>Um único sistema substitui atendimento, pré-venda e organização comercial.</Quote>
  </div>
);

const CRMSlide = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
    <div>
      <Title
        eyebrow="Diferencial Estratégico"
        eyebrowIcon={KanbanSquare}
        title={<>CRM nativo. <br /><span className="text-white/40">Não é integração — é coração.</span></>}
      />
      <ul className="space-y-3">
        {[
          "Gestão de leads em tempo real",
          "Funil de vendas Kanban organizado",
          "Acompanhamento de cada cliente",
          "Histórico completo de conversas",
          "Métricas e visão comercial unificada",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-base text-white/85">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(142,76%,56%)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <Quote>O Theo não apenas atende — ele organiza e gerencia todo o processo comercial.</Quote>
    </div>

    {/* Mock kanban */}
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <KanbanSquare className="h-4 w-4" /> Pipeline · Vendas
        </div>
        <div className="text-xs text-[hsl(142,76%,66%)]">+24% esta semana</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { title: "Novos", color: "hsl(217,91%,60%)", count: 12 },
          { title: "Qualificados", color: "hsl(280,80%,65%)", count: 7 },
          { title: "Fechados", color: "hsl(142,76%,46%)", count: 4 },
        ].map((col) => (
          <div key={col.title} className="rounded-xl bg-white/[0.04] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white/80">{col.title}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `${col.color}33`, color: col.color }}
              >
                {col.count}
              </span>
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="h-2 w-3/4 rounded bg-white/20" />
                  <div className="mt-1.5 h-1.5 w-1/2 rounded bg-white/10" />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="h-4 w-4 rounded-full" style={{ background: col.color }} />
                    <div className="text-[9px] text-white/40">R$ {(i + 1) * 320}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MarketSlide = () => (
  <div>
    <Title
      eyebrow="Oportunidade de Mercado"
      eyebrowIcon={TrendingUp}
      title={<>Um oceano de <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">20 milhões</span> de negócios.</>}
    />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <BigStat value="20M+" label="Pequenos negócios no Brasil" accent="blue" />
      <BigStat value="98%" label="Penetração do WhatsApp" accent="green" />
      <BigStat value="4x" label="Crescimento de IA em vendas" accent="purple" />
    </div>

    <Quote>Estamos posicionados em um dos maiores mercados do mundo para soluções digitais.</Quote>
  </div>
);

const AudienceSlide = () => {
  const niches = [
    { icon: User, label: "Autônomos" },
    { icon: Briefcase, label: "Pequenos negócios" },
    { icon: Stethoscope, label: "Clínicas" },
    { icon: Scale, label: "Advogados" },
    { icon: UtensilsCrossed, label: "Restaurantes" },
    { icon: Dumbbell, label: "Academias" },
    { icon: Sun, label: "Energia solar" },
    { icon: Wrench, label: "Prestadores de serviço" },
  ];
  return (
    <div>
      <Title
        eyebrow="Público-Alvo"
        eyebrowIcon={Users}
        title={<>Horizontal por design. <br /><span className="text-white/40">Vertical por entrega.</span></>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {niches.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%)]/20 to-[hsl(142,76%,46%)]/20">
              <Icon className="h-5 w-5 text-[hsl(217,91%,75%)]" />
            </div>
            <div className="text-sm font-medium text-white/90">{label}</div>
          </div>
        ))}
      </div>
      <Quote>Uma solução horizontal que atende múltiplos nichos com a mesma eficiência.</Quote>
    </div>
  );
};

const ModelSlide = () => (
  <div>
    <Title
      eyebrow="Modelo de Negócio"
      eyebrowIcon={DollarSign}
      title={<>SaaS recorrente. <br /><span className="text-white/40">Acessível e escalável.</span></>}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      <div className="lg:col-span-1 rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(217,91%,60%)]/15 to-[hsl(142,76%,46%)]/10 p-8 backdrop-blur">
        <div className="text-sm text-white/60 uppercase tracking-widest">Plano Mensal</div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-2xl font-medium text-white/70">R$</span>
          <span className="text-7xl font-bold tracking-tighter">97</span>
          <span className="text-base text-white/50">/mês</span>
        </div>
        <div className="mt-2 text-sm text-white/60">Por usuário · Receita recorrente</div>
        <div className="mt-6 h-px bg-white/10" />
        <ul className="mt-6 space-y-2.5 text-sm text-white/80">
          {["Atendimento IA 24/7", "CRM nativo incluso", "Multimodal (áudio + imagem)", "Follow-up automático"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(142,76%,56%)]" /> {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeatureCard icon={DollarSign} title="Baixa barreira de entrada" desc="Preço acessível para qualquer pequeno negócio começar agora." />
        <FeatureCard icon={TrendingUp} title="Receita recorrente" desc="MRR previsível e crescente com base em assinaturas." />
        <FeatureCard icon={Award} title="Alta retenção" desc="Produto operacional crítico — sai cara a substituição." />
        <FeatureCard icon={Rocket} title="Margem SaaS" desc="Custo marginal por usuário próximo de zero." />
      </div>
    </div>
    <Quote>Baixa barreira de entrada + alto potencial de escala.</Quote>
  </div>
);

const TractionSlide = () => (
  <div>
    <Title
      eyebrow="Tração e Dados"
      eyebrowIcon={BarChart3}
      title={<>Produto validado. <br /><span className="text-white/40">Pronto para escalar.</span></>}
    />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <BigStat value="R$ 97" label="Ticket mensal recorrente" accent="blue" />
      <BigStat value="100%" label="SaaS · Receita recorrente" accent="green" />
      <BigStat value="Alto" label="Potencial de retenção" accent="purple" />
    </div>

    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <FeatureCard icon={CheckCircle2} title="Produto validado" desc="Testado em ambiente real com usuários pagantes." />
      <FeatureCard icon={Target} title="Funil mensurável" desc="Conversão e retenção acompanhadas ponta a ponta." />
    </div>
    <Quote>Produto validado, com forte potencial de conversão e retenção.</Quote>
  </div>
);

const GrowthSlide = () => {
  const months = [
    { m: "Jan", v: 12 },
    { m: "Fev", v: 18 },
    { m: "Mar", v: 28 },
    { m: "Abr", v: 42 },
    { m: "Mai", v: 60 },
    { m: "Jun", v: 85 },
    { m: "Jul", v: 120 },
    { m: "Ago", v: 180 },
    { m: "Set", v: 280 },
    { m: "Out", v: 480 },
    { m: "Nov", v: 720 },
    { m: "Dez", v: 1000 },
  ];
  const max = 1000;
  return (
    <div>
      <Title
        eyebrow="Projeção de Crescimento"
        eyebrowIcon={Rocket}
        title={<>1.000 usuários até <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">Dezembro 2026</span>.</>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Usuários ativos</div>
              <div className="mt-1 text-3xl font-bold">Curva 2026</div>
            </div>
            <div className="text-xs text-[hsl(142,76%,66%)] flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Exponencial
            </div>
          </div>
          <div className="flex h-56 items-end gap-2">
            {months.map((mo, i) => {
              const h = (mo.v / max) * 100;
              return (
                <div key={mo.m} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[hsl(217,91%,60%)] to-[hsl(142,76%,56%)] transition-all"
                      style={{ height: `${h}%`, opacity: 0.4 + (i / months.length) * 0.6 }}
                    />
                  </div>
                  <div className="text-[10px] text-white/40">{mo.m}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(217,91%,60%)]/15 to-transparent p-6 backdrop-blur">
            <div className="text-xs uppercase tracking-widest text-white/50">Receita mensal projetada</div>
            <div className="mt-2 text-5xl md:text-6xl font-bold tracking-tight">R$ 97.000</div>
            <div className="mt-2 text-sm text-white/60">1.000 clientes × R$ 97 / mês</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(142,76%,46%)]/15 to-transparent p-6 backdrop-blur">
            <div className="text-xs uppercase tracking-widest text-white/50">Receita anual projetada</div>
            <div className="mt-2 text-5xl md:text-6xl font-bold tracking-tight">R$ 1,16M+</div>
            <div className="mt-2 text-sm text-white/60">ARR previsível e escalável</div>
          </div>
        </div>
      </div>
      <Quote>Crescimento previsível com base em aquisição escalável.</Quote>
    </div>
  );
};

const StrategySlide = () => (
  <div>
    <Title
      eyebrow="Estratégia de Crescimento"
      eyebrowIcon={Target}
      title={<>Máquina de aquisição <br /><span className="text-white/40">pronta para escalar.</span></>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <FeatureCard icon={Target} title="Tráfego pago validado" desc="Canais testados com CAC controlado." />
      <FeatureCard icon={BarChart3} title="Aquisição previsível" desc="Funil mensurável e replicável." />
      <FeatureCard icon={Users} title="Escala por nichos" desc="Verticalização sem refazer o produto." />
      <FeatureCard icon={Sparkles} title="Crescimento orgânico" desc="Indicação e prova social potencializam o paid." />
      <FeatureCard icon={Rocket} title="Evolução do produto" desc="Releases contínuos elevando retenção." />
      <FeatureCard icon={TrendingUp} title="Loop de retenção" desc="Mais uso = mais inteligência = mais valor." />
    </div>
  </div>
);

const EdgeSlide = () => (
  <div>
    <Title
      eyebrow="Diferenciais Competitivos"
      eyebrowIcon={Award}
      title={<>Não é chatbot. <br /><span className="text-white/40">É um novo padrão.</span></>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FeatureCard icon={Bot} title="IA personalizada por negócio" desc="Cada Theo aprende o tom e processo do seu cliente." />
      <FeatureCard icon={KanbanSquare} title="CRM nativo" desc="Integração não é diferencial — nascer junto, é." />
      <FeatureCard icon={MessageCircle} title="Canal dominante" desc="WhatsApp é onde o brasileiro decide a compra." />
      <FeatureCard icon={Zap} title="Setup em minutos" desc="Onboarding simples, valor entregue no primeiro dia." />
      <FeatureCard icon={ImageIcon} title="Multimodal real" desc="Lê áudios, imagens e contexto como um humano." />
      <FeatureCard icon={Award} title="Inteligência verdadeira" desc="Conversa fluida, qualifica e converte — não responde script." />
    </div>
    <Quote>Não é apenas automação — é um novo padrão de atendimento.</Quote>
  </div>
);

const VisionSlide = () => (
  <div>
    <Title
      eyebrow="Visão de Futuro"
      eyebrowIcon={Eye}
      title={<>O <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">sistema operacional</span> de vendas dos negócios brasileiros.</>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FeatureCard icon={Award} title="Líder em atendimento IA" desc="O Theo como referência de mercado no Brasil." />
      <FeatureCard icon={Users} title="Milhares de empresas" desc="Escala massiva via aquisição multi-nicho." />
      <FeatureCard icon={Sparkles} title="Evolução contínua" desc="Cada release amplia capacidades e retenção." />
      <FeatureCard icon={Rocket} title="Plataforma expansível" desc="Novos módulos, integrações e automações." />
    </div>
    <Quote>Estamos construindo uma nova forma de empresas venderem e atenderem.</Quote>
  </div>
);

const ClosingSlide = () => (
  <div className="text-center flex flex-col items-center">
    <Eyebrow icon={Sparkles} label="Encerramento" />
    <h2 className="mt-6 text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1] max-w-5xl">
      Qualquer negócio,{" "}
      <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] via-[hsl(190,90%,60%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">
        24 horas vendendo.
      </span>
    </h2>
    <p className="mt-8 max-w-2xl text-xl text-white/70">
      O Theo IA transforma qualquer negócio em uma operação de vendas que nunca para.
    </p>
    <div className="mt-12 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] px-8 py-4 text-lg font-semibold shadow-2xl shadow-[hsl(217,91%,60%)]/30">
      <Rocket className="h-5 w-5" />
      O momento de entrar é agora.
    </div>
    <div className="mt-12 text-xs text-white/40 uppercase tracking-[0.3em]">Theo IA · 2026</div>
  </div>
);

export default Investors;