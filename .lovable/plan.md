

## Sistema multi-usuários com equipes e permissões

Hoje cada cliente do Theo IA é uma "ilha" — só uma pessoa por conta. A solução é introduzir o conceito de **conta (account)** com um **dono** e vários **membros** (vendedores e atendentes), onde cada membro só enxerga conversas, deals e contatos atribuídos a ele, e o dono define o que cada um pode acessar.

---

### Conceitos novos

- **Account**: a "empresa" do cliente. Quem se cadastra hoje vira automaticamente dono de uma account própria.
- **Account members**: usuários convidados (vendedor/atendente) ligados à account do dono.
- **Papéis fixos** dentro da account:
  - **Owner** (dono): tudo, inclusive convidar/remover pessoas e gerenciar assinatura.
  - **Manager** (gerente): tudo operacional, sem mexer em assinatura/equipe.
  - **Seller** (vendedor): CRM, contatos e conversas atribuídas a ele.
  - **Agent** (atendente): conversas e agendamentos atribuídos a ele.
- **Override por usuário**: o owner pode marcar/desmarcar permissões avulsas em cima do papel base (ex: dar acesso à Base de Conhecimento para um vendedor específico).

---

### O que será feito

**1. Banco de dados**
- Nova tabela `accounts` (id, owner_user_id, name, created_at).
- Nova tabela `account_members` (account_id, user_id, role, permissions jsonb, invited_at, status).
- Nova coluna `account_id` em todas as tabelas de dados: `whatsapp_conversations`, `whatsapp_ai_config`, `whatsapp_instances`, `contacts`, `crm_deals`, `crm_pipelines`, `crm_stages`, `crm_activities`, `crm_deal_products`, `appointments`, `appointment_types`, `appointment_slots`, `knowledge_base_documents`, `notification_contacts`, `products`, `support_tickets`, `followup_config`, `followup_tracking`, `whatsapp_ai_sessions`, `whatsapp_pending_responses`, `subscriptions`, `platform_settings`.
- Nova coluna `assigned_to` (user_id) em: `whatsapp_conversations`, `crm_deals`, `appointments`, `contacts` — para distribuição.
- Migração: para cada usuário existente, cria uma account com ele como owner e copia o `user_id` de todas as tabelas para o `account_id` correspondente.

**2. Funções e RLS**
- `current_account_id()`: retorna a account do usuário logado (sua própria se for owner, senão a account onde é membro).
- `has_account_permission(_perm text)`: combina papel + override.
- `is_account_member(_account uuid)`: usado nas policies.
- Todas as policies das tabelas listadas passam de `auth.uid() = user_id` para `is_account_member(account_id) AND has_account_permission('xxx')` + filtro por `assigned_to = auth.uid()` quando o papel é Seller/Agent.

**3. Edge functions**
- `team-invite`: owner cria membro (cria conta auth + profile + linha em `account_members`); envia senha provisória por e-mail/WhatsApp.
- `team-update`: alterar papel, permissões avulsas, ativar/desativar membro.
- `team-remove`: remover membro (mantém histórico, apenas marca status `removed`).
- Edge functions existentes (`whatsapp-webhook`, `whatsapp-ai-agent`, `manage-appointment`, etc.) ganham resolução de `account_id` a partir do `user_id` recebido — sem mudança de comportamento para o cliente final.

**4. Frontend — área do dono**
- Nova página **`/team`** (Configurações → aba "Equipe"): lista de membros com papel, status, último acesso, botão "Convidar membro" e modal de edição (papel + checkboxes de permissões avulsas).
- Item "Equipe" no Sidebar visível só para owner/manager.

**5. Frontend — experiência do membro**
- `Sidebar` filtra itens conforme permissões: Atendente vê só Conversas + Agendamentos; Vendedor vê CRM + Contatos + Conversas; Manager vê quase tudo; Owner vê tudo.
- Listas (Conversas, CRM, Contatos, Agendamentos) recebem filtro automático via RLS — Seller/Agent só veem registros com `assigned_to = ele`.
- Em cada conversa/deal/contato/appointment, o owner/manager vê um campo "Responsável" (select com membros) para reatribuir. Botão "Atribuir a mim" disponível para qualquer membro com permissão.

**6. Limites por plano (regra de negócio)**
- Plano Mensal: até 3 membros + owner.
- Plano Anual: até 10 membros + owner.
- Trial: até 2 membros para testar.
- Limite validado na edge function `team-invite`.

---

### Detalhes técnicos

- **Fluxo de cadastro existente** continua igual: novo usuário registrado vira owner de uma account criada automaticamente via trigger `handle_new_user`.
- **Tabela de permissões**: o JSON `permissions` em `account_members` guarda apenas overrides, ex: `{"knowledge_base": true, "billing": false}`. O resto vem do papel base via função `has_account_permission`.
- **Permissões disponíveis** (chaves usadas pelas RLS e Sidebar):
  - `conversations`, `crm`, `contacts`, `appointments`, `appointment_settings`, `knowledge_base`, `ai_config`, `whatsapp_instance`, `team_management`, `billing`, `settings`, `support`, `view_all_assigned` (vê tudo da conta, ignora filtro de `assigned_to`).
- **Defaults por papel**:

```text
Owner    → todas = true
Manager  → todas exceto billing/team_management = true ; view_all_assigned = true
Seller   → conversations, crm, contacts, appointments = true ; view_all_assigned = false
Agent    → conversations, appointments = true ; view_all_assigned = false
```

- **Subscription compartilhada**: a assinatura passa a ser por `account_id`. O `ProtectedRoute` vai checar a subscription da account do usuário (própria se owner, do owner se membro), não mais a sua própria.
- **Trial**: o trial de 15 dias é da account (data de criação da account), não do membro convidado.
- **Convite**: edge function cria o usuário no Supabase Auth com senha provisória aleatória + envia mensagem via system WhatsApp para o telefone do membro com instruções e link de troca de senha.
- **Webhook do WhatsApp**: continua chegando pelo `user_id` do owner (instância pertence à account); o roteamento para "responsável" da conversa é definido por regra simples — primeira mensagem fica sem `assigned_to`, owner/manager pode atribuir manualmente, ou o atendente que responder primeiro vira o responsável (regra opcional configurável).
- **Compatibilidade**: enquanto a migração roda, a coluna `user_id` antiga continua existindo nas tabelas para não quebrar código não migrado; é descontinuada depois que todo o código frontend passa a usar `account_id`.
- **Sem quebra para clientes atuais**: cada conta vira owner único da sua própria account, comportamento idêntico ao de hoje até que ele convide alguém.

---

### Resultado final

O dono da conta entra em **Configurações → Equipe**, convida vendedores e atendentes informando nome, telefone e papel, e cada convidado recebe acesso ao painel com Sidebar reduzido às áreas permitidas. Conversas, deals e agendamentos são distribuídos por responsável, garantindo que vendedor não veja lead do colega e atendente não veja chat do outro. O owner pode reatribuir, ajustar permissões individuais e remover membros a qualquer momento.

