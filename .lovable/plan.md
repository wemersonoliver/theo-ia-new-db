## Objetivo

Validar se o contato tem um **nome real de pessoa** antes de iniciar uma cadência. Se tiver, salvar no contato e usar via variável `{{primeiro_nome}}` / `{{nome}}`. Se não tiver, a variável fica vazia e a mensagem é enviada sem o nome (sem deixar `{{primeiro_nome}}` cru no texto — isso já acontece hoje).

## Como funciona hoje

- `custom-followup-dispatcher` já tem `loadVariables()` → busca `contacts.name` e expõe `{{nome}}` e `{{primeiro_nome}}`.
- O nome do contato hoje vem do `pushName` cru do WhatsApp, que muitas vezes é `.`, emoji, frase de status, telefone, "Cliente", etc.
- Os geradores de cadência IA (`followup-generate-sequence`, `system-followup-generate-sequence`) já têm um `sanitizeContactName()` interno, mas isso **não persiste** no contato nem é usado pelos fluxos custom.

## O que vamos construir

### 1. Helper compartilhado `_person-name.ts` (Edge Functions)

Função única `extractPersonName(raw)` que retorna `{ firstName: string | null, fullName: string | null }` aplicando regras determinísticas:

- Remove emojis, símbolos, dígitos, pontuação isolada.
- Rejeita: vazio, ≤2 letras, só dígitos, blacklist (`cliente`, `user`, `whatsapp`, `theo`, `lead`, `teste`...), frases longas (>4 palavras), strings com URL/`@`.
- Aceita só se a primeira "palavra" tiver ≥3 letras alfabéticas (suporta acentos).
- Normaliza capitalização (`joão silva` → `João Silva`).

Opcional (config global on/off): fallback de validação com IA via Gemini só quando o regex aceita borderline (1 chamada barata, com cache no próprio contato para não repetir).

### 2. Persistência no contato

Adicionar 2 colunas em `public.contacts`:

- `person_name text` — nome validado (ex.: `João Silva`).
- `person_name_checked_at timestamptz` — para não revalidar toda hora.

Não sobrescreve `contacts.name` (que o usuário pode ter editado manualmente). A variável passa a priorizar `person_name`, com fallback para `name` só se ele também passar no validador.

### 3. Gate antes de iniciar cadência

Em `custom-followup-enroll` (e nas funções de followup IA):

1. Carrega `contacts` pelo telefone.
2. Se `person_name_checked_at` é nulo ou antigo (>7 dias), roda `extractPersonName` em cima de:
   - `contacts.name` (pushName salvo),
   - `whatsapp_conversations.contact_name`,
   - e (opcional) última mensagem do cliente onde ele se apresenta — apenas se IA estiver ligada.
3. Persiste resultado em `person_name` (string vazia se não passou).
4. Cadência segue normalmente em qualquer caso — o que muda é só o valor da variável.

### 4. Variáveis no dispatcher

Em `loadVariables()`:

```
nome             → person_name || ""
primeiro_nome    → primeira palavra de person_name || ""
nome_ou_vazio    → alias explícito (mesma coisa, só para deixar claro no editor)
```

E em `renderTemplate`, garantir que espaços duplicados/`,` órfão depois da substituição vazia sejam limpos (ex.: `"Oi {{primeiro_nome}}, tudo bem?"` com nome vazio vira `"Oi, tudo bem?"` — hoje vira `"Oi , tudo bem?"`). Aplicar mesma limpeza nos geradores IA antes de salvar a mensagem renderizada.

### 5. UI

- No editor de step do fluxo custom (`StepDialog.tsx`): adicionar chip/hint mostrando variáveis disponíveis (`{{primeiro_nome}}`, `{{nome}}`, `{{empresa}}`) com um botão "inserir".
- Pequeno aviso: "Se o contato não tiver nome reconhecível, a variável será omitida automaticamente."

### 6. Geradores IA de cadência

Em `followup-generate-sequence` e `system-followup-generate-sequence`: passar a usar `extractPersonName` (mesma fonte de verdade) em vez do `sanitizeContactName` local. Quando nome é nulo, instruir o prompt a usar `{{primeiro_nome}}` no template (em vez de hardcodar) — assim o dispatcher decide na hora do envio.

## Detalhes técnicos

- Migração: `ALTER TABLE contacts ADD COLUMN person_name text, ADD COLUMN person_name_checked_at timestamptz;` + índice parcial opcional.
- Novo arquivo: `supabase/functions/_person-name.ts` (importado por enroll, dispatcher, generate-sequence × 2).
- Sem mudança em RLS (campos seguem a policy existente da `contacts`).
- Custo IA: zero por padrão (validação só regex). Se ativar fallback Gemini, ~1 chamada por contato novo, cacheada.

## Fora de escopo

- Não vamos sobrescrever `contacts.name` (preserva edição manual do usuário).
- Não vamos validar nomes em massa retroativamente — só on-demand quando o contato entra numa cadência ou recebe mensagem nova.
