## Problema

O **Simulador de Atendimento** (`/simulate-attendance`) chama a edge function `test-ai-prompt`, que é o caminho **V1 antigo** (um único Gemini com `_igreen_flow.ts`).

O **WhatsApp real** das contas iGreen (ex.: `marcioevandrocosta@hotmail.com`) roda em `whatsapp-igreen-agent-v2`, com supervisor + specialists (green, telecom, expansao, qualifier, failsafe) + tools + RAG + state engine.

Resultado: o simulador responde de forma diferente do WhatsApp real, e ajustes feitos no fluxo V2 (specialists, qualifier, sticky-specialist, distributor discounts, etc.) **nunca aparecem** no simulador.

## Objetivo

Quando a conta logada for iGreen (`accounts.is_igreen = true`), o simulador deve executar **o mesmo pipeline V2** que roda em produção, em modo sandbox:
- Sem enviar mensagem real pelo Evolution
- Sem persistir state/memory/conversas no banco
- Mantendo todos os outros componentes (supervisor, specialist routing, tools, RAG, guardrails)

Contas não-iGreen continuam usando o V1 (`test-ai-prompt`) sem alteração.

## Implementação

### 1. Nova edge function `test-igreen-prompt-v2`

Cria `supabase/functions/test-igreen-prompt-v2/index.ts` que:

- Autentica o usuário via JWT (mesmo padrão do `test-ai-prompt`).
- Resolve `accountId` e bloqueia se a conta não for iGreen (retorna 400 com mensagem clara).
- Monta um **contexto sandbox** equivalente ao que `whatsapp-igreen-agent-v2` recebe via webhook:
  - `phone` fake estável por sessão (ex.: `sim-<userId>`)
  - `messages` histórico vindo do front
  - `userMessage` atual
  - `attachments` (imagem/áudio/PDF) — reaproveita o tratamento já existente
  - Flag `sandbox: true`
- Reutiliza os módulos de `_igreen_v2/` **sem duplicar lógica**:
  - `supervisor` → classifica intent + specialist
  - `specialist-router` → escolhe specialist (green/telecom/expansao/qualifier/failsafe)
  - `agents/<specialist>` → gera resposta
  - `tool-router` → executa tools em modo sandbox (ver item 2)
  - `rag` → busca documentos da conta
  - `memory` → usa memória **em RAM** apenas (sem gravar)
- Retorna `{ message, debug: { specialist, intent, confidence, tools_called } }` para o front exibir.

### 2. Modo sandbox nas tools

Adapta `_igreen_v2/tool-router/registry.ts` (e tools dependentes) para aceitar um flag `sandbox` no contexto:

- `send_product_video` → não chama Evolution; retorna `{ ok: true, mocked: true }`
- `add_contact_tag`, `save_green_lead_field` → não escrevem no CRM/DB; só logam
- `get_distributor_discount`, `validate_green_invoice`, `validate_green_identity` → **executam normalmente** (são leitura/computação, ajudam no teste real)
- `request_human_handoff` → não dispara notificação; só marca no debug

Nenhuma tool deve persistir nada quando `sandbox = true`.

### 3. Supervisor/specialists sem persistência

Garante que, em modo sandbox:
- `state-engine` lê estado opcional vindo do front (`messages`), mas **não grava** em `whatsapp_ai_sessions` nem em `igreen_lead_state`.
- `memory` usa store em memória do request.
- `analytics`/`observability` continuam logando (útil para debug), mas sem efeitos colaterais no funil real.

### 4. Frontend — `PromptTestTab.tsx`

Em `src/components/ai/PromptTestTab.tsx`:

- Adiciona hook `useAccount()` (já existe) para ler `is_igreen` da conta atual.
- Em `handleTestSend`:
  - Se `is_igreen` → chama `/functions/v1/test-igreen-prompt-v2`
  - Senão → mantém `/functions/v1/test-ai-prompt`
- Adiciona um badge no header do painel "Simulador de Atendimento" indicando o pipeline ativo:
  - Conta iGreen → `Pipeline: V2 (supervisor + specialists)`
  - Outras → `Pipeline: V1`
- (Opcional) Mostra collapsible com `debug.specialist`, `debug.intent`, `debug.tools_called` abaixo de cada resposta para facilitar o ajuste.

### 5. `supabase/config.toml`

Adiciona:

```toml
[functions.test-igreen-prompt-v2]
verify_jwt = false
```

(autenticação é validada em código, mesmo padrão das outras functions iGreen)

### 6. Validação

- Logar como `marcioevandrocosta@hotmail.com` (conta iGreen) → simulador deve:
  - Para "oi" → cair em `qualifier` e mostrar menu 1/2/3
  - Para "quero saber mais sobre energia por assinatura" → cair em specialist `green`, pedir nome/UF/distribuidora, usar `get_distributor_discount`
  - Para "quero ser licenciado" → cair em `expansao`
  - Para "quero falar com humano" → cair em `failsafe` com `handoff_request`
- Conferir nos logs do `test-igreen-prompt-v2` que **nenhuma** gravação foi feita em `whatsapp_conversations`, `whatsapp_ai_sessions`, `igreen_lead_state`, `crm_deals`.
- Conferir conta não-iGreen → simulador continua chamando `test-ai-prompt` (V1) sem regressão.

## Detalhes técnicos

- Não modificar `whatsapp-igreen-agent-v2` em si — apenas extrair/reusar os módulos de `_igreen_v2/`. Se algum módulo hoje grava no DB diretamente sem aceitar flag de sandbox, criar um pequeno adapter no `test-igreen-prompt-v2` (ex.: passar um `mockClient` que não escreve), em vez de mexer em produção.
- Reaproveitar exatamente o mesmo `SUPERVISOR_SYSTEM_PROMPT` e os system prompts dos specialists — qualquer ajuste futuro feito nos specialists passa a refletir automaticamente no simulador.
- Manter o suporte a anexos (imagem/áudio/PDF) já existente no V1, encaminhando para os mesmos handlers que o webhook usa.

## Fora do escopo

- Não toca em `whatsapp-igreen-agent-v2` em produção.
- Não altera o `prompt-generator-ai` nem a aba "Ajustar Atendimento" (continua editando o `custom_prompt` da conta — V2 já lê esse prompt).
- Não cria UI nova além do badge e do collapsible de debug; a tela `/simulate-attendance` permanece igual visualmente.