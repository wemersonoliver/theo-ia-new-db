
# Igreen V2 — Plano final consolidado (arquitetura + 15 diretrizes operacionais)

Diretrizes #14 e #15 incorporadas ao contrato permanente. Nada na arquitetura muda — elas formalizam regras que o `state-engine` e as `automations/` já precisariam respeitar, e viram **checklist obrigatório de PR**.

SaaS genérico (`whatsapp-ai-agent`) permanece intocado. Tudo só roda para `accounts.is_igreen = true`.

---

## Contrato operacional permanente (15 diretrizes)

| # | Regra | Garantia em código |
|---|---|---|
| 1 | LLM não controla fluxo | `state-engine` + `transitions` + `tool-router` |
| 2 | Regras críticas em código, não em prompt | engines dedicadas (documentos, holder, thresholds, decay, timeout...) |
| 3 | Prompts pequenos e modulares | `core/system-prompt` + `supervisor/prompt` + `agents/<x>/prompt` |
| 4 | Toda tool idempotente | `tool-execution-guard` com lock `(account, phone, tool, key)` |
| 5 | Observabilidade obrigatória | `igreen_traces` + `igreen_state_events` com priority |
| 6 | Evitar overengineering | sem IA emocional, sem reranking, sem multi-provider ativo |
| 7 | Implementar por camadas | fases sequenciais; N só após N-1 estável |
| 8 | Fast Path prioritário | `fast-path/decide` antes do supervisor |
| 9 | State é fonte da verdade | `igreen_conversation_state` + snapshots; histórico LLM é auxílio |
| 10 | Failsafe obrigatório | `failsafe/handoff-fallback` + `neutral-reply` |
| 11 | RAG controlado | tags + top-K + `token-budget.trim` |
| 12 | Primeiro funcionar, depois sofisticar | fases 1–4 = core |
| 13 | SaaS é sagrado | roteamento por `is_igreen`; zero import cruzado |
| **14** | **Nenhuma tool altera estado diretamente** | tools retornam `{success, events, suggested_state_patch}`; **único writer = `state-engine/update.ts`** |
| **15** | **Toda automação idempotente** | toda automação valida estado + checa execução prévia + usa idempotency key |

---

## Diretriz #14 — Estado tem um único ponto de escrita

**Regra:** nenhuma tool, automação, worker, retry, edge function ou webhook pode escrever em `igreen_conversation_state`. Apenas `state-engine/update.ts`.

### Contrato de retorno de toda tool

```json
{
  "success": true,
  "events": [
    {"type": "invoice_validated", "priority": "high", "payload": {"holder": "..."}}
  ],
  "suggested_state_patch": {
    "fatura_valida": true,
    "etapa_funil": "fatura_validada"
  },
  "error": null
}
```

### Pipeline obrigatório

```text
tool.execute()
  → retorna {success, events, suggested_state_patch}
  → state-engine/update.applyPatch(suggested_state_patch)
        ├─ valida shape (Zod)
        ├─ valida transição contra transitions whitelist
        ├─ aplica guardrails (anti-loop, conflitos)
        ├─ registra trace + events (com priority)
        ├─ snapshots.maybeCreate(event)
        └─ persiste em igreen_conversation_state
  → retry seguro: aplicar o mesmo patch 2x é no-op
```

### Garantias técnicas

- `igreen_conversation_state` recebe `UPDATE` **somente** dentro de `state-engine/update.ts`. Convenção reforçada por:
  - lint rule / grep no CI: nenhum outro arquivo pode conter `from("igreen_conversation_state").update(` ou `.upsert(`.
  - revisão de PR (checklist).
- Patches inválidos (transição não permitida, campo desconhecido, conflito de versão) → descartados, evento `invalid_state_patch` (HIGH), state intocado.
- Automações que precisam refletir mudança de estado também passam pelo `state-engine/update.ts` — nunca `update` direto.

### Por quê

Em produção, com retries, webhooks duplicados, cron, edges paralelas e múltiplas tools, ter N pontos escrevendo em `state` gera corridas e inconsistência silenciosa. Um único writer + transitions whitelist + event sourcing = estado auditável e reconstruível.

---

## Diretriz #15 — Toda automação é idempotente

**Regra:** executar a mesma automação 2x (retry, webhook duplicado, race, reprocessamento) não pode produzir efeito colateral duplicado.

### Automações cobertas

- `handoff` (transferência para humano)
- `tagging` (aplicar tag de contato/CRM)
- `roleta` (atribuição)
- `follow-up` (mensagens agendadas)
- `notificações` (system whatsapp / push)
- `crm-stage-update` (mover deal)
- `scenario-enrollment` (matricular em cenário)
- `disparos automáticos` (vídeo, áudio, mídia)

### Padrão técnico — idempotency key + state check

Tabela auxiliar (já prevista): **`igreen_tool_locks`** estendida para automações via mesmo mecanismo, ou nova `igreen_automation_executions` se for mais limpo (decisão na Fase 1).

```ts
// automations/handoff.ts (exemplo de contrato)
export async function executeHandoff(ctx, reason) {
  const idempotencyKey = `handoff:${ctx.account_id}:${ctx.phone}:${reason}`;

  // 1. checa execução prévia
  if (await alreadyExecuted(idempotencyKey)) {
    return { skipped: true, reason: "already_executed" };
  }

  // 2. checa estado atual (não fazer handoff se já está em handoff)
  if (ctx.state.handoff_ativo) {
    return { skipped: true, reason: "state_already_handoff" };
  }

  // 3. lock + executa
  const lock = await acquireLock(idempotencyKey, ttl: "10min");
  if (!lock) return { skipped: true, reason: "lock_conflict" };

  try {
    await doHandoff(ctx);
    await recordExecution(idempotencyKey, { result: "ok" });
    return {
      success: true,
      events: [{ type: "handoff_executed", priority: "critical" }],
      suggested_state_patch: { handoff_ativo: true }
    };
  } finally {
    await releaseLock(lock);
  }
}
```

### Idempotency keys por automação

| Automação | Chave |
|---|---|
| handoff | `handoff:{account}:{phone}:{reason}` |
| tag | `tag:{account}:{phone}:{tag_slug}` |
| roleta | `roulette:{account}:{phone}:{round_id}` |
| follow-up | `followup:{tracking_id}:{step}` |
| notificação | `notify:{target_user}:{event_id}` |
| crm-stage | `crm_stage:{deal_id}:{stage_id}` |
| enrollment | `enroll:{account}:{phone}:{scenario_id}` |
| envio mídia | `media:{account}:{phone}:{media_id}` |

Todas validam:
1. Estado atual permite a ação?
2. Já executou antes? (`igreen_automation_executions`)
3. Lock disponível? (TTL definido por automação)
4. Resultado é gravado para próximas checagens

### Por quê

Webhooks duplicados, retries de cron, race entre edges e timeouts são certezas em produção. Sem idempotência: leads viram duas vezes na roleta, recebem o mesmo vídeo 2x, deal pula dois estágios, lista de tags incha. Com idempotência: o sistema sobrevive a qualquer reexecução.

---

## Checklist obrigatório de PR (todas as fases)

Toda PR Igreen V2 só passa se:

- [ ] D1 — fluxo decidido por engine, não por LLM
- [ ] D2 — regra crítica em código, não em prompt
- [ ] D3 — prompt pequeno e com responsabilidade única
- [ ] D4 — tool com `tool-execution-guard` + idempotente
- [ ] D5 — eventos/traces emitidos com priority/level
- [ ] D6 — sem abstração nova sem caso de uso real
- [ ] D7 — depende só de fases já estáveis
- [ ] D8 — fast-path considerado
- [ ] D9 — leitura/recovery via state, não via histórico
- [ ] D10 — failsafe coberto em erro/timeout
- [ ] D11 — RAG limitado por tag/budget
- [ ] D12 — não bloqueia o core para entregar sofisticação
- [ ] D13 — zero import/efeito no SaaS genérico
- [ ] **D14 — nenhum `update`/`upsert` em `igreen_conversation_state` fora de `state-engine/update.ts`**
- [ ] **D15 — automação tem idempotency key + state check + lock**

---

## Estrutura de pastas (ajuste de #14 e #15)

```text
supabase/functions/_igreen_v2/
├── state-engine/
│   ├── update.ts                # ÚNICO writer de igreen_conversation_state [D14]
│   ├── transitions.ts
│   ├── snapshots.ts
│   └── validators.ts            # Zod schemas dos state_patch
├── tool-router/
│   ├── registry.ts              # toda tool obrigatoriamente retorna ToolResult [D14]
│   └── types.ts                 # ToolResult = {success,events,suggested_state_patch,error}
├── automations/
│   ├── _idempotency.ts          # alreadyExecuted/recordExecution [D15]
│   ├── handoff.ts
│   ├── followup.ts
│   ├── tagging.ts
│   ├── crm-stage.ts
│   ├── notification.ts
│   ├── roulette.ts
│   ├── enrollment.ts
│   └── media-dispatch.ts
└── (demais módulos já descritos)
```

---

## Banco de dados (ajuste pequeno)

Adicionada na Fase 1: **`igreen_automation_executions`**
```text
id, account_id, phone, automation, idempotency_key UNIQUE,
result jsonb, executed_at, expires_at
```
- `UNIQUE(idempotency_key)` garante D15 no nível do banco.
- `pg_cron` limpa executions expirados (retenção: 30d).

`igreen_tool_locks` continua exclusivo para tools (D4).
`igreen_automation_executions` cobre histórico de automações (D15).

---

## Fluxo final (com #14 e #15)

```text
Mensagem → whatsapp-igreen-agent-v2
  ├─ load state                                    [D9]
  ├─ fast-path? → talvez bypass                    [D8]
  ├─ supervisor (se necessário)                    [D1]
  ├─ specialist → {messages, events, tool_calls}
  ├─ tool.execute() → {success, events, suggested_state_patch}   [D4, D14]
  ├─ state-engine.update(suggested_state_patch)    [D14]
  │     ├─ valida shape + transition + guardrails
  │     ├─ persiste em igreen_conversation_state   (ÚNICO writer)
  │     ├─ snapshots.maybeCreate
  │     └─ events com priority + trace
  ├─ automations.run(...) com idempotency key       [D15]
  │     ├─ alreadyExecuted? → skip
  │     ├─ state permite? → senão skip
  │     ├─ lock TTL → executa → record
  │     └─ retorna {events, suggested_state_patch} → volta ao state-engine
  ├─ humanization envia
  └─ trace.flush                                    [D5]
```

---

## Fases (inalteradas, com refinamentos)

| Fase | Entrega | Diretrizes-foco |
|---|---|---|
| **1. Fundação** | 9 tabelas (inclui `igreen_automation_executions`), pg_cron retenção, esqueleto `_igreen_v2`, edge roteada por `is_igreen`, `state-engine/update.ts` esqueleto como **único writer**, `automations/_idempotency.ts` | D5, D13, **D14, D15** |
| 2 | State + Supervisor + Fast Path + tool-router com `ToolResult` obrigatório | D1, D2, D4, D8, **D14** |
| 3 | Green agent + behavior engine + guardrails + failsafe | D3, D6, D10 |
| 4 | Document Validator + holder match + automations/handoff **idempotentes** + confidence thresholds | D2, D4, **D14, D15** |
| 5 | RAG contextual + fallback | D11 |
| 6 | Timeout + follow-ups **idempotentes** + snapshots estratégicos | D2, D9, **D15** |
| 7 | Lead Scoring + decay + trace debug + painel mínimo | D2, D5 |
| 8 | Telecom + Expansão + 2º vision provider opcional + cleanup | D13 |

---

## Riscos cobertos por #14 e #15

- Race entre 2 webhooks Evolution chegando ao mesmo tempo → D14 (state writer único) + D15 (automação idempotente)
- Retry de cron de follow-up → D15 não reenvia mensagem
- LLM "alucinando" tool → D14 patch é validado, transition rejeitada
- Reprocessamento manual de uma conversa → D14 + D15 garantem que nada duplica
- Tag aplicada 2x no contato → D15 via idempotency key
- Deal pulando estágio errado por concorrência → D14 (estado canônico) + D15 (crm-stage idempotente)

---

Aprove para iniciar **Fase 1 (Fundação)**:
- 9 migrations (`igreen_conversation_state`, `igreen_state_snapshots`, `igreen_state_events`, `igreen_traces`, `igreen_document_validations`, `igreen_timeouts`, `igreen_tool_locks`, `igreen_observability_config`, **`igreen_automation_executions`**)
- pg_cron de retenção (traces/events/locks/executions)
- Esqueleto `_igreen_v2/` com `state-engine/update.ts` como único writer e `automations/_idempotency.ts`
- Edge `whatsapp-igreen-agent-v2` com roteamento estrito por `accounts.is_igreen`
- Sem alteração no `whatsapp-ai-agent` genérico
