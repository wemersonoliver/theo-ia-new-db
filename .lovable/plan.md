## Objetivo

Fazer com que TODOS os usuários do plano Igreen usem o mesmo conjunto de configurações da Conexão Green, sem cada conta ter cópia própria. Hoje cada conta Igreen tem prompt, produtos e base de conhecimento próprios, o que faz a IA responder diferente de revendedor para revendedor.

## Como vai funcionar (do ponto de vista do usuário)

- Você (admin) edita o conteúdo Igreen em **um único lugar** no painel `/admin/igreen-template`:
  - Prompt da IA (instruções de atendimento)
  - Lista de Produtos Igreen (Conexão Green, Telecom, Expansão — nome, descrição, vídeo)
  - Cenários do Conexão Green (CENARIO1/2/3 com mensagens diárias)
  - Base de conhecimento Igreen (PDFs / textos)
  - Tabela de regras por distribuidora (já é global hoje — fica como está)
- Toda conta marcada como **Igreen** passa a ler dessas tabelas globais automaticamente — o que o usuário tiver salvo no próprio "Ajustar Atendimento", "Produtos" ou "Base de Conhecimento" é **ignorado** enquanto a conta for Igreen.
- A Thays (e qualquer novo Igreen) passa a usar o mesmo conteúdo do dia para o dia, sem precisar recopiar nada.

## Mudanças técnicas

### Banco de dados
- `igreen_default_ai_config` (já existe) — continua sendo o prompt global Igreen.
- `igreen_products` (já existe, sem `account_id`) — vira a lista oficial dos 3 produtos Igreen. Adicionar colunas `video_url`, `followup_after_video_seconds`, `followup_after_video_message`.
- Nova tabela `igreen_global_scenarios` + `igreen_global_scenario_days/messages/items` — espelho de `igreen_scenarios` sem `account_id` (cenários CENARIO1/2/3 globais).
- `knowledge_base_documents` — adicionar coluna `is_igreen_global boolean default false`. Documentos marcados aparecem para todas as contas Igreen.
- RLS: super_admin pode editar tudo isso; contas Igreen têm leitura.

### Edge function `whatsapp-ai-agent`
Quando `accounts.is_igreen = true`:
- Carrega prompt de `igreen_default_ai_config` (em vez de `whatsapp_ai_config.custom_prompt`).
- Carrega produtos de `igreen_products` (em vez de `igreen_account_products`).
- Carrega base de conhecimento com `is_igreen_global = true` (em vez de filtrar por `account_id`).
- Mantém `igreen_distributor_discounts` (já global).

### Edge function `igreen-scenario-dispatcher` / `igreen-scenario-enroll`
- Para contas Igreen, dispara a partir de `igreen_global_scenarios` em vez de `igreen_scenarios`.

### Painel admin `/admin/igreen-template`
Nova tela com abas:
- **Prompt** — editor de `igreen_default_ai_config.custom_prompt`, `business_description`, `business_niche`, `agent_name`.
- **Produtos** — CRUD em `igreen_products` (mesmo editor já usado em `IgreenProductsTab`).
- **Cenários** — editor dos cenários globais (reaproveita `IgreenScenariosTab`).
- **Base de Conhecimento** — upload/lista de docs com `is_igreen_global = true`.
- **Regras por Distribuidora** — CRUD de `igreen_distributor_discounts` (já tem tela? se não, criar simples).

### UI nas contas Igreen
- Em "Ajustar Atendimento", "Produtos Igreen", "Cenários" e "Base de Conhecimento": exibir um aviso bloqueando edição — "Sua conta usa o conteúdo oficial Igreen. Para alterações, fale com o suporte."

## Migração da Thays
A migração que fizemos ontem (cópia do template para a conta dela) deixa de ser necessária — basta a conta estar `is_igreen=true` que o agente passa a ler do global automaticamente.

## Ordem de entrega
1. Migração de banco (colunas novas + tabelas globais de cenário + RLS).
2. Refator do `whatsapp-ai-agent` para ler do global quando `is_igreen`.
3. Refator do dispatcher de cenários Igreen.
4. Painel admin `/admin/igreen-template` (5 abas).
5. Bloquear edição nas telas do usuário Igreen.
6. Migrar dados atuais do template/Thays para as tabelas globais (popular `igreen_products` com vídeo e cenários globais a partir do que existe hoje).

Quer que eu siga nessa ordem?