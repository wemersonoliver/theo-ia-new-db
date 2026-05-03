## Objetivo

Transformar os 3 itens da aba "Módulos" (Configuração de Horários, Assinaturas, Base de Conhecimento) em abas próprias dentro de `/settings`, no mesmo padrão visual de "Equipe", "Roleta", "Aparência", etc. Isso simplifica a navegação para usuários leigos, eliminando o passo intermediário do card que redireciona para outra rota.

## Mudanças

### 1. `src/pages/Settings.tsx`
- Remover a aba `modules` e seu `TabsContent` (a grade com 3 cards).
- Adicionar 3 novas abas no `TabsList`:
  - `appointment-settings` → "Horários"
  - `subscriptions` → "Assinatura"
  - `knowledge-base` → "Base de Conhecimento"
- Para cada uma, criar um `TabsContent` que renderiza o conteúdo da página correspondente diretamente (sem `DashboardLayout`, pois já estamos dentro de um).
- Remover imports não usados (`CalendarCog`, `CreditCard`, `FileText`, `ChevronRight`, `useNavigate`).

### 2. Refatoração dos conteúdos das páginas
Para reaproveitar o conteúdo sem duplicar, extrair o "miolo" de cada página em um componente sem `DashboardLayout`:

- `src/pages/AppointmentSettings.tsx` → extrair conteúdo para `src/components/settings/AppointmentSettingsTab.tsx`
- `src/pages/Subscriptions.tsx` → extrair conteúdo para `src/components/settings/SubscriptionsTab.tsx`
- `src/pages/KnowledgeBase.tsx` → extrair conteúdo para `src/components/settings/KnowledgeBaseTab.tsx`

As rotas existentes (`/appointment-settings`, `/subscriptions`, `/knowledge-base`) continuam funcionando — as páginas passam a ser apenas um wrapper com `DashboardLayout` + o componente Tab, mantendo compatibilidade com links externos (ex: TrialBanner que aponta para `/subscriptions`).

### 3. Ordem final das abas em Settings
Perfil | Horários | Assinatura | Base de Conhecimento | Equipe | Roleta | Notificações | Aparência | Segurança | Tutorial | Avançado

## Resultado
- Aba "Módulos" eliminada.
- Cada módulo configurável agora é uma aba direta em Configurações.
- Nenhuma rota quebrada; nenhuma alteração no Sidebar lateral.
