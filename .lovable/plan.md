## Múltiplas instâncias de WhatsApp por negócio (até 3 no plano Pro)

Permitir que cada negócio (account) conecte até 3 números de WhatsApp como "departamentos". Plano **Basic = 1 instância**, **Plano Pro = 3 instâncias**. Cada instância pode ter IA, follow-up e configurações próprias, e a IA pode transferir o atendimento entre departamentos com mensagem automática de transição.

---

### 1. Banco de dados (migration)

**`whatsapp_instances`** — passa a suportar múltiplas linhas por account:
- Adicionar `display_name text` (ex.: "Vendas", "Suporte"), `department_slug text` (sanitizado para uso no nome técnico) e `is_primary boolean default false`.
- Adicionar `transfer_message text` e `ai_enabled boolean default true`, `followup_enabled boolean default true` (configs por departamento).
- **Remover** unique `(user_id)` e criar unique `(account_id, instance_name)` e unique `(account_id, department_slug)`.
- Backfill: marcar a instância existente de cada account como `is_primary = true`, `display_name='Principal'`, `department_slug='principal'`. **Não renomear `instance_name` legado** para preservar conexões ativas.

**Função helper `account_plan_tier(_account_id)`** retornando `'basic' | 'pro' | 'trial'` (lê `subscriptions` ativa + `plans.tier`). Default `trial` quando não há assinatura.

**Trigger `enforce_instance_limit`** (BEFORE INSERT em `whatsapp_instances`): bloqueia criação acima de 1 (basic/trial) ou 3 (pro) por `account_id`. Mensagem amigável.

**`whatsapp_ai_config`, `followup_config`, `whatsapp_conversations`, `whatsapp_ai_sessions`, `whatsapp_pending_responses`**: adicionar coluna `instance_id uuid` (nullable, com backfill apontando à instância primária da account). Permite IA/follow-up independentes por departamento.

### 2. Padrão de nomenclatura das instâncias (Evolution API)

Formato técnico do `instance_name` para **novas** instâncias:

```
biz<business_code>_<department_slug>
ex.: biz1042_vendas, biz1042_suporte, biz1042_financeiro
```

- `business_code` vem de `accounts.business_code`.
- `department_slug` é gerado a partir do `display_name` informado pelo usuário: lowercase, sem acentos, somente `[a-z0-9]`, truncado em 20 chars (ex.: "Pós-Venda" → `posvenda`). Garante unicidade dentro do account com sufixo numérico se colidir.
- Instâncias **legadas** (`user_<code>` ou UUID) **permanecem com o nome atual** — apenas recebem `display_name='Principal'` e `department_slug='principal'`. Isso evita reconectar números já em produção.
- Se o owner desconectar e recriar a primária no futuro, a nova receberá o padrão `biz<code>_principal`.

### 3. Edge Functions

- **`create-whatsapp-instance`**: aceitar `{ departmentName, instanceId? }`. Resolver `account_id` + `business_code`, validar limite por plano, gerar `department_slug` e `instance_name = biz<code>_<slot>`. Inserir nova linha em vez de upsert por `user_id`. Validar duplicata de slug no account.
- **`disconnect-whatsapp-instance` / `refresh-whatsapp-qrcode`**: aceitar `instanceId` no body, operar sobre essa linha específica.
- **`whatsapp-webhook`**: já recebe `instance` da Evolution; usar para localizar a row exata em `whatsapp_instances` e gravar `instance_id` na conversa.
- **`send-whatsapp-message` / `send-whatsapp-media` / `followup-dispatch` / `send-appointment-reminders` / `send-welcome-sequence`**: derivar `instance_id` da conversa/contato para escolher a Evolution instance correta no envio.
- **`whatsapp-ai-agent`**: nova function-tool `transfer_to_department(department_slug, reason)` — atualiza conversa para o novo `instance_id`, dispara `transfer_message` da instância de destino, e ativa/desativa IA conforme `ai_enabled` do destino.

### 4. Frontend

- **`useWhatsAppInstances`** (lista por account) e wrapper `useWhatsAppInstance()` mantido para componentes legados (retorna a primária).
- **Hook `useAccountPlan()`**: retorna `tier` e `maxInstances` (`pro=3`, demais=1).
- **Página `/whatsapp` refatorada**:
  - Mostra até 3 cards de "departamento" (Slot 1, 2, 3).
  - Slot 1: sempre ativo (instância principal).
  - Slots 2 e 3 — **plano Pro**: botão "Adicionar departamento" abre modal pedindo nome; cria instância e mostra QR/pairing.
  - Slots 2 e 3 — **plano Basic/trial**: cards com `opacity-50`, ícone de cadeado, badge "Disponível no plano Pro" e CTA "Fazer upgrade" → `/subscriptions`.
  - Cada card conectado: nome editável do departamento, número, status, toggles (IA, follow-up), campo "Mensagem de transferência", ações (desconectar, atualizar QR).
- **Conversas**: badge mostrando o departamento da conversa; (filtro por departamento fica para iteração futura).
- **`TrialBanner` / `WhatsAppDisconnectedBanner`**: continuam baseados na instância primária.

### 5. Gating por plano

- Cliente: UI controla visibilidade/estado dos slots extras.
- Servidor: trigger no banco + validação na edge function impedem criação acima do limite (retorna 402 com mensagem clara).

---

### Detalhes técnicos

```text
account #1042 (Empresa X)
 ├─ biz1042_principal   ← legado preservado OU novo padrão (Basic e Pro)
 ├─ biz1042_vendas      ← Pro apenas
 └─ biz1042_suporte     ← Pro apenas
       cada uma com:
       ├─ display_name + department_slug
       ├─ ai_enabled, followup_enabled
       └─ transfer_message
```

```sql
-- Trigger de limite
CREATE OR REPLACE FUNCTION enforce_wa_instance_limit() RETURNS trigger AS $$
DECLARE max_n int; current_n int;
BEGIN
  SELECT CASE WHEN account_plan_tier(NEW.account_id)='pro' THEN 3 ELSE 1 END INTO max_n;
  SELECT count(*) INTO current_n FROM whatsapp_instances WHERE account_id = NEW.account_id;
  IF current_n >= max_n THEN
    RAISE EXCEPTION 'Limite de % instâncias atingido para este plano', max_n;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

Função-tool da IA:
```
transfer_to_department(department_slug, reason)
  → UPDATE whatsapp_conversations SET instance_id = X, ai_active = dest.ai_enabled
  → send-whatsapp-message via instance X com dest.transfer_message
```

### Fora do escopo desta entrega
- Filtro/seletor de departamento na página de Conversas (próxima iteração).
- Renomear instâncias legadas para o padrão novo.
- Multi-instância simultânea em reminders/welcome (usarão `instance_id` salvo na conversa, sem nova UI de seleção manual).
