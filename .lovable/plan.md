## Objetivo
Tornar o envio de áudios de saudação (Conexão Green) **opcional por usuário**, com default DESLIGADO. Cada conta iGreen passa a ter seus próprios áudios (slot 1 e 2) e um toggle para ativar/desativar. Enquanto estiver desativado ou sem áudios, o agente volta ao comportamento antigo (5 bolhas de texto).

---

## 1. Banco de dados

Nova tabela por conta (substitui o uso da `igreen_default_greeting_audios` global como fonte em produção — a global vira apenas template inicial opcional):

`public.igreen_account_greeting_audios`
- `account_id uuid` (FK accounts)
- `slot int` (1 ou 2)
- `storage_path text` (caminho no bucket)
- `transcript text`
- `delay_after_ms int default 0` (slot 1=0, slot 2=10000)
- `enabled bool default true` (do slot individual)
- `updated_at timestamptz`
- PK composta `(account_id, slot)`

Nova coluna em `accounts`:
- `igreen_greeting_audio_enabled bool default false` — **toggle mestre** da feature por conta.

Grants/RLS:
- `authenticated`: SELECT/INSERT/UPDATE/DELETE apenas onde a conta for sua (membro/owner).
- `service_role`: ALL (edge functions).
- Super admin: ALL via `has_role`.

Bucket `igreen-audios` já existe → arquivos passam a ser organizados por `account_id/{slot}.{ext}`.

## 2. Edge function — `_igreen_v2/agents/green/run.ts` (bloco `greet`)

Ordem da decisão:
1. Lê `accounts.igreen_greeting_audio_enabled` da conta.
2. Se **false** → fallback imediato para as 5 bolhas de texto originais (comportamento antigo, default para todos).
3. Se **true** → busca `igreen_account_greeting_audios` da conta:
   - Se faltar slot 1 ou 2 (sem `storage_path`) → fallback texto.
   - Se ambos OK → emite os 2 events `greeting_audio_dispatch` como hoje, com `account_id` já no payload.

A automação `greeting-audio-dispatch.ts` passa a ler da tabela por conta (`igreen_account_greeting_audios` filtrando por `account_id`) em vez da global.

## 3. Painel do usuário (Settings)

Nova aba **"Áudios de Saudação (iGreen)"** em `src/pages/Settings.tsx`, visível só para contas iGreen (`accounts.is_igreen = true`):
- Toggle mestre "Ativar envio de áudios na saudação" (vinculado a `accounts.igreen_greeting_audio_enabled`).
- 2 cards (Saudação 1 / Saudação 2): player do áudio atual + botão "Substituir áudio" (mp3/ogg/m4a até 16 MB) + textarea de transcrição + toggle ativo/inativo do slot.
- Aviso visual: "Enquanto a função estiver desativada ou sem os 2 áudios configurados, a saudação volta para o formato em texto."
- Botão Salvar grava na `igreen_account_greeting_audios` e faz upload em `igreen-audios/{account_id}/{slot}.{ext}`.

Hook novo: `src/hooks/useIgreenAccountGreetingAudios.ts` (CRUD + upload via Supabase Storage).

## 4. Painel admin

Em `src/pages/admin/AdminIgreenTemplate.tsx` (aba "Áudios de Saudação"):
- A aba global vira **apenas template padrão** (referência), com aviso: "Estes áudios são exemplo. Cada conta configura os próprios em Configurações."
- Em `/admin/users`: nova coluna/toggle "Áudios Saudação iGreen" para super admin forçar ligar/desligar por conta (escreve em `accounts.igreen_greeting_audio_enabled`).

## 5. Migração de contas existentes

- A migration **não** ativa o toggle em nenhuma conta (`default false`).
- Não copia áudios da tabela global automaticamente — cada usuário sobe os seus quando quiser testar.
- Resultado: todas as contas iGreen voltam imediatamente para o comportamento antigo (5 bolhas) até o usuário ativar.

---

## Entregáveis
1. Migration: criar `igreen_account_greeting_audios` (com grants + RLS) + coluna `accounts.igreen_greeting_audio_enabled`.
2. Update no `_igreen_v2/agents/green/run.ts` (decisão no bloco `greet`).
3. Update na automação `greeting-audio-dispatch.ts` (lê tabela por conta).
4. Hook `useIgreenAccountGreetingAudios.ts` + nova aba em `Settings.tsx`.
5. Toggle admin em `AdminUsers.tsx` + aviso na aba do `AdminIgreenTemplate.tsx`.
