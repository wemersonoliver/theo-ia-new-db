## Objetivo
Criar um botão no painel admin que define qual IA é usada por padrão em todo o sistema (Gemini ou OpenAI). A outra provedora vira fallback automático em caso de falha.

## 1. Banco de dados (nova migration)
Criar tabela única `system_ai_provider` com:
- `primary_provider` (texto: `gemini` ou `openai`) — default `gemini`
- `updated_at`, `updated_by`

RLS:
- Leitura: qualquer usuário autenticado (necessário para edge functions e UI admin).
- Escrita: somente `super_admin` (via `has_role`).
- `service_role`: acesso total.

Inserir 1 linha inicial com `primary_provider = 'gemini'`.

## 2. Helper compartilhado nas Edge Functions
Novo arquivo `supabase/functions/_shared/ai-provider/primary.ts` com:
- `getPrimaryProvider()` — lê a linha de `system_ai_provider` usando service role, com cache em memória (TTL 30s) para evitar query por mensagem.
- Retorna `'gemini' | 'openai'`.

## 3. Inversão de fallback nas chamadas existentes
Hoje todas as edge functions chamam Gemini direto e usam `_shared/ai-fallback/*` (OpenAI) quando Gemini falha.

Alteração mínima nos 8 callers já mapeados:
- `whatsapp-ai-agent`
- `interview-ai-agent`
- `process-image-ocr`
- `support-ai-agent`
- `igreen-document-validator`
- `system-followup-ai`
- `followup-ai`
- `_igreen_v2/supervisor/decide.ts`, `_igreen_v2/memory/summarizer.ts`, `_igreen_v2/agents/green/run.ts`

Padrão aplicado em cada um:
1. No início da função, ler `provider = await getPrimaryProvider()`.
2. Se `provider === 'gemini'`: fluxo atual (Gemini → fallback OpenAI). Sem mudança de comportamento.
3. Se `provider === 'openai'`: chamar OpenAI primeiro (via os helpers já existentes em `_shared/ai-fallback`); se OpenAI falhar/sem créditos/timeout, executar o caminho atual do Gemini como fallback.

Para isso, encapsular a chamada do Gemini de cada função em uma pequena função local `callGemini()` e a do OpenAI em `callOpenAI()`, e usar:
```ts
const order = provider === 'openai' ? [callOpenAI, callGemini] : [callGemini, callOpenAI];
```

Nenhum prompt, schema ou modelo é alterado — apenas a ordem de tentativa.

## 4. UI Admin (frontend)
Novo card "Provedor de IA padrão" em `src/pages/admin/AdminAIConfig.tsx` (ou um arquivo novo `AdminAIProvider.tsx` linkado no `AdminSidebar`):
- Switch / par de botões grandes: **Gemini (Google)** | **OpenAI (GPT)**.
- Indicador do atual ativo + texto "O outro será usado como fallback automático em caso de falha".
- Botão **Salvar** (otimista, com toast).
- Hook novo `useSystemAIProvider` (TanStack Query) com `get` + `mutate`.
- Restrito ao role `super_admin` (padrão admin já em vigor nas demais páginas).

## 5. Validação
- Após salvar, próximas mensagens recebidas devem usar o novo provedor primeiro (cache 30s).
- Testar que ao forçar erro em uma das pontas (ex.: chave inválida), o fallback assume corretamente.

## Resumo do que muda
- 1 migration nova
- 1 helper compartilhado nas edge functions
- 8–10 edge functions ajustadas para respeitar a ordem
- 1 tela/card admin + 1 hook
