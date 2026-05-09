## Visão geral

Redesign visual completo do Theo IA inspirado nas imagens de referência: estética futurista "AI neon glow" — fundo navy/preto profundo, halos azul-elétrico e ciano, ícones com glow pulsante, estrelas de IA flutuando como partículas ambientes. Mantém o tema claro funcional, mas com paleta também refinada. Toda a mudança fica em **camada de apresentação** (tokens, componentes UI, layouts) — sem tocar em lógica de negócio, edge functions ou schema.

## Direção estética

- **Movimento:** "Neon Synapse" — minimalismo escuro com luz pulsando como sinapses de IA.
- **Cores (dark, padrão):**
  - Background: navy quase preto `222 60% 4%` com gradiente radial sutil para `220 70% 8%`
  - Surface/Card: vidro fosco `220 50% 8% / 0.6` com borda `200 100% 60% / 0.15`
  - Primary: azul elétrico `217 100% 60%`
  - Accent neon: ciano `190 100% 55%`
  - Glow secundário: roxo `265 90% 65%` e verde WhatsApp `142 76% 45%` (mantido onde faz sentido)
  - Texto: `210 40% 98%` / muted `215 25% 70%`
- **Cores (light):** versão clean — branco off `210 30% 98%`, primary igual, sem glow forte.
- **Tipografia:** `Space Grotesk` para títulos/números (futurista, geométrica) + `Inter` para corpo. Carregadas via Google Fonts no `index.html`.
- **Forma:** cantos `rounded-2xl`, bordas finas com gradiente luminoso, sombras `0 0 40px hsl(primary/0.25)` (glow externo) em elementos ativos.

## Componentes globais novos

1. **`<AuroraBackground />`** — gradient mesh animado (CSS only) usado como fundo de páginas-chave (Login, Onboarding, Dashboard, Landing).
2. **`<FloatingSparkles />`** — partículas SVG (estrelinhas estilo "AI sparkle" 4-pontas) flutuando com `framer-motion`, densidade configurável, `prefers-reduced-motion` respeitado, `pointer-events:none`.
3. **`<GlowCard />`** — wrapper de Card com borda gradiente animada e halo no hover.
4. **`<NeonIcon />`** — wrapper para ícones com aura colorida (variantes: blue, cyan, green, purple).
5. **Sidebar redesenhada** — fundo glass, logo com halo pulsante, item ativo com pílula glow azul (igual à imagem 2), ícones contornados.

Esses ficam em `src/components/fx/` e `src/components/ui-futuristic/`.

## Sistema de design (tokens)

- Reescrever `src/index.css` com nova paleta dark + light, adicionando:
  - `--gradient-aurora`, `--gradient-primary`, `--glow-primary`, `--glow-cyan`, `--glow-purple`
  - `--shadow-glow`, `--shadow-elevated`, `--blur-glass`
- Atualizar `tailwind.config.ts`:
  - Adicionar fontes `display` (Space Grotesk) e `sans` (Inter)
  - Adicionar keyframes: `float`, `pulse-glow`, `sparkle`, `aurora-shift`, `shimmer`
  - Animações utilitárias correspondentes
- Atualizar variantes do `Button` (`buttonVariants`) com `neon`, `glow`, `ghost-neon`.
- Atualizar `Card` para usar surface glass por padrão.

## Mapa de páginas

| Área | Tratamento |
|---|---|
| Landing (`/`) | Hero com aurora + sparkles, CTA glow, seções com cards glass |
| Login / Register / Forgot / Reset | Background aurora, card glass central, logo halo |
| Onboarding | Já tem ícones bem alinhados — aplicar tokens novos, adicionar sparkles ambientes, glow nos passos |
| Sidebar + DashboardLayout | Glass, item ativo com pílula azul brilhante, badge user com aura |
| Dashboard | KPI cards glass com números em Space Grotesk, gráficos com cores neon, sparkles no header |
| Conversations / WhatsApp / Contacts / Tasks / Appointments / CRM / Followup / Products / KB | Mesmo skin: tabelas com header semibold, cards glass, badges neon, vazios com ilustração + sparkle |
| Settings (todas tabs) | Cards glass agrupados, switches com glow ativo |
| Help Center / Support | Cards categoria com NeonIcon variado |
| Admin (`/admin/*`) | Mantém identidade própria mas adota mesmos tokens (atualmente amber/slate). Trocar para azul/ciano consistente com o resto, mantendo header de tabela alto-contraste descrito na memory. **Confirmar:** adoto a nova paleta no admin também (recomendado) — está incluído no plano. |
| AIAgent / SimulateAttendance / Investors / Investment / NotFound | Mesmo skin |

## Animações & interações

- `FloatingSparkles` em: Landing hero, Login, Onboarding (boas-vindas), Dashboard header, estados vazios.
- `AuroraBackground` em: Landing, auth pages, Onboarding, Dashboard.
- Hover em cards: leve `translateY(-2px)` + intensifica glow.
- Sidebar item ativo: pulso suave de glow.
- Botões primários: shimmer sutil no hover.
- Logo: halo pulsando (3s loop).
- Tudo respeita `prefers-reduced-motion: reduce` — desliga partículas e pulsos.

## Performance & acessibilidade

- Sparkles são SVG leves (max ~15 elementos) com `will-change: transform`.
- Aurora é CSS puro (sem canvas).
- Contraste AA garantido em ambos os temas (validar texto muted sobre glass).
- Sem dependências novas além de `framer-motion` (já no projeto) e Google Fonts.

## Entrega em fases (mesmo PR)

1. Tokens + tailwind + fontes + componentes fx (`AuroraBackground`, `FloatingSparkles`, `GlowCard`, `NeonIcon`)
2. Sidebar + DashboardLayout + Login/Register + Onboarding (impacto visual imediato)
3. Dashboard + páginas internas principais (Conversations, WhatsApp, Contacts, CRM, Tasks, Appointments)
4. Settings + Admin + páginas restantes
5. Landing page

## Fora de escopo

- Lógica de negócio, hooks, edge functions, schema do banco
- Mudança de copy
- Reorganização de rotas/menus
- Substituição de bibliotecas (shadcn permanece)

## Detalhes técnicos

- Arquivos novos:
  - `src/components/fx/AuroraBackground.tsx`
  - `src/components/fx/FloatingSparkles.tsx`
  - `src/components/fx/GlowCard.tsx`
  - `src/components/fx/NeonIcon.tsx`
- Arquivos reescritos: `src/index.css`, `tailwind.config.ts`, `index.html` (fontes), `src/components/Sidebar.tsx`, `src/components/DashboardLayout.tsx`, `src/components/ui/button.tsx` (adicionar variantes — sem quebrar as existentes), `src/components/ui/card.tsx`.
- Páginas: aplicar `AuroraBackground` + classes novas; sem mudar estrutura de dados.
- Tema persiste via `localStorage` (toggle já existente é mantido se houver; senão, adiciono toggle no header da Sidebar).
