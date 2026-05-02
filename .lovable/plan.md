
## Objetivo

Mudar a centralização do sistema de "usuário" para "negócio" (account):
1. Capturar **Nome do Negócio** no cadastro e permitir editá-lo no Perfil.
2. Substituir o "ID de Usuário" (`profiles.user_code`) por um **ID do Negócio** (`accounts.business_code`) — único por conta, não por usuário. Assim, todos os membros (owner + equipe) de uma mesma empresa compartilham o mesmo ID exibido.

Hoje a tabela `accounts` já existe e cada owner tem 1 account. Vamos só adicionar `business_code` e `name` editável.

---

## 1. Banco de dados (migração)

Tabela `public.accounts`:
- Adicionar coluna `business_code integer UNIQUE` com sequência iniciando em **1000** (para não colidir visualmente com os `user_code` antigos que começam em 100).
- Backfill: gerar `business_code` para todas as accounts existentes.
- Tornar `NOT NULL` após backfill.

Atualizar trigger `handle_new_user_account` para usar o `business_name` enviado em `raw_user_meta_data` (campo novo `business_name`), com fallback para `full_name`/"Minha Empresa".

Não vamos remover `profiles.user_code` (ainda usado por edge functions tipo `create-whatsapp-instance` para nomear instâncias Evolution e por `repair-whatsapp-webhook`). Mantemos como identificador interno técnico; apenas a UI deixa de exibi-lo.

## 2. Cadastro (`src/pages/Register.tsx` + `src/lib/auth.tsx`)

- Novo campo **"Nome do negócio"** (obrigatório), posicionado logo após "Nome completo".
- `signUp(...)` passa a aceitar `businessName` e envia em `options.data.business_name`.
- Após o `signUp`, atualizar `accounts.name` para o `businessName` informado (a trigger cria a account com fallback; fazemos `update` explícito pelo `owner_user_id = user.id` para garantir).

## 3. Perfil (`src/pages/Settings.tsx` — aba Perfil)

- Substituir o bloco "Seu ID de Usuário" (#user_code) por **"ID do Negócio"** (#business_code) buscado de `accounts` via `useAccount()`.
- Adicionar campo editável **"Nome do negócio"** (apenas owner pode editar — usar `isOwner` do `useAccount`). Salva em `accounts.name`.
- Texto auxiliar: "Use este ID ao entrar em contato com o suporte".

## 4. Hook `useAccount.ts`

- Incluir `business_code` no select de `accounts` e expor em `AccountMembership`.

## 5. Painel Admin (`src/pages/AdminUsers.tsx` + `supabase/functions/admin-users`)

- Adicionar coluna **"ID Negócio"** (#business_code) ao lado ou substituindo o "#user_code" exibido hoje.
- Edge function `admin-users` retorna `business_code` e `business_name` (join com `accounts` pelo `owner_user_id`).
- Filtro de busca passa a aceitar busca pelo `business_code` também.

## 6. Onboarding / Suporte (referências ao ID)

- Em `mem://features/help-support-system` e fluxos onde a IA de suporte pede "código do usuário", trocar prompt para "código do negócio". (Atualizar `support-ai-agent` e `system-followup-*` se referenciarem `user_code` em mensagens — verificar antes de editar.)

## 7. Compatibilidade

- `create-whatsapp-instance` continua usando `user_code` para nomear instância Evolution (`user_<code>`). **Não muda** — é identificador técnico interno do owner, e renomear instâncias quebraria conexões existentes.
- Em uma fase futura (não neste plano) podemos avaliar renomear instâncias para `biz_<business_code>`.

---

## Detalhes técnicos

### SQL da migração
```sql
CREATE SEQUENCE IF NOT EXISTS accounts_business_code_seq START WITH 1000;
ALTER TABLE public.accounts
  ADD COLUMN business_code integer UNIQUE DEFAULT nextval('accounts_business_code_seq');
UPDATE public.accounts SET business_code = nextval('accounts_business_code_seq')
  WHERE business_code IS NULL;
ALTER TABLE public.accounts ALTER COLUMN business_code SET NOT NULL;
```

Trigger atualizada (substitui a existente `handle_new_user_account`) para ler `NEW.raw_user_meta_data->>'business_name'` antes de cair em `full_name`.

### Validação no Register
- `businessName.trim().length >= 2` obrigatório, senão toast e bloqueia submit.

### RLS de `accounts`
- Já permite owner atualizar (verificar policies existentes; se faltar UPDATE, adicionar policy `owner_user_id = auth.uid()`).

---

## Arquivos afetados

- **Nova migração SQL** (coluna + sequence + trigger atualizada + policy update se faltar)
- `src/pages/Register.tsx` — novo campo
- `src/lib/auth.tsx` — assinatura `signUp` + update da account
- `src/pages/Settings.tsx` — exibição do ID do negócio + edição do nome
- `src/hooks/useAccount.ts` — incluir `business_code`
- `src/pages/AdminUsers.tsx` — coluna ID Negócio + busca
- `supabase/functions/admin-users/index.ts` — retornar campos do negócio

## Fora do escopo

- Renomear instâncias Evolution já existentes.
- Migrar `profiles.user_code` (mantido como identificador técnico interno).
- Mudanças em landing/marketing.
