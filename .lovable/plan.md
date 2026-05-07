## Objetivo

Equiparar o **CRM de Suporte (admin)** ao CRM dos usuários, capturar dados do negócio do cliente ao final da entrevista IA e usar esses dados para gerar follow-ups personalizados.

---

## Parte 1 — CRM de Suporte completo

Replicar no `/admin/crm` os recursos hoje presentes no CRM dos usuários.

### 1.1 Banco — novas tabelas (admin)
- `admin_crm_activities` — timeline de notas, mudanças de etapa, ações (espelha `crm_activities`).
- `admin_crm_deal_tasks` — tarefas com prazo, conclusão e responsável (espelha `crm_deal_tasks`).
- Novos campos em `admin_crm_deals`:
  - `business_name` (text) — nome da empresa
  - `business_segment` (text) — nicho/segmento
  - `business_summary` (text) — resumo do negócio
  - `business_data_updated_at` (timestamptz)

RLS: somente `super_admin` (padrão das tabelas admin).

### 1.2 Frontend — paridade visual e funcional
- **Drawer detalhado** (`AdminDealDetailsDrawer`) inspirado em `DealDetailsDrawer.tsx`, contendo:
  - Cabeçalho com dados do usuário (email, telefone, status assinatura, status WA).
  - Bloco "Dados do Negócio" (empresa, segmento, resumo) — editável manualmente, preenchido automaticamente pela entrevista.
  - Edição inline de título, prioridade, valor estimado, data prevista, tags, descrição.
  - Mudança de etapa via select.
  - Atalhos: abrir conversa de suporte, ver perfil do usuário, simular suporte.
- **Timeline de atividades** (`AdminDealActivityTimeline`) — lê `admin_crm_activities`.
- **Tarefas do deal** (`AdminDealTasksSection`) — CRUD em `admin_crm_deal_tasks`, com lembretes opcionais.
- **Filtros avançados + estatísticas** — expandir `AdminCRMFilters` (busca, prioridade, tags, faixa de valor, status onboarding/assinatura/WA) e adicionar `AdminCRMStats` (cards por etapa, total, conversão).
- Hooks novos: `useAdminCRMActivities`, `useAdminCRMDealTasks`. Atualizar `useAdminCRMDeals` para incluir os novos campos de negócio.

### 1.3 Logging automático
Trigger em `admin_crm_deals` que registra em `admin_crm_activities` mudanças de etapa, marcação won/lost, e atualização dos dados do negócio.

---

## Parte 2 — Captura de dados ao finalizar a entrevista IA

### 2.1 Fluxo
A função `interview-ai-agent` já marca `entrevistas_config.status = 'completed'` e gera `generated_prompt`. Vamos:

1. Após `status = completed`, gerar (mesma chamada Gemini ou função leve dedicada) um **resumo estruturado** do negócio — JSON com:
   ```json
   { "business_name": "...", "segment": "...", "summary": "..." }
   ```
2. Localizar o deal de suporte do usuário em `admin_crm_deals` via `user_ref_id = entrevista.user_id`.
3. Atualizar `business_name`, `business_segment`, `business_summary`, `business_data_updated_at`.
4. Registrar atividade `"Dados do negócio atualizados via entrevista"` em `admin_crm_activities`.

### 2.2 Implementação
- Estender `interview-ai-agent/index.ts`: ao finalizar, fazer segunda chamada Gemini com tool `registrar_negocio` (function calling) extraindo os 3 campos a partir de `companyName`, `segment` e `messages`.
- Usar service role para fazer o `update` em `admin_crm_deals` (bypassa RLS).
- Idempotente: se já houver dados e o usuário refizer entrevista, sobrescreve.

---

## Parte 3 — Follow-up de suporte personalizado (híbrido)

### 3.1 Mudanças em `system-followup-generate-sequence`
- Antes de chamar Gemini, buscar o deal de suporte do `phone` (via `profiles.phone → admin_crm_deals.user_ref_id`) e ler `business_name`, `business_segment`, `business_summary`.
- Se houver dados → injetar bloco no prompt:
  ```
  NEGÓCIO DO CLIENTE:
  - Empresa: {business_name}
  - Segmento: {business_segment}
  - Resumo: {business_summary}

  PERSONALIZAÇÃO OBRIGATÓRIA:
  - Cite o nicho/empresa em pelo menos 4 das 12 mensagens.
  - Use dores REAIS do segmento (ex.: clínica de estética → no-show, agenda lotada; loja → recuperação de carrinho).
  - Conecte cada hook narrativo (dor, prova social, escassez) ao contexto do negócio.
  ```
- Se NÃO houver dados → usa o prompt genérico atual (fallback).

### 3.2 Logging
Marcar em `system_followup_tracking.engagement_data` se a sequência foi gerada como `personalized` ou `generic` para análise futura.

---

## Detalhes técnicos

### Arquivos novos
- `src/components/admin/AdminDealDetailsDrawer.tsx`
- `src/components/admin/AdminDealActivityTimeline.tsx`
- `src/components/admin/AdminDealTasksSection.tsx`
- `src/components/admin/AdminCRMStats.tsx`
- `src/hooks/useAdminCRMActivities.ts`
- `src/hooks/useAdminCRMDealTasks.ts`

### Arquivos editados
- `src/components/admin/AdminDealDialog.tsx` → substituído/integrado ao novo drawer (ou mantido só para "novo deal").
- `src/components/admin/AdminKanbanBoard.tsx` → abrir drawer ao clicar no card.
- `src/components/admin/AdminCRMFilters.tsx` → mais filtros.
- `src/hooks/useAdminCRMDeals.ts` → novos campos.
- `src/pages/admin/AdminCRM.tsx` → wire up Stats + drawer.
- `supabase/functions/interview-ai-agent/index.ts` → extração de dados do negócio + update no deal.
- `supabase/functions/system-followup-generate-sequence/index.ts` → prompt híbrido.

### Migrations
1. Tabela `admin_crm_activities` + RLS super_admin + índice por `deal_id`.
2. Tabela `admin_crm_deal_tasks` + RLS super_admin + índices.
3. `ALTER TABLE admin_crm_deals` adicionando campos de negócio.
4. Trigger de auto-log de mudanças de etapa em `admin_crm_deals`.

---

## Ordem de execução
1. Migrations (tabelas + campos).
2. Hooks e componentes novos do CRM admin.
3. Drawer + Stats + Filtros expandidos.
4. Atualizar `interview-ai-agent` para extrair e gravar dados do negócio.
5. Atualizar `system-followup-generate-sequence` para usar o contexto.
6. Testes manuais: finalizar entrevista de teste → checar dados no deal → disparar follow-up e verificar mensagens personalizadas.