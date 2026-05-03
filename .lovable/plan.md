# Plano: Dashboard Básica vs Avançada

## Objetivo
Separar o dashboard em duas visões conforme o plano do usuário:
- **Plano Básico**: visão simplificada com apenas 4 KPIs.
- **Plano Pro / Tester / Super Admin**: dashboard completo (atual).
- Usuários do plano básico podem visualizar uma **prévia** da dashboard avançada com dados fictícios.

## Mudanças

### 1. `src/components/dashboard/KPICards.tsx`
- Adicionar prop opcional `variant?: "basic" | "full"` (default `"full"`).
- Quando `variant === "basic"`, renderizar apenas 4 cards: **Leads recebidos, Atendimentos, Agendamentos, Clientes em follow-up**.
- Mantém o grid responsivo (em básico usar `lg:grid-cols-4`).

### 2. `src/pages/Dashboard.tsx`
- Usar `useAccountPlan()` para obter `tier`.
- Definir `isBasic = tier === "basic"` (trial e pro/tester veem completa; trial mantém comportamento atual = completa).
- Estado local `previewAdvanced: boolean` para alternar visualização demo.
- Se `isBasic && !previewAdvanced`:
  - Renderizar apenas `<KPICards variant="basic" />`.
  - Mostrar botão **"Dashboard avançada"** que abre um Dialog informando: *"Disponível apenas no plano Pro"*, com:
    - Botão **"Atualizar agora"** → redireciona ao checkout (usar `usePlans` igual ao `WhatsApp.tsx`, oferecer Pro Mensal/Anual).
    - Botão **"Visualizar dashboard"** → fecha dialog e ativa `previewAdvanced = true`.
- Se `isBasic && previewAdvanced`:
  - Renderizar dashboard completa, **mas alimentada por métricas fictícias** (não chamar/ignorar `useDashboardMetrics`).
  - Banner fixo no topo: *"Pré-visualização com dados fictícios — disponível no plano Pro"* + botão **"Voltar"** (desativa preview) e **"Atualizar agora"** (abre dialog de upgrade).
- Caso contrário (Pro/Tester/Trial/Super Admin): comportamento atual inalterado.

### 3. Dados fictícios para preview
Criar `src/lib/dashboard-mock.ts` exportando `MOCK_DASHBOARD_METRICS: DashboardMetrics` com valores plausíveis (leads ~120, services ~95, appointments ~32, sales ~12, salesValueCents ~480000, won/lost/abandoned, conversionRate ~28, followupActive ~18, followupConversionRate ~22, variações coerentes, sellers fictícios, séries para funil/goals/avgServiceTime/avgWaitTime).
- Passar esse mock para todos os componentes filhos (`KPICards`, `ConversionFunnel`, `GoalsVsActualChart`, `AvgServiceTimeCard`, `AvgWaitTimeCard`, `SellerPerformanceTable`) via prop `metrics`.
- Filtros e `OnlineUsersCard` permanecem renderizados, mas sem efeito real no modo preview.

### 4. Dialog de upgrade
- Componente inline em `Dashboard.tsx` (mesmo padrão do `WhatsApp.tsx`): título "Disponível no plano Pro", lista benefícios curtos da dashboard avançada (funil de conversão, performance de vendedores, metas, tempos médios), e dois botões de checkout (Pro Mensal / Pro Anual) usando `usePlans`.

## Comportamento por tier
| Tier | Visão padrão | Botão "Dashboard avançada" | Preview demo |
|------|--------------|----------------------------|--------------|
| basic | KPIs reduzidos (4) | Sim | Sim (mock) |
| trial | Completa (atual) | Não | — |
| pro / tester / super_admin | Completa (atual) | Não | — |

## Arquivos afetados
- `src/pages/Dashboard.tsx` (principal)
- `src/components/dashboard/KPICards.tsx` (variant)
- `src/lib/dashboard-mock.ts` (novo)
