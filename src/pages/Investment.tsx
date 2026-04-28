import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Rocket,
  TrendingUp,
  Users,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Crown,
  Flame,
  LineChart,
  Globe2,
  MessageCircle,
  KanbanSquare,
  Clock,
} from "lucide-react";

const NAV_SECTIONS = [
  { id: "oportunidade", label: "Oportunidade" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "projecao", label: "Projeção" },
  { id: "mercado", label: "Mercado" },
  { id: "diferencial", label: "Diferencial" },
  { id: "meta", label: "Meta" },
  { id: "garantir", label: "Garantir cota" },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const Investment = () => {
  const [users, setUsers] = useState(1000);
  const NET_PER_SUB = 84;
  const QUOTA_SHARE = 0.05;

  const monthlyNet = users * NET_PER_SUB;
  const monthlyPerQuota = monthlyNet * QUOTA_SHARE;

  const [quotasLeft] = useState(4);
  const goalProgress = Math.min((users / 1000) * 100, 100);

  // simple ticker for "exclusivity"
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const deadline = new Date("2026-12-31T23:59:59");
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="min-h-screen w-full bg-[hsl(222,47%,4%)] text-white relative overflow-x-hidden">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[hsl(142,76%,40%)]/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-[hsl(217,91%,60%)]/12 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[hsl(45,95%,55%)]/10 blur-[120px]" />
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
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(142,76%,46%)] to-[hsl(217,91%,60%)] flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Theo IA · Investment</span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm text-white/65">
            {NAV_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="transition hover:text-white">
                {s.label}
              </a>
            ))}
          </nav>

          <a
            href="#garantir"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(142,76%,46%)] to-[hsl(217,91%,60%)] px-4 py-2 text-sm font-medium shadow-lg shadow-[hsl(142,76%,46%)]/20 hover:shadow-[hsl(142,76%,46%)]/40 transition"
          >
            Quero minha cota <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main id="top" className="relative z-10">
        {/* HERO */}
        <section id="oportunidade" className="mx-auto max-w-7xl px-6 md:px-10 pt-20 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(45,95%,55%)]/30 bg-[hsl(45,95%,55%)]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[hsl(45,95%,70%)]">
              <Crown className="h-3.5 w-3.5" /> Oportunidade limitada · {quotasLeft} cotas
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
              Invista no crescimento do{" "}
              <span className="bg-gradient-to-r from-[hsl(142,76%,55%)] via-[hsl(170,80%,55%)] to-[hsl(217,91%,65%)] bg-clip-text text-transparent">
                Theo IA
              </span>{" "}
              e participe de uma operação com potencial escalável no mercado brasileiro.
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-white/70">
              Uma oportunidade limitada de participação sobre assinaturas recorrentes de uma
              plataforma de IA com atuação em um dos maiores mercados do Brasil.
            </p>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
              {[
                { label: "Cotas disponíveis", value: `${quotasLeft}`, icon: Lock, accent: "hsl(45,95%,55%)" },
                { label: "Valor por cota", value: "R$ 5.000", icon: Sparkles, accent: "hsl(217,91%,60%)" },
                { label: "Participação", value: "5%", icon: TrendingUp, accent: "hsl(142,76%,46%)" },
                { label: "Retorno mín. projetado", value: "R$ 10.000", icon: Target, accent: "hsl(280,80%,65%)" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
                >
                  <s.icon className="h-5 w-5 mb-3" style={{ color: s.accent }} />
                  <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="mt-1 text-xs text-white/55 uppercase tracking-wider">{s.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
              <a
                href="#garantir"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(142,76%,46%)] to-[hsl(217,91%,60%)] px-7 py-3.5 text-sm font-medium shadow-xl shadow-[hsl(142,76%,46%)]/30 hover:scale-[1.02] transition"
              >
                Quero analisar esta oportunidade <ArrowRight className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-2 text-sm text-white/55">
                <Clock className="h-4 w-4" />
                Contrato válido até 31/12/2026 · {daysLeft} dias restantes
              </div>
            </div>

            <div className="mt-12 flex items-center gap-3 rounded-full border border-[hsl(0,84%,60%)]/30 bg-[hsl(0,84%,60%)]/8 px-5 py-2.5 text-sm text-[hsl(0,84%,75%)]">
              <Flame className="h-4 w-4" />
              Oportunidade limitada para participar do crescimento de uma operação SaaS com meta agressiva de escala
            </div>
          </motion.div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5">
          <SectionHeader
            kicker="Como funciona a cota"
            title="Mecânica simples, transparente e recorrente"
            subtitle="Você adquire participação direta sobre o valor líquido das novas assinaturas geradas dentro do período contratual."
          />

          <div className="mt-12 grid lg:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Aquisição da cota",
                desc: "Investimento único de R$ 5.000 por cota. Apenas 4 cotas disponíveis.",
                icon: Sparkles,
              },
              {
                step: "02",
                title: "5% sobre cada nova assinatura",
                desc: "Cada cota representa 5% sobre o valor líquido (R$ 84) de cada nova assinatura ativa no período.",
                icon: TrendingUp,
              },
              {
                step: "03",
                title: "Recorrência vitalícia da carteira",
                desc: "A receita recorrente continua mesmo após o fim do contrato (31/12/2026): você segue recebendo 5% de cada assinatura conquistada dentro do período, mês após mês, até que o próprio cliente cancele.",
                icon: LineChart,
              },
            ].map((c, i) => (
              <motion.div
                key={c.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-7"
              >
                <div className="text-xs font-mono text-white/40">{c.step}</div>
                <c.icon className="h-7 w-7 mt-4 text-[hsl(142,76%,55%)]" />
                <h3 className="mt-4 text-xl font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-white/65 leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Exemplo visual */}
          <div className="mt-10 rounded-3xl border border-[hsl(142,76%,46%)]/25 bg-gradient-to-br from-[hsl(142,76%,46%)]/10 via-transparent to-[hsl(217,91%,60%)]/10 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <div className="text-xs uppercase tracking-widest text-[hsl(142,76%,65%)]">Exemplo · Meta operacional</div>
                <div className="mt-3 text-2xl md:text-3xl font-semibold leading-tight">
                  1.000 usuários × R$ 84 líquido ={" "}
                  <span className="text-[hsl(142,76%,60%)]">R$ 84.000/mês</span>
                </div>
                <div className="mt-2 text-lg text-white/75">
                  5% por cota = <span className="font-semibold text-white">R$ 4.200/mês</span>
                </div>
                <p className="mt-4 max-w-xl text-sm text-white/60">
                  Com a meta alcançada, o potencial de recorrência mensal pode superar o valor inicial investido.
                </p>
              </div>
              <div className="flex flex-col items-center md:items-end">
                <div className="text-xs uppercase tracking-widest text-white/50">Por cota / mês</div>
                <div className="mt-2 text-5xl font-semibold bg-gradient-to-r from-[hsl(142,76%,55%)] to-[hsl(217,91%,65%)] bg-clip-text text-transparent">
                  R$ 4.200
                </div>
              </div>
            </div>
          </div>

          {/* Destaque: recorrência pós-contrato */}
          <div className="mt-6 rounded-3xl border border-[hsl(45,95%,55%)]/30 bg-gradient-to-br from-[hsl(45,95%,55%)]/10 via-transparent to-[hsl(142,76%,46%)]/10 p-8 md:p-10">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[hsl(45,95%,55%)]/15 p-3 border border-[hsl(45,95%,55%)]/30">
                <Sparkles className="h-6 w-6 text-[hsl(45,95%,65%)]" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-[hsl(45,95%,70%)]">Diferencial exclusivo</div>
                <h3 className="mt-2 text-2xl md:text-3xl font-semibold leading-tight">
                  Sua receita não termina com o contrato
                </h3>
                <p className="mt-3 text-white/75 max-w-3xl leading-relaxed">
                  Toda assinatura conquistada <span className="text-white font-semibold">dentro do período contratual (até 31/12/2026)</span> permanece gerando recorrência para você <span className="text-[hsl(142,76%,60%)] font-semibold">mesmo após o término do contrato</span>. Você continua recebendo 5% sobre cada cliente ativo, mês após mês, <span className="text-white font-semibold">até que o próprio cliente cancele a assinatura</span>.
                </p>
                <p className="mt-3 text-sm text-white/55 max-w-3xl">
                  Na prática: a carteira construída durante o contrato vira um ativo de longo prazo. Quanto mais cedo você entra, maior a base de clientes recorrentes que continuará pagando depois de 2026.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROJEÇÃO */}
        <section id="projecao" className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5">
          <SectionHeader
            kicker="Projeção de retorno"
            title="Três cenários, uma única oportunidade"
            subtitle="Projeções construídas sobre metas operacionais e potencial de escala da plataforma."
          />

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <ScenarioCard
              tag="Conservador"
              users={250}
              monthlyNet={250 * NET_PER_SUB}
              perQuota={250 * NET_PER_SUB * QUOTA_SHARE}
              tone="hsl(217,91%,60%)"
            />
            <ScenarioCard
              tag="Moderado"
              users={500}
              monthlyNet={500 * NET_PER_SUB}
              perQuota={500 * NET_PER_SUB * QUOTA_SHARE}
              tone="hsl(280,80%,65%)"
              highlight
            />
            <ScenarioCard
              tag="Meta"
              users={1000}
              monthlyNet={1000 * NET_PER_SUB}
              perQuota={1000 * NET_PER_SUB * QUOTA_SHARE}
              tone="hsl(142,76%,55%)"
            />
          </div>

          {/* Simulador */}
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[hsl(217,91%,70%)]">
                  <BarChart3 className="h-4 w-4" /> Simulador interativo
                </div>
                <h3 className="mt-3 text-2xl md:text-3xl font-semibold">
                  Ajuste a base de usuários e veja seu retorno por cota
                </h3>
                <p className="mt-3 text-sm text-white/60 max-w-lg">
                  Mova o controle e simule sua participação mensal sobre a receita líquida da operação.
                </p>

                <div className="mt-8">
                  <div className="flex items-center justify-between text-sm text-white/60 mb-2">
                    <span>Usuários ativos</span>
                    <span className="font-mono text-white">{users.toLocaleString("pt-BR")}</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={2000}
                    step={50}
                    value={users}
                    onChange={(e) => setUsers(Number(e.target.value))}
                    className="w-full accent-[hsl(142,76%,46%)]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-white/40 font-mono">
                    <span>50</span>
                    <span>1.000 (meta)</span>
                    <span>2.000</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full grid grid-cols-2 gap-4">
                <Stat label="Receita líquida / mês" value={formatBRL(monthlyNet)} accent="hsl(217,91%,65%)" />
                <Stat label="Por cota / mês" value={formatBRL(monthlyPerQuota)} accent="hsl(142,76%,55%)" />
                <Stat label="Por cota / ano" value={formatBRL(monthlyPerQuota * 12)} accent="hsl(280,80%,70%)" />
                <Stat label="4 cotas / mês" value={formatBRL(monthlyPerQuota * 4)} accent="hsl(45,95%,60%)" />
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[hsl(142,76%,46%)]/30 bg-[hsl(142,76%,46%)]/8 p-6 flex items-start gap-4">
            <Target className="h-5 w-5 text-[hsl(142,76%,60%)] mt-0.5" />
            <div>
              <div className="text-base font-medium">
                Rendimento mínimo projetado até dezembro:{" "}
                <span className="text-[hsl(142,76%,60%)] font-semibold">R$ 10.000 por cota</span>
              </div>
              <p className="mt-1 text-xs text-white/55">
                Projeções baseadas em metas operacionais e potencial de escala. Resultados podem variar.
              </p>
            </div>
          </div>
        </section>

        {/* MERCADO */}
        <section id="mercado" className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5">
          <SectionHeader
            kicker="Tamanho do mercado"
            title="Uma oportunidade gigante, horizontal e com dor universal"
            subtitle="O Theo IA atende um mercado massivo: vender mais e atender melhor."
          />

          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Globe2, value: "20M+", label: "Pequenos negócios no Brasil" },
              { icon: Users, value: "Milhões", label: "Autônomos, clínicas, restaurantes, academias, advogados e prestadores" },
              { icon: MessageCircle, value: "#1", label: "WhatsApp como principal canal comercial no Brasil" },
              { icon: Zap, value: "Boom", label: "Crescimento acelerado de IA e automação comercial" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <m.icon className="h-6 w-6 text-[hsl(217,91%,65%)]" />
                <div className="mt-4 text-3xl font-semibold tracking-tight">{m.value}</div>
                <div className="mt-2 text-sm text-white/60 leading-relaxed">{m.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* DIFERENCIAL */}
        <section id="diferencial" className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5">
          <SectionHeader
            kicker="Diferencial estratégico"
            title="Uma estrutura pensada para crescimento rápido, previsível e replicável"
          />

          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Bot, title: "IA para múltiplos nichos", desc: "Atendimento adaptável para qualquer segmento de serviço." },
              { icon: MessageCircle, title: "WhatsApp 24/7", desc: "Operação ininterrupta no canal #1 do Brasil." },
              { icon: KanbanSquare, title: "CRM próprio integrado", desc: "Pipeline, follow-ups e gestão completa em uma única plataforma." },
              { icon: Sparkles, title: "Ticket acessível: R$ 97", desc: "Entrada agressiva que destrava conversão e escala." },
              { icon: Rocket, title: "Escala nacional", desc: "Operação 100% digital, replicável em qualquer cidade do país." },
              { icon: ShieldCheck, title: "Tecnologia proprietária", desc: "Stack próprio, dados próprios, propriedade do crescimento." },
            ].map((d, i) => (
              <motion.div
                key={d.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6"
              >
                <d.icon className="h-6 w-6 text-[hsl(142,76%,55%)]" />
                <h3 className="mt-4 text-lg font-semibold">{d.title}</h3>
                <p className="mt-2 text-sm text-white/60">{d.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* META */}
        <section id="meta" className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5">
          <SectionHeader
            kicker="Meta operacional · Dez/2026"
            title="1.000 usuários ativos · R$ 84.000/mês de receita líquida"
            subtitle="Expansão por tráfego pago, múltiplos nichos e acessibilidade de entrada."
          />

          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-12">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/50">Progresso até a meta</div>
                <div className="mt-1 text-2xl font-semibold">
                  {users.toLocaleString("pt-BR")} <span className="text-white/40">/ 1.000 usuários</span>
                </div>
              </div>
              <div className="text-3xl font-semibold text-[hsl(142,76%,60%)]">
                {goalProgress.toFixed(0)}%
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-white/5 overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalProgress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-gradient-to-r from-[hsl(142,76%,46%)] via-[hsl(170,80%,50%)] to-[hsl(217,91%,60%)]"
              />
            </div>
            <p className="mt-6 text-sm text-white/60 max-w-2xl">
              Um modelo SaaS com potencial de recorrência e crescimento exponencial, sustentado por aquisição
              digital, ticket acessível e expansão multicategoria.
            </p>
          </div>
        </section>

        {/* ESCASSEZ + TRANSPARÊNCIA */}
        <section className="mx-auto max-w-7xl px-6 md:px-10 py-24 border-t border-white/5 grid lg:grid-cols-2 gap-8">
          <div className="rounded-3xl border border-[hsl(45,95%,55%)]/30 bg-gradient-to-br from-[hsl(45,95%,55%)]/10 via-transparent to-transparent p-8 md:p-10">
            <Crown className="h-7 w-7 text-[hsl(45,95%,65%)]" />
            <h3 className="mt-5 text-2xl md:text-3xl font-semibold">Escassez real</h3>
            <p className="mt-3 text-white/70">As melhores oportunidades costumam surgir antes da escala.</p>
            <ul className="mt-6 space-y-3">
              {[
                "Apenas 4 cotas disponíveis",
                "Estrutura limitada e exclusiva",
                "Entrada inicial acessível",
                "Possibilidade de participar antes da expansão",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(45,95%,65%)] mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
            <ShieldCheck className="h-7 w-7 text-[hsl(142,76%,55%)]" />
            <h3 className="mt-5 text-2xl md:text-3xl font-semibold">Transparência e segurança</h3>
            <p className="mt-3 text-white/70">Uma proposta estruturada para crescimento com visão estratégica.</p>
            <ul className="mt-6 space-y-3">
              {[
                "Contrato claro e formalizado",
                "Prazo de aquisição de carteira definido até 31/12/2026",
                "Participação vinculada a vendas dentro do período",
                "Recorrência mantida após o fim do contrato — receita continua até o cliente cancelar",
                "Projeções transparentes e auditáveis",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(142,76%,55%)] mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="garantir" className="mx-auto max-w-7xl px-6 md:px-10 py-28 border-t border-white/5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[hsl(142,76%,46%)]/15 via-[hsl(217,91%,60%)]/10 to-[hsl(280,80%,60%)]/10 p-10 md:p-16 text-center"
          >
            <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-[hsl(142,76%,46%)]/20 blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[hsl(217,91%,60%)]/20 blur-[100px]" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-widest text-white/70">
                <Flame className="h-3.5 w-3.5 text-[hsl(45,95%,65%)]" /> Últimas {quotasLeft} cotas
              </div>
              <h2 className="mt-6 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl mx-auto">
                Participe agora de uma oportunidade limitada em uma operação com{" "}
                <span className="bg-gradient-to-r from-[hsl(142,76%,55%)] to-[hsl(217,91%,65%)] bg-clip-text text-transparent">
                  potencial nacional
                </span>
                .
              </h2>
              <p className="mt-5 text-lg text-white/70 max-w-2xl mx-auto">
                Entre antes da escala. O crescimento recompensa quem chega primeiro.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://wa.me/5547991293662?text=Tenho%20interesse%20em%20garantir%20uma%20cota%20do%20Theo%20IA"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(142,76%,46%)] to-[hsl(217,91%,60%)] px-8 py-4 text-base font-medium shadow-2xl shadow-[hsl(142,76%,46%)]/30 hover:scale-[1.02] transition"
                >
                  Quero garantir minha cota <ArrowRight className="h-4 w-4" />
                </a>
                <div className="text-sm text-white/55">
                  Investimento de R$ 5.000 · Retorno mín. projetado R$ 10.000
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="border-t border-white/5 py-10 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Theo IA · Documento de oportunidade. Projeções ilustrativas baseadas em metas
          operacionais. Não constitui promessa de rendimento.
        </footer>
      </main>
    </div>
  );
};

const SectionHeader = ({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) => (
  <div className="max-w-3xl">
    <div className="text-xs uppercase tracking-[0.2em] text-[hsl(142,76%,60%)]">{kicker}</div>
    <h2 className="mt-3 text-3xl md:text-4xl font-semibold leading-tight tracking-tight">{title}</h2>
    {subtitle && <p className="mt-4 text-white/65 text-lg">{subtitle}</p>}
  </div>
);

const ScenarioCard = ({
  tag,
  users,
  monthlyNet,
  perQuota,
  tone,
  highlight,
}: {
  tag: string;
  users: number;
  monthlyNet: number;
  perQuota: number;
  tone: string;
  highlight?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`relative rounded-2xl border p-7 ${
      highlight
        ? "border-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] scale-[1.02]"
        : "border-white/10 bg-white/[0.03]"
    }`}
  >
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-widest"
      style={{ background: `${tone}20`, color: tone, border: `1px solid ${tone}40` }}
    >
      Cenário · {tag}
    </div>
    <div className="mt-6 text-4xl font-semibold tracking-tight">{users.toLocaleString("pt-BR")}</div>
    <div className="text-sm text-white/55">usuários ativos</div>

    <div className="mt-6 h-px bg-white/10" />

    <div className="mt-6 space-y-3">
      <Row label="Receita líquida / mês" value={formatBRL(monthlyNet)} />
      <Row label="Por cota / mês (5%)" value={formatBRL(perQuota)} bold tone={tone} />
    </div>
  </motion.div>
);

const Row = ({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-white/60">{label}</span>
    <span
      className={bold ? "text-lg font-semibold" : "text-sm text-white/85"}
      style={bold && tone ? { color: tone } : undefined}
    >
      {value}
    </span>
  </div>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
    <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

export default Investment;