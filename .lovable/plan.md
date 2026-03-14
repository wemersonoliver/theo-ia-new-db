

# CRM Kanban para o Theo IA

## Visão Geral

Criar um CRM visual estilo Kanban integrado ao WhatsApp, contatos e agendamentos existentes. O diferencial será a **automação com IA** -- o agente IA pode mover deals automaticamente no funil com base nas conversas do WhatsApp.

## Funcionalidades Propostas

### 1. Kanban Board com Funis Personalizáveis
- Colunas padrão: **Novo Lead → Qualificado → Proposta → Negociação → Fechado/Ganho → Perdido**
- Drag-and-drop para mover cards entre colunas
- Usuário pode criar, renomear, reordenar e excluir colunas
- Cada card (deal) mostra: nome do contato, valor, tags, última interação, tempo no estágio

### 2. Deals (Negociações)
- Campos: título, valor estimado, contato vinculado, descrição, prazo previsto de fechamento, prioridade
- Histórico de atividades (log de movimentações, notas, mensagens)
- Vinculação direta com contatos existentes e conversas do WhatsApp

### 3. Integração com WhatsApp (Diferencial)
- Botão "Criar Deal" direto na tela de conversas
- Ao receber uma mensagem de um contato vinculado a um deal, exibir indicador no card
- IA pode sugerir movimentação de estágio baseado no conteúdo da conversa (ex: cliente disse "vou comprar" → sugerir mover para "Negociação")

### 4. Automações Inteligentes
- Mover deal automaticamente quando agendamento é criado (→ Qualificado)
- Alerta quando deal fica parado X dias no mesmo estágio
- Notificação de follow-up automática via WhatsApp

### 5. Dashboard do CRM
- Valor total do pipeline por estágio
- Taxa de conversão entre estágios
- Deals ganhos vs perdidos no mês
- Tempo médio de fechamento

### 6. Filtros e Busca
- Filtrar por tag, responsável, valor, data de criação
- Busca por nome do contato ou título do deal

## Estrutura de Banco de Dados

```text
crm_pipelines
├── id (uuid, PK)
├── user_id (uuid)
├── name (text) — ex: "Vendas", "Pós-venda"
├── created_at / updated_at

crm_stages
├── id (uuid, PK)
├── pipeline_id (uuid, FK → crm_pipelines)
├── user_id (uuid)
├── name (text) — ex: "Novo Lead"
├── position (integer) — ordem no kanban
├── color (text) — cor da coluna
├── created_at / updated_at

crm_deals
├── id (uuid, PK)
├── user_id (uuid)
├── stage_id (uuid, FK → crm_stages)
├── contact_id (uuid, FK → contacts, nullable)
├── title (text)
├── value_cents (integer, nullable)
├── priority (text) — low/medium/high
├── expected_close_date (date, nullable)
├── description (text, nullable)
├── tags (text[])
├── position (integer) — ordem dentro da coluna
├── won_at / lost_at (timestamp, nullable)
├── lost_reason (text, nullable)
├── created_at / updated_at

crm_activities
├── id (uuid, PK)
├── user_id (uuid)
├── deal_id (uuid, FK → crm_deals)
├── type (text) — note/stage_change/call/message/task
├── content (text)
├── metadata (jsonb)
├── created_at
```

RLS: todas as tabelas com política `auth.uid() = user_id`.

## Arquitetura Frontend

```text
src/
├── pages/
│   └── CRM.tsx                    — página principal com Kanban
├── components/crm/
│   ├── KanbanBoard.tsx            — board com drag-and-drop
│   ├── KanbanColumn.tsx           — coluna do kanban
│   ├── DealCard.tsx               — card de deal
│   ├── DealDialog.tsx             — modal de criação/edição
│   ├── DealDetailPanel.tsx        — painel lateral com detalhes + atividades
│   ├── PipelineSelector.tsx       — seletor de funil
│   ├── CRMStats.tsx               — mini-dashboard com métricas
│   └── ActivityTimeline.tsx       — timeline de atividades do deal
├── hooks/
│   ├── useCRMPipelines.ts
│   ├── useCRMStages.ts
│   ├── useCRMDeals.ts
│   └── useCRMActivities.ts
```

Biblioteca de drag-and-drop: **@dnd-kit/core** + **@dnd-kit/sortable** (leve, acessível, React-native).

## Plano de Implementação (Fases)

**Fase 1 — Base do Kanban**
- Criar tabelas + RLS + migration
- Hook `useCRMDeals`, `useCRMStages`, `useCRMPipelines`
- Página CRM com Kanban funcional (drag-and-drop, criar/editar/excluir deals)
- Rota `/crm` + item no sidebar

**Fase 2 — Detalhes e Atividades**
- Painel lateral de detalhes do deal
- Timeline de atividades com log automático de mudanças de estágio
- Vinculação com contatos existentes
- Notas e tarefas dentro do deal

**Fase 3 — Métricas e Integração WhatsApp**
- Mini-dashboard com valor do pipeline e conversões
- Botão "Criar Deal" na tela de conversas
- Indicador de mensagens recentes no card

**Fase 4 — Automações (Diferencial)**
- Alertas de deal parado
- Sugestão de movimentação pela IA baseada em conversas
- Follow-up automático via WhatsApp

Sugiro começar pela **Fase 1** para ter o Kanban funcional rapidamente. Posso prosseguir com a implementação?

