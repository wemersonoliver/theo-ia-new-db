

## Sistema de Tarefas nos Negócios

Vou adicionar um sistema completo de tarefas (to-dos) dentro de cada negócio do CRM, permitindo criar, marcar como concluído, definir prazos e responsáveis. Tarefas vencidas ou pendentes ficam visíveis no card do Kanban para você não esquecer de nenhum follow-up.

### O que você vai ter

**1. Aba "Tarefas" no painel do negócio**
Ao abrir um negócio (drawer lateral), aparece uma nova seção "Tarefas" com:
- Campo rápido para adicionar nova tarefa (título + data opcional)
- Lista de tarefas pendentes (no topo) e concluídas (em baixo, recolhidas)
- Cada tarefa mostra: checkbox, título, prazo, responsável, e botão de excluir
- Atalho para definir prazo: "Hoje", "Amanhã", "Próx. semana", ou data customizada
- Ao concluir, registra automaticamente uma atividade no timeline

**2. Indicador no card do Kanban**
- Pequeno badge no card mostrando: `📋 2/5` (tarefas concluídas / total)
- Se tem tarefa **vencida**, badge vira **vermelho** com ícone de alerta
- Se tem tarefa **para hoje**, badge fica **âmbar**

**3. Notificações visuais**
- Tarefas vencidas aparecem com texto vermelho e ícone de alerta no painel
- Tarefas para hoje destacadas em âmbar
- Ordenação automática: vencidas → hoje → futuras → sem prazo → concluídas

**4. Integração com timeline de atividades**
Cada ação (criar tarefa, concluir, reabrir) gera registro na timeline existente do negócio.

### Como será implementado (técnico)

**Banco de dados** — nova tabela `crm_deal_tasks`:
```text
id              uuid (pk)
deal_id         uuid (FK lógico para crm_deals)
user_id         uuid (criador)
account_id      uuid (multi-tenant)
assigned_to     uuid (responsável, opcional)
title           text
description     text (opcional)
due_date        timestamptz (opcional)
completed       boolean (default false)
completed_at    timestamptz
completed_by    uuid
created_at, updated_at
```
Com RLS no padrão do projeto: `is_account_member(account_id) AND has_account_permission(account_id, 'crm')` + fallback `auth.uid() = user_id`.

**Frontend**:
- Novo hook `useCRMDealTasks(dealId)` com TanStack Query (CRUD + optimistic updates)
- Novo componente `DealTasksSection.tsx` integrado ao `DealDetailsDrawer.tsx`
- Atualização do `DealCard.tsx` com badge contador de tarefas
- Estendido `useCRMDeals.ts` para fazer join leve e trazer `task_count` / `overdue_count` por deal (via segunda query agregada)

**Sem mudanças**: estrutura do Kanban, drag-and-drop, pipelines e estágios continuam idênticos.

### Fora do escopo (posso fazer depois se quiser)
- Notificação por WhatsApp quando tarefa vencer
- Página global "Minhas tarefas" agregando todos os negócios
- Tarefas recorrentes
- Subtarefas / checklists aninhados

