# Plano — Hardening Comportamental do Green (sem refactor)

## Objetivo

Criar uma camada de **testes conversacionais + auditoria comportamental** que rode contra o pipeline atual e detecte os bugs que os testes técnicos não pegam (repetição, loop, failsafe indevido, regressão de etapa, truncamento, formulário, perda de memória semântica).

**Não toca**: state-engine, transport, supervisor sticky, D13–D15, arquitetura, orchestrator. Apenas adiciona arquivos de testing + 1 tabela de auditoria + 1 trace adicional no supervisor.

---

## Escopo (arquivos novos)

```text
supabase/functions/_igreen_v2/testing/
  ├─ conversation-runner.ts     # simula turnos contra runGreen + decideSupervisor
  ├─ assertions.ts              # 10 asserts comportamentais
  ├─ scenarios/
  │    ├─ 01-greeting.ts
  │    ├─ 02-interest.ts
  │    ├─ 03-short-context.ts
  │    ├─ 04-no-repetition.ts
  │    ├─ 05-no-loop.ts
  │    ├─ 06-continuity.ts
  │    ├─ 07-anti-form.ts
  │    ├─ 08-anti-failsafe.ts
  │    ├─ 09-outbound-persisted.ts
  │    └─ 10-no-truncation.ts
  ├─ semantic-memory.ts         # detecta perguntas sobre dados já em extras
  └─ report.ts                  # gera /mnt/documents/igreen_behavioral_validation_report.md

supabase/functions/igreen-behavior-regression-runner/
  └─ index.ts                   # edge function que roda toda a suíte e devolve PASS/FAIL + relatório

supabase/migrations/<ts>_igreen_behavior_audits.sql
  └─ tabela igreen_behavior_audits
```

E **uma única alteração mínima** em `supabase/functions/_igreen_v2/supervisor/decide.ts`: após cada decisão, inserir 1 linha em `igreen_behavior_audits` (não muda lógica, só observabilidade).

---

## Componentes

### 1. ConversationRunner
- Executa em memória: `state` mock → `decideSupervisor` → `runGreen` → aplica `suggested_state_patch` → próximo turno.
- Mesma rota lógica que o handler real, **sem** chamar transport nem persistir em produção.
- Permite injetar `mockLLM` (respostas determinísticas) ou usar Gemini real via flag.
- Saída por turno: `{ stage, specialist, intent, confidence, source, messages, patch, events }`.

### 2. Assertions
10 funções puras sobre o array de turnos:
- `assertNoRepeatedQuestion` — normaliza pergunta (remove pontuação, lower, stems pt-BR) e compara via Jaccard >0.7.
- `assertNoLoop` — mesma `intent`/`stage` ≤2x seguidas.
- `assertNoUnexpectedFailsafe` — `source==="low_confidence"` só permitido se cenário marcar.
- `assertNoUnexpectedHandoff` — `handoff_ativo` só quando esperado.
- `assertSingleIntentPerTurn` — máx 1 "?" por mensagem, máx 1 pedido de dado.
- `assertValidStageTransition` — usa `ALLOWED_TRANSITIONS` + ordem greet→explain→qualify→invoice→…
- `assertNoFormBehavior` — regex de combos proibidos (nome+cpf, cidade+consumo+conta).
- `assertOutboundPersisted` — apenas no runner "live" (cenário 9), checa `whatsapp_conversations.messages` e `igreen_transport_events`.
- `assertResponseNotTruncated` — última mensagem termina em `.!?` e tem ≥20 chars.
- `assertConversationProgressing` — `etapa_funil` ou `extras` muda a cada N turnos.

### 3. Semantic Memory Validator
- Se `extras.client_name` existe → assertion falha se próxima mensagem da IA contém qualquer variação de "qual seu nome", "como posso te chamar", "nome completo".
- Idem para `cidade`, `consumo_medio`, `cpf`, `full_name`.

### 4. Tabela `igreen_behavior_audits`
```sql
correlation_id text, account_id uuid, phone text,
specialist_before text, specialist_after text,
intent text, confidence numeric,
decision_source text,        -- llm | timeout | low_confidence | low_confidence_sticky | error
trigger_reason text,         -- texto curto explicando o branch
conversation_snapshot jsonb, -- últimas 6 mensagens + etapa_funil + extras keys
created_at timestamptz default now()
```
RLS: super_admin select; service_role all. Insert apenas via service_role no `decide.ts`.

### 5. Mudança mínima no supervisor
Em `decide.ts`, em cada `return`, antes dele, chamar `auditDecision({...})` (best-effort, try/catch silencioso, igual aos `trace()` existentes). Zero impacto no fluxo.

### 6. Edge Function `igreen-behavior-regression-runner`
- POST sem body → roda os 10 cenários com mockLLM determinístico (rápido, sem custo).
- POST `{ mode: "live", account_id, phone }` → roda cenários 1, 2, 3, 9 contra Gemini real + persistência (para validar outbound).
- Resposta: `{ pass, fail, results: [...], report_path }`.
- Grava `/mnt/documents/igreen_behavioral_validation_report.md`.
- `verify_jwt = false` + checagem de super_admin via `getClaims`.

### 7. Relatório
Markdown com:
- Resumo PASS/FAIL por cenário.
- Para cada FAIL: turno, assertion violada, snippet da resposta, trace.
- Lista de perguntas repetidas, loops, handoffs indevidos, truncamentos.
- Score conversacional (PASS / total).

---

## O que NÃO faz parte
- Nenhuma alteração em `run.ts`, `stages.ts`, `prompt.ts` do green.
- Nenhuma alteração em `state-engine`, `transport`, `whatsapp-igreen-agent-v2/index.ts`.
- Nenhuma alteração na lógica do supervisor — apenas 1 insert observacional.
- Nenhum novo modelo, fase, orchestrator, Redis ou multi-agent.

---

## Validação após implementar
1. Rodar `igreen-behavior-regression-runner` em modo mock → todos os 10 cenários PASS.
2. Reproduzir TESTE 3 (looping semântico "Sim" → explica de novo) como cenário 5 → deve **falhar** intencionalmente, provando que a suíte detecta o bug real atual.
3. Rodar em modo live contra a conta da Thays → confirmar persistência outbound (cenário 9).
4. Conferir 1 linha por turno em `igreen_behavior_audits` durante uma conversa real.

---

## Entregáveis
- 1 migration (tabela + RLS + grants).
- ~13 arquivos novos em `_igreen_v2/testing/` + 1 edge function.
- Edit cirúrgico em `supervisor/decide.ts` (chamada `auditDecision`).
- Relatório md gerado sob demanda em `/mnt/documents/`.