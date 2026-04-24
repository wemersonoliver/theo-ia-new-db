import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import {
  Bot,
  Rocket,
  Clock,
  MessageCircle,
  Zap,
  Target,
  Mic,
  Calendar,
  KanbanSquare,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Users,
  Award,
  Briefcase,
  Stethoscope,
  Scale,
  UtensilsCrossed,
  Dumbbell,
  Sun,
  Wrench,
  ShoppingBag,
  ArrowRight,
  Eye,
  BarChart3,
  X,
} from "lucide-react";

const NAV_SECTIONS = [
  { id: "mercado", label: "Mercado" },
  { id: "gap", label: "Gap" },
  { id: "matematica", label: "Matemática" },
  { id: "solucao", label: "Solução" },
  { id: "crm", label: "CRM" },
  { id: "projecao", label: "Projeção" },
  { id: "visao", label: "Visão" },
];

const Investors = () => {
  return (
    <div className="min-h-screen w-full bg-[hsl(222,47%,4%)] text-white relative overflow-x-hidden">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[hsl(217,91%,60%)]/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-[hsl(142,76%,36%)]/12 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[hsl(280,80%,60%)]/10 blur-[120px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[hsl(222,47%,4%)]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-10 py-4">
          <a href="#top" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Theo IA</span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm text-white/65">
            {NAV_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="transition hover:text-white">
                {s.label}
              </a>
            ))}
          </nav>

          <a
            href="#contato"
            className="rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[hsl(217,91%,60%)]/20 transition hover:shadow-[hsl(217,91%,60%)]/40"
          >
            Quero investir
          </a>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <Section className="pt-16 md:pt-24"><Hero /></Section>
        <Section><Problem /></Section>
        <Section id="mercado"><Market /></Section>
        <Section id="gap"><Gap /></Section>
        <Section id="matematica"><MathSection /></Section>
        <Section id="solucao"><Solution /></Section>
        <Section id="crm"><CRM /></Section>
        <Section><Audience /></Section>
        <Section><Model /></Section>
        <Section id="projecao"><Projection /></Section>
        <Section><Strategy /></Section>
        <Section><Edge /></Section>
        <Section id="visao"><Vision /></Section>
        <Section id="contato"><Closing /></Section>

        <footer className="relative border-t border-white/5 px-6 md:px-10 py-10">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <div>© 2026 Theo IA · Todos os direitos reservados</div>
            <div className="uppercase tracking-[0.3em]">Pitch para Investidores</div>
          </div>
          <p className="mx-auto max-w-7xl mt-4 text-[10px] text-white/30 leading-relaxed">
            Projeções internas elaboradas a partir de fontes públicas (Sebrae, IBGE, Meta, Opinion Box, Mobile Time).
            Os números apresentados refletem cenários estimados de mercado e plano de negócio, e não constituem garantia
            de resultado financeiro.
          </p>
        </footer>
      </main>
    </div>
  );
};

/* ============================== Layout ============================== */

const Section = ({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section id={id} className={`px-6 md:px-10 lg:px-16 py-20 md:py-28 scroll-mt-20 ${className}`}>
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-7xl"
    >
      {children}
    </motion.div>
  </section>
);

const Title = ({
  eyebrow,
  eyebrowIcon: Icon,
  title,
  align = "left",
}: {
  eyebrow: string;
  eyebrowIcon: React.ElementType;
  title: ReactNode;
  align?: "left" | "center";
}) => (
  <div className={`mb-10 ${align === "center" ? "text-center" : ""}`}>
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white/70 backdrop-blur ${
        align === "center" ? "mx-auto" : ""
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {eyebrow}
    </div>
    <h2 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">{title}</h2>
  </div>
);

const Quote = ({ children }: { children: ReactNode }) => (
  <blockquote className="mt-10 border-l-2 border-[hsl(142,76%,56%)] pl-5 text-lg md:text-xl font-light italic text-white/85 max-w-3xl">
    {children}
  </blockquote>
);

/* ============================== Reusable atoms ============================== */

const StatCounter = ({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1600,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) => (
  <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]">
    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%)]/20 to-[hsl(142,76%,46%)]/20 ring-1 ring-white/10">
      <Icon className="h-5 w-5 text-[hsl(217,91%,75%)]" />
    </div>
    <h3 className="mb-1.5 text-lg font-semibold tracking-tight">{title}</h3>
    <p className="text-sm text-white/65 leading-relaxed">{desc}</p>
  </div>
);

const StatCard = ({
  value,
  label,
  source,
}: {
  value: ReactNode;
  label: string;
  source?: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
    <div className="text-4xl md:text-5xl font-bold tracking-tight text-white">
      {value}
    </div>
    <div className="mt-2 text-sm text-white/80 leading-snug">{label}</div>
    {source && <div className="mt-2 text-[10px] uppercase tracking-wider text-white/35">{source}</div>}
  </div>
);

/* ============================== Hero ============================== */

const Hero = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
    <div className="lg:col-span-7 space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(142,76%,56%)] animate-pulse" />
        Tese de investimento · Theo IA · 2026
      </div>

      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[0.98]">
        O atendimento de <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] via-[hsl(190,90%,60%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">milhões</span> de empresas brasileiras
        <span className="block text-white/55">ainda é feito por humanos cansados.</span>
      </h1>

      <p className="text-xl md:text-2xl text-white/75 font-light max-w-2xl leading-snug">
        O <span className="text-white font-medium">Theo IA</span> é o atendente digital que vende, qualifica e
        agenda 24/7 no WhatsApp. Enquanto você dorme, ele continua trabalhando.
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <a
          href="#contato"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[hsl(217,91%,60%)]/30 transition hover:shadow-[hsl(217,91%,60%)]/50"
        >
          <Rocket className="h-4 w-4" /> Quero investir
        </a>
        <a
          href="#mercado"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-medium text-white/85 backdrop-blur transition hover:bg-white/10"
        >
          Ver a oportunidade <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>

    <div className="lg:col-span-5 grid grid-cols-1 gap-3">
      <StatCard
        value={<><StatCounter value={21.4} decimals={1} suffix=" mi" /></>}
        label="PMEs ativas no Brasil — o universo de empresas que precisam atender clientes todos os dias."
        source="Sebrae · Mapa de Empresas"
      />
      <StatCard
        value={<><StatCounter value={78} suffix="%" /></>}
        label="Não usam nenhuma forma de IA no atendimento — e a maioria já sabe que precisa."
        source="Opinion Box · 2024"
      />
      <StatCard
        value={<>R$ <StatCounter value={1.16} decimals={2} suffix=" mi" /></>}
        label="ARR projetado para Dez/2026 com apenas 1.000 clientes ativos."
        source="Plano de negócio Theo IA"
      />
    </div>
  </div>
);

/* ============================== Problem ============================== */

const Problem = () => (
  <div>
    <Title
      eyebrow="O Problema"
      eyebrowIcon={Clock}
      title={<>Cada hora sem resposta <br /><span className="text-white/40">é um cliente perdido.</span></>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard value={<><StatCounter value={79} suffix="%" /></>} label="dos consumidores desistem da compra após 1 hora sem resposta." source="Harvard Business Review" />
      <StatCard value={<><StatCounter value={64} suffix="%" /></>} label="dos brasileiros preferem WhatsApp como canal principal de atendimento." source="Opinion Box · 2024" />
      <StatCard value={<><StatCounter value={9} suffix="h+" /></>} label="é o tempo médio de primeira resposta de uma PME no WhatsApp." source="Take Blip · Mapa CX" />
      <StatCard value={<><StatCounter value={90} suffix="%" /></>} label="das pequenas empresas não conseguem oferecer atendimento 24h por 7 dias." source="Sebrae · Estudos PME" />
    </div>
    <Quote>
      Não existe falta de demanda. Existe falta de capacidade de responder.
    </Quote>
  </div>
);

/* ============================== Market: TAM/SAM/SOM ============================== */

const MarketFunnel = () => (
  <div className="relative aspect-square w-full max-w-[440px] mx-auto">
    {/* TAM — anel externo, label na borda superior */}
    <div className="absolute inset-0 rounded-full border border-[hsl(217,91%,60%)]/30 bg-gradient-to-br from-[hsl(217,91%,60%)]/12 to-transparent" />
    <div className="absolute left-1/2 -translate-x-1/2 top-3 text-center z-10">
      <div className="text-[10px] uppercase tracking-[0.3em] text-[hsl(217,91%,75%)]">TAM</div>
      <div className="text-xl font-bold text-white leading-tight">21,4 mi</div>
      <div className="text-[10px] text-white/55">PMEs no Brasil</div>
    </div>

    {/* SAM — anel intermediário, label na borda inferior do anel */}
    <div className="absolute inset-[20%] rounded-full border border-[hsl(190,90%,60%)]/40 bg-gradient-to-br from-[hsl(190,90%,60%)]/16 to-transparent" />
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[24%] text-center z-10">
      <div className="text-[10px] uppercase tracking-[0.3em] text-[hsl(190,90%,75%)]">SAM</div>
      <div className="text-lg font-bold text-white leading-tight">6 mi</div>
      <div className="text-[10px] text-white/55">vendem por WhatsApp</div>
    </div>

    {/* SOM — núcleo central */}
    <div className="absolute inset-[40%] rounded-full border border-[hsl(142,76%,56%)]/60 bg-gradient-to-br from-[hsl(142,76%,46%)]/35 to-[hsl(142,76%,46%)]/10 shadow-[0_0_60px_-10px_hsl(142,76%,46%)] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[9px] uppercase tracking-[0.25em] text-[hsl(142,76%,76%)]">SOM</div>
        <div className="text-base font-bold text-white leading-tight">600 mil</div>
      </div>
    </div>
  </div>
);

const Market = () => (
  <div>
    <Title
      eyebrow="Tamanho do Mercado"
      eyebrowIcon={TrendingUp}
      title={<>Um mercado de <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">21 milhões</span> de empresas. <br /><span className="text-white/40">Só precisamos de uma fração.</span></>}
    />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <MarketFunnel />

      <div className="space-y-4">
        <FunnelRow color="blue" label="TAM · Mercado total" value="21,4 milhões de PMEs" desc="Universo total de pequenas e médias empresas formais ativas no Brasil." />
        <FunnelRow color="cyan" label="SAM · Mercado endereçável" value="6 milhões de PMEs" desc="Empresas que utilizam o WhatsApp como canal central de relacionamento e vendas." />
        <FunnelRow color="green" label="SOM · Mercado capturável" value="600 mil PMEs" desc="Empresas com maturidade digital e disposição declarada para adotar IA nos próximos 24 meses." />
      </div>
    </div>

    <Quote>
      O Brasil é o 2º maior mercado de WhatsApp do mundo — e a esmagadora maioria das PMEs ainda atende manualmente.
    </Quote>
  </div>
);

const FunnelRow = ({
  color,
  label,
  value,
  desc,
}: {
  color: "blue" | "cyan" | "green";
  label: string;
  value: string;
  desc: string;
}) => {
  const dot =
    color === "blue"
      ? "bg-[hsl(217,91%,60%)]"
      : color === "cyan"
        ? "bg-[hsl(190,90%,60%)]"
        : "bg-[hsl(142,76%,56%)]";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/55">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      <p className="mt-1 text-sm text-white/60 leading-relaxed">{desc}</p>
    </div>
  );
};

/* ============================== Gap ============================== */

const GapBar = ({
  label,
  pct,
  color,
  delay = 0,
}: {
  label: string;
  pct: number;
  color: string;
  delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm md:text-base text-white/85">{label}</span>
        <span className="text-2xl font-bold tracking-tight">{pct}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: inView ? `${pct}%` : 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
};

const Gap = () => (
  <div>
    <Title
      eyebrow="O Gap da IA"
      eyebrowIcon={Sparkles}
      title={<>64% do mercado <br /><span className="text-white/40">precisa, quer — e ainda não tem.</span></>}
    />

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
      <div className="lg:col-span-3 space-y-7 rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur">
        <GapBar label="PMEs que precisam de automação no atendimento" pct={86} color="linear-gradient(90deg, hsl(217,91%,60%), hsl(190,90%,60%))" />
        <GapBar label="PMEs que já usam alguma forma de IA hoje" pct={22} color="linear-gradient(90deg, hsl(0,0%,40%), hsl(0,0%,55%))" delay={0.15} />
        <div className="pt-4 border-t border-white/10">
          <GapBar label="Gap = mercado descoberto pronto para conversão" pct={64} color="linear-gradient(90deg, hsl(142,76%,46%), hsl(142,76%,66%))" delay={0.3} />
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <p className="text-xl md:text-2xl font-light leading-snug text-white/85">
          A maioria já entendeu que <span className="text-white font-medium">não dá mais para atender no braço</span>.
        </p>
        <p className="text-base text-white/65 leading-relaxed">
          Pesquisas recentes mostram que <span className="text-white">86% das PMEs reconhecem a necessidade</span> de
          automatizar parte do atendimento — mas apenas 22% já adotaram qualquer ferramenta de IA. Sobra um campo aberto
          de mais de <span className="text-[hsl(142,76%,66%)] font-semibold">5 milhões de empresas</span> ativamente
          procurando uma solução acessível, em português e simples de usar.
        </p>
        <p className="text-sm text-white/45">Fontes: Opinion Box 2024 · Microsoft Work Trend Index · Sebrae.</p>
      </div>
    </div>
  </div>
);

/* ============================== Math ============================== */

const MathRow = ({
  label,
  value,
  highlight = false,
  delay = 0,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-baseline justify-between gap-4 py-3 border-b border-dashed ${
        highlight ? "border-[hsl(142,76%,46%)]/40" : "border-white/10"
      }`}
    >
      <span className={`text-sm md:text-base ${highlight ? "text-white font-medium" : "text-white/65"}`}>{label}</span>
      <span
        className={`font-mono text-base md:text-xl tabular-nums ${
          highlight
            ? "text-[hsl(142,76%,66%)] font-bold"
            : "text-white/90"
        }`}
      >
        {value}
      </span>
    </motion.div>
  );
};

const MathSection = () => (
  <div>
    <Title
      eyebrow="A Matemática da Meta"
      eyebrowIcon={BarChart3}
      title={<>Não é uma aposta. <br /><span className="text-white/40">É aritmética.</span></>}
    />

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
      <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 md:p-9 backdrop-blur">
        <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Como chegamos a R$ 1,16 mi de ARR</div>
        <div className="space-y-1">
          <MathRow label="Mercado capturável (SOM)" value="600.000 empresas" delay={0.0} />
          <MathRow label="Penetração necessária" value="0,167%" delay={0.1} />
          <MathRow label="Meta Dez/2026" value="1.000 clientes ativos" highlight delay={0.2} />
          <MathRow label="Ticket mensal" value="× R$ 97" delay={0.3} />
          <MathRow label="MRR projetado" value="R$ 97.000 / mês" delay={0.4} />
          <MathRow label="ARR projetado" value="R$ 1.164.000 / ano" highlight delay={0.5} />
        </div>

        <div className="mt-7 rounded-xl border border-[hsl(142,76%,46%)]/30 bg-[hsl(142,76%,46%)]/10 p-5">
          <p className="text-base md:text-lg leading-snug">
            Precisamos converter <span className="font-bold text-[hsl(142,76%,76%)]">menos de 2</span> em cada{" "}
            <span className="font-bold">1.000 empresas</span> do nosso mercado capturável.
          </p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-white/45 mb-2">Para escalar a tese</div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
              <span className="text-white/75">5.000 clientes (2027)</span>
              <span className="font-mono text-white">0,83% do SOM</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
              <span className="text-white/75">15.000 clientes (2028)</span>
              <span className="font-mono text-white">2,5% do SOM</span>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-white/75">50.000 clientes (visão)</span>
              <span className="font-mono text-[hsl(142,76%,66%)]">8,3% do SOM</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-white/55 leading-relaxed">
          Mesmo no cenário mais ambicioso, ainda estaríamos abaixo de <span className="text-white">10% do SOM</span> e
          de <span className="text-white">1% do SAM</span>. O teto é alto. O caminho é matemático.
        </p>
      </div>
    </div>
  </div>
);

/* ============================== Solution ============================== */

const Solution = () => (
  <div>
    <Title
      eyebrow="A Solução"
      eyebrowIcon={Sparkles}
      title={<>Um <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">funcionário digital</span> que nunca dorme.</>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <FeatureCard icon={Clock} title="Atendimento 24/7" desc="Resposta imediata, em qualquer horário, todos os dias." />
      <FeatureCard icon={Mic} title="Áudio e imagem" desc="Entende mensagens multimodais como uma pessoa real." />
      <FeatureCard icon={Target} title="Qualifica e agenda" desc="Conduz o lead até a conversão sem intervenção humana." />
      <FeatureCard icon={MessageCircle} title="Follow-up automático" desc="Reativa leads frios e mantém a cadência de vendas." />
      <FeatureCard icon={Bot} title="Treinado por negócio" desc="Aprende o tom, produtos e processo de cada cliente." />
      <FeatureCard icon={Zap} title="Substitui pré-venda + SDR" desc="Um único sistema no lugar de várias funções operacionais." />
    </div>
    <Quote>De 9 horas para 9 segundos. O Theo responde antes do concorrente abrir o WhatsApp.</Quote>
  </div>
);

/* ============================== CRM ============================== */

const KanbanColumn = ({ title, count, items, color }: { title: string; count: number; items: string[]; color: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur min-w-0">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/75">{title}</span>
      </div>
      <span className="text-[10px] rounded-full bg-white/10 px-1.5 py-0.5 text-white/65">{count}</span>
    </div>
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5 text-[11px] text-white/80">
          {it}
        </div>
      ))}
    </div>
  </div>
);

const CRM = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
    <div>
      <Title
        eyebrow="Diferencial Estratégico"
        eyebrowIcon={KanbanSquare}
        title={<>CRM nativo. <br /><span className="text-white/40">Não é integração — é coração.</span></>}
      />
      <ul className="space-y-3">
        {[
          "Gestão de leads em tempo real",
          "Pipeline Kanban customizável por negócio",
          "Histórico completo de conversas em um só lugar",
          "Métricas e visão comercial unificada",
          "Cada conversa do WhatsApp já vira um card no funil",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-base text-white/85">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(142,76%,56%)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <KanbanColumn title="Novo" count={12} color="bg-[hsl(217,91%,60%)]" items={["Marina · Clínica", "Carlos · Solar"]} />
      <KanbanColumn title="Qualificado" count={8} color="bg-[hsl(190,90%,60%)]" items={["João · Adv.", "Ana · Restaurante"]} />
      <KanbanColumn title="Proposta" count={5} color="bg-[hsl(38,92%,55%)]" items={["Pedro · Academia", "Lúcia · E-com"]} />
      <KanbanColumn title="Ganho" count={3} color="bg-[hsl(142,76%,56%)]" items={["Marcos · Estética", "Rita · Pet"]} />
    </div>
  </div>
);

/* ============================== Audience ============================== */

const Audience = () => {
  const niches = [
    { icon: Briefcase, label: "Autônomos" },
    { icon: Stethoscope, label: "Clínicas" },
    { icon: Scale, label: "Advogados" },
    { icon: UtensilsCrossed, label: "Restaurantes" },
    { icon: Dumbbell, label: "Academias" },
    { icon: Sun, label: "Energia Solar" },
    { icon: Wrench, label: "Prestadores" },
    { icon: ShoppingBag, label: "E-commerce" },
  ];
  return (
    <div>
      <Title
        eyebrow="Público-alvo"
        eyebrowIcon={Users}
        title={<>Qualquer negócio <br /><span className="text-white/40">que vende pelo WhatsApp.</span></>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {niches.map((n) => (
          <div key={n.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]">
            <n.icon className="h-7 w-7 mx-auto text-[hsl(217,91%,75%)]" />
            <div className="mt-3 text-sm font-medium">{n.label}</div>
          </div>
        ))}
      </div>
      <Quote>Onde existe WhatsApp, existe oportunidade para o Theo.</Quote>
    </div>
  );
};

/* ============================== Model ============================== */

const Model = () => (
  <div>
    <Title
      eyebrow="Modelo de Negócio"
      eyebrowIcon={Award}
      title={<>SaaS recorrente. <br /><span className="text-white/40">Simples, escalável, previsível.</span></>}
    />
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(217,91%,60%)]/10 to-[hsl(142,76%,46%)]/10 p-8 md:p-10 backdrop-blur">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="md:col-span-2">
          <div className="text-sm uppercase tracking-wider text-white/55">Plano único</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl md:text-7xl font-bold tracking-tighter">R$ 97</span>
            <span className="text-white/55">/mês</span>
          </div>
          <p className="mt-3 text-white/70 max-w-md leading-relaxed">
            Acesso completo à plataforma, IA treinada para o negócio, CRM nativo e atendimento ilimitado no WhatsApp.
          </p>
        </div>
        <Pill label="Receita recorrente" />
        <Pill label="Margem alta" />
        <Pill label="Onboarding rápido" />
        <Pill label="Alta retenção esperada" />
        <Pill label="Upsell de créditos de IA" />
        <Pill label="Expansão por nichos" />
      </div>
    </div>
  </div>
);

const Pill = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 text-center backdrop-blur">
    {label}
  </div>
);

/* ============================== Projection ============================== */

const Projection = () => (
  <div>
    <Title
      eyebrow="Projeção de Crescimento"
      eyebrowIcon={TrendingUp}
      title={<>Crescimento <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">previsível</span>, <br /><span className="text-white/40">não especulativo.</span></>}
    />
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/55">
            <th className="px-5 py-4">Período</th>
            <th className="px-5 py-4">Clientes ativos</th>
            <th className="px-5 py-4">MRR</th>
            <th className="px-5 py-4">ARR</th>
            <th className="px-5 py-4 hidden md:table-cell">% do SOM</th>
          </tr>
        </thead>
        <tbody className="text-sm md:text-base">
          <ProjectionRow period="Dez / 2026" clients="1.000" mrr="R$ 97 mil" arr="R$ 1,16 mi" som="0,167%" />
          <ProjectionRow period="Dez / 2027" clients="5.000" mrr="R$ 485 mil" arr="R$ 5,82 mi" som="0,83%" />
          <ProjectionRow period="Dez / 2028" clients="15.000" mrr="R$ 1,45 mi" arr="R$ 17,4 mi" som="2,5%" highlight />
        </tbody>
      </table>
    </div>
    <p className="mt-4 text-xs text-white/40">
      * Projeções construídas a partir do plano de aquisição validado e do ticket atual de R$ 97/mês. Não consideram upsell de
      créditos de IA, pacotes corporativos ou novos produtos.
    </p>
  </div>
);

const ProjectionRow = ({
  period,
  clients,
  mrr,
  arr,
  som,
  highlight = false,
}: {
  period: string;
  clients: string;
  mrr: string;
  arr: string;
  som: string;
  highlight?: boolean;
}) => (
  <tr className={`border-b border-white/5 last:border-0 ${highlight ? "bg-[hsl(142,76%,46%)]/5" : ""}`}>
    <td className="px-5 py-4 font-semibold">{period}</td>
    <td className="px-5 py-4 font-mono tabular-nums">{clients}</td>
    <td className="px-5 py-4 font-mono tabular-nums">{mrr}</td>
    <td className={`px-5 py-4 font-mono tabular-nums font-semibold ${highlight ? "text-[hsl(142,76%,76%)]" : ""}`}>{arr}</td>
    <td className="px-5 py-4 font-mono tabular-nums hidden md:table-cell text-white/65">{som}</td>
  </tr>
);

/* ============================== Strategy ============================== */

const Strategy = () => (
  <div>
    <Title
      eyebrow="Estratégia de Crescimento"
      eyebrowIcon={Rocket}
      title={<>5 alavancas, <br /><span className="text-white/40">um único objetivo.</span></>}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <FeatureCard icon={Target} title="Tráfego pago validado" desc="Aquisição direta no Meta Ads e Google Ads para nichos com maior LTV." />
      <FeatureCard icon={Users} title="Expansão por nicho" desc="Templates verticais (clínicas, solar, advogados) acelerando ativação." />
      <FeatureCard icon={MessageCircle} title="Indicação e parceiros" desc="Programa de afiliados e agências revendedoras white-label." />
      <FeatureCard icon={Sparkles} title="Evolução do produto" desc="Voz, integrações e novos canais ampliando o ticket médio." />
      <FeatureCard icon={TrendingUp} title="Upsell de créditos IA" desc="Planos avançados com voz, OCR e mídia ampliando a margem." />
      <FeatureCard icon={Award} title="Marca forte no WhatsApp" desc="Construção de autoridade no maior canal de atendimento do Brasil." />
    </div>
  </div>
);

/* ============================== Edge ============================== */

const Edge = () => (
  <div>
    <Title
      eyebrow="Diferenciais Competitivos"
      eyebrowIcon={Award}
      title={<>Não é mais um chatbot. <br /><span className="text-white/40">É um atendente.</span></>}
    />
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
      <div className="grid grid-cols-3 text-xs uppercase tracking-wider text-white/55 border-b border-white/10">
        <div className="px-5 py-4">Critério</div>
        <div className="px-5 py-4 border-l border-white/10">Chatbots tradicionais</div>
        <div className="px-5 py-4 border-l border-[hsl(142,76%,46%)]/30 bg-[hsl(142,76%,46%)]/5 text-[hsl(142,76%,76%)]">Theo IA</div>
      </div>
      <EdgeRow criterion="Conversa natural" old="Fluxo engessado" theo="IA contextual treinada" />
      <EdgeRow criterion="Multimodal (áudio/imagem)" old="Texto apenas" theo="Áudio, imagem e texto" />
      <EdgeRow criterion="CRM integrado" old="Integração frágil" theo="CRM nativo" />
      <EdgeRow criterion="Agenda e follow-up" old="Manual" theo="Automático e inteligente" />
      <EdgeRow criterion="Tempo de implantação" old="Semanas" theo="Minutos" />
    </div>
  </div>
);

const EdgeRow = ({ criterion, old, theo }: { criterion: string; old: string; theo: string }) => (
  <div className="grid grid-cols-3 text-sm border-b border-white/5 last:border-0">
    <div className="px-5 py-4 font-medium text-white/85">{criterion}</div>
    <div className="px-5 py-4 border-l border-white/10 text-white/55 flex items-center gap-2">
      <X className="h-3.5 w-3.5 text-white/30" /> {old}
    </div>
    <div className="px-5 py-4 border-l border-[hsl(142,76%,46%)]/20 bg-[hsl(142,76%,46%)]/5 text-white flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-[hsl(142,76%,66%)]" /> {theo}
    </div>
  </div>
);

/* ============================== Vision ============================== */

const Vision = () => (
  <div className="text-center">
    <Title
      eyebrow="Visão de Futuro"
      eyebrowIcon={Eye}
      title={<>Tornar o Theo IA o <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">padrão de atendimento</span> <br /><span className="text-white/40">das PMEs brasileiras.</span></>}
      align="center"
    />
    <p className="mx-auto max-w-2xl text-lg md:text-xl text-white/70 font-light leading-relaxed">
      Um Brasil em que toda pequena empresa tem uma operação de vendas trabalhando 24 horas por dia — sem precisar
      contratar mais ninguém para isso.
    </p>
  </div>
);

/* ============================== Closing ============================== */

const Closing = () => (
  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(217,91%,60%)]/15 via-transparent to-[hsl(142,76%,46%)]/15 p-10 md:p-16 text-center backdrop-blur">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white/70">
      <Rocket className="h-3.5 w-3.5" /> O momento é agora
    </div>
    <h2 className="mt-5 text-4xl md:text-6xl font-bold tracking-tighter leading-[1.05]">
      O momento de entrar <br />
      <span className="bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(142,76%,56%)] bg-clip-text text-transparent">é agora.</span>
    </h2>
    <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
      Mercado provado, produto validado e matemática que fecha. Vamos construir o futuro do atendimento brasileiro juntos.
    </p>
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <a
        href="https://wa.me/5547991293662"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,46%)] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[hsl(217,91%,60%)]/30 transition hover:shadow-[hsl(217,91%,60%)]/50"
      >
        Falar com fundadores <ArrowRight className="h-4 w-4" />
      </a>
      <a
        href="#mercado"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-base font-medium text-white/85 backdrop-blur transition hover:bg-white/10"
      >
        Rever a tese
      </a>
    </div>
  </div>
);

export default Investors;