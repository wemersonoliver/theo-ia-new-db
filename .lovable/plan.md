

# Plano: Nova Dashboard com Métricas de Atendimento

Vou redesenhar a `/dashboard` inspirada na referência, focando no que faz sentido para um sistema **WhatsApp-only com IA + CRM + Agendamentos + Equipe**. Removo o que é "multicanal" e adiciono o **Tempo Médio de Atendimento** (que você destacou).

## O que entra na nova Dashboard

### 1. Filtros no topo
- **Período**: presets (Hoje, 7 dias, 30 dias, Mês atual) + range customizado
- **Vendedor/Atendente**: dropdown com membros da equipe (de `account_members`) — "Todos" por padrão
- **Funil (Pipeline)**: dropdown listando pipelines do CRM — "Todos os Funis" por padrão

### 2. Cards de KPI (linha superior — 4 cards)
- **Leads Recebidos** — nº de conversas novas no período (primeira mensagem dentro do range)
- **Atendimentos** — nº de conversas que tiveram resposta humana ou da IA no período
- **Agendamentos** — nº de appointments criados no período
- **Vendas Concluídas** — nº de deals com `won_at` dentro do período + valor total ganho

Cada card mostra variação % vs. período anterior equivalente.

### 3. Card destacado: TEMPO MÉDIO DE ATENDIMENTO ⭐
Esse é o card que você pediu. Vai mostrar:

- **Tempo médio de primeira resposta** (TMPR): tempo entre a 1ª mensagem do cliente e a 1ª resposta (humana ou IA) — "quanto demora para iniciar o atendimento"
- **Tempo médio de atendimento total** (TMA): duração da conversa do início até a última mensagem antes de 24h de inatividade
- **Detalhamento por atendente**: lista cada membro da equipe com seu TMA pessoal (substituindo o "detalhe por canal" da referência, que não se aplica)
- Variação % vs. período anterior (verde se diminuiu, vermelho se aumentou)

Cálculo feito a partir do array `messages` em `whatsapp_conversations` (campos `timestamp`, `from_me`, `sent_by`).

### 4. Funil de Conversão (gráfico)
Funil visual mostrando: Leads → Atendimentos → Agendamentos → Vendas, com nº absoluto e % de conversão entre cada etapa. Usa dados do CRM (deals por estágio) e fallback para os contadores acima quando o pipeline não está estruturado.

### 5. Metas vs. Realizado (gráfico de barras)
Comparativo visual Meta x Realizado para Leads, Atendimentos, Agendamentos e Vendas no período. As metas serão configuráveis por usuário (nova tabela `user_goals` simples — ou armazenadas em `platform_settings` como JSON).

### 6. Desempenho por Vendedor (tabela)
Tabela com: Atendente | Leads atribuídos | Atendimentos | Agendamentos | Vendas | Conversão %. Dados puxados de `assigned_to` em conversas, agendamentos e deals.

### 7. Mantenho da dashboard atual
- `TrialBanner`
- Botão Tutorial
- Card "Configuração Rápida" (status WhatsApp + IA) — movido para o final, em formato compacto

## O que NÃO entro (fora de escopo)
- Detalhamento por canal (WhatsApp, Telefone, E-mail, Chat) — só temos WhatsApp
- "Detalhes por equipe" separado do vendedor — sua estrutura é flat por conta

## Detalhes técnicos

**Novo hook `useDashboardMetrics(range, sellerId, pipelineId)`** que retorna em paralelo:
- Conversas filtradas → calcula leads, TMPR, TMA, atendimentos
- Appointments filtrados → contagem
- Deals filtrados → contagem ganhos + valor
- Comparativo com período anterior (mesma duração, deslocada)

**Cálculo do tempo médio** (em `src/lib/dashboard-metrics.ts`):
```text
Para cada conversa no período:
  msgs = messages ordenadas por timestamp
  primeiraDoCliente = primeira msg com from_me=false
  primeiraResposta = primeira msg com from_me=true APÓS primeiraDoCliente
  TMPR_conv = primeiraResposta.timestamp - primeiraDoCliente.timestamp
  TMA_conv  = última.timestamp - primeira.timestamp (limitado a sessões de 24h)
Média = soma / contagem
```

**Componentes novos**:
- `src/pages/Dashboard.tsx` — reescrito
- `src/components/dashboard/DashboardFilters.tsx`
- `src/components/dashboard/KPICards.tsx`
- `src/components/dashboard/AvgServiceTimeCard.tsx` ⭐
- `src/components/dashboard/ConversionFunnel.tsx` (usa `recharts` FunnelChart)
- `src/components/dashboard/GoalsVsActualChart.tsx` (BarChart)
- `src/components/dashboard/SellerPerformanceTable.tsx`
- `src/hooks/useDashboardMetrics.ts`
- `src/lib/dashboard-metrics.ts` (funções puras de cálculo)

**Banco**: nova tabela `user_goals` (account_id, period_type, leads_goal, appointments_goal, sales_goal, sales_value_cents_goal) com RLS por account, editável em Settings (em iteração futura — por enquanto valores padrão).

**Bibliotecas**: `recharts` já está no projeto (usado em `ui/chart.tsx`), nada novo a instalar.

## Layout visual
```text
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                       [Período▾][Vendedor▾][Funil▾]│
├──────────────────────────────────────────────────────────────┤
│ [Leads 352 ↑18%] [Atend 287 ↑16%] [Agend 126 ↑22%] [Vendas]  │
├──────────────────────┬───────────────────┬───────────────────┤
│ FUNIL DE CONVERSÃO   │ METAS VS REALIZADO│ ⭐TEMPO MÉDIO     │
│                      │                   │ 00:09:42 ↓8%     │
│   [funnel chart]     │   [bar chart]     │                   │
│                      │                   │ Por atendente:    │
│                      │                   │ Ana   00:08:15    │
│                      │                   │ Carlos 00:10:30   │
├──────────────────────┴───────────────────┴───────────────────┤
│ DESEMPENHO POR VENDEDOR                                       │
│ [tabela com leads/atend/agend/vendas/conv% por membro]        │
└──────────────────────────────────────────────────────────────┘
```

Tudo responsivo (1 coluna no mobile, grid no desktop) seguindo o padrão atual do `DashboardLayout`.

