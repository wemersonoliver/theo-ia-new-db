# Fase 3 — Green Specialist Minimalista + Behavior Engine + Guardrails + Failsafe

## Objetivo

Plugar o primeiro specialist real (Green) no pipeline da Fase 2, mantendo as 15 diretrizes + os 8 ajustes finais. Escopo deliberadamente pequeno: descoberta → vídeo → qualificação simples → solicitar fatura. Nada de objeção complexa, negociação ou recuperação avançada.

## Contratos novos

### `AgentResult` (saída obrigatória de todo specialist)
```ts
{
  messages: string[];           // chunks já preparados (sem typing/delay)
  events: IgreenEvent[];
  tool_calls: { name: string; args: unknown }[];
  suggested_state_patch: Partial<IgreenConversationState>;
}
```
Proibido `return string`. Mesmo um "olá" passa pelo contrato.

### Timeout budget (hard)
- supervisor: 8s (já existe)
- specialist: 15s
- behavior-engine: 2s
- tool individual: configurável (default 5s)
- total edge ≤ 25s

Excedeu → `failsafe` + evento `*_timeout` priority `high`.

## Estrutura nova

```text
_igreen_v2/
├── specialist-router/
│   └── resolve.ts            # state.specialist → AgentRunner (não chama o agent)
├── agents/
│   ├── _types.ts             # AgentContext, AgentResult, AgentRunner
│   ├── _run.ts               # wrapper: timeout 15s + trace + failsafe on throw
│   ├── green/
│   │   ├── run.ts            # specialist Green minimalista
│   │   ├── prompt.ts         # prompt curto e modular (D3)
│   │   └── stages.ts         # heurísticas determinísticas por etapa_funil
│   └── failsafe/
│       └── run.ts            # resposta neutra + handoff + evento critical
├── behavior-engine/
│   ├── prepare.ts            # chunking 220ch, dedup, ordering — NÃO envia
│   └── humanize.ts            # (stub) typing/delay calculados; transport usa depois
├── guardrails/
│   ├── validate.ts           # roda DEPOIS do specialist, ANTES do behavior
│   └── rules/
│       ├── max-length.ts
│       ├── max-chunks.ts
│       ├── semantic-repeat.ts        # hash simples de últimas N msgs
│       ├── tool-stage-compat.ts      # tool x etapa_funil
│       └── text-loop.ts              # já existia conceitualmente
└── transport/
    └── send.ts               # único ponto que fala com WhatsApp (stub Fase 3)
```

Tools novas (mínimas para Green):
- `send_discovery_video` — idempotency: `video:{produto}:{phone}` (não envia 2x)
- `request_invoice` — idempotency: `request_invoice:{phone}:{etapa}`
- `set_stage` — wrapper sobre transição de `etapa_funil`

## Pipeline final da edge

```text
load state
  → fast-path.decide          (bypass = retorna)
  → supervisor.decide         (8s, fallback failsafe)
  → state-engine.applyPatch   (specialist + intent)
  → specialist-router.resolve → AgentRunner
  → agents/_run               (15s hard timeout)
      └── green/run OU failsafe/run
          ↳ retorna AgentResult
  → para cada tool_call: tool-router.execute (D14 escreve estado)
  → guardrails.validate(messages, state, tool_calls)
      ↳ falha → degrada para failsafe ou trunca
  → state-engine.applyPatch(suggested_state_patch + events)
  → behavior-engine.prepare(messages)   (2s)
  → transport.send                       (stub: só loga; integração real depois)
  → trace.flush
```

## Green Agent — escopo Fase 3 (minimalista)

Cobre apenas:
1. **Descoberta** — confirma nome + interesse, define `produto = green`
2. **Envio de vídeo** — chama `send_discovery_video` 1x (idempotente)
3. **Qualificação simples** — pergunta cidade/consumo médio
4. **Solicitar fatura** — chama `request_invoice` e move `etapa_funil → fatura_enviada` quando o lead disser que vai mandar

NÃO inclui: objeção, negociação emocional, recuperação, follow-up inteligente, validação de fatura (Fase 4), holder match (Fase 4).

Heurísticas determinísticas em `stages.ts` decidem qual sub-passo rodar com base em `etapa_funil` + última mensagem. LLM só gera o texto curto dentro de um molde — nunca decide próximo passo (D1).

## Failsafe specialist

`agents/failsafe/run.ts` retorna:
```ts
{
  messages: ["Vou te transferir para um atendente humano, só um momento."],
  events: [{ type: "failsafe_triggered", priority: "critical", source: "specialist" }],
  tool_calls: [],
  suggested_state_patch: { handoff_ativo: true, specialist: "failsafe" }
}
```
Acionado em: supervisor `failsafe`, specialist timeout, specialist throw, guardrail catastrófico.

## Guardrails (validação pós-specialist)

Roda sobre `AgentResult` + `state`:
- `max-length` — chunk > 1000 chars → trunca + evento `guardrail_truncated`
- `max-chunks` — > 5 mensagens → mantém 5 + evento
- `semantic-repeat` — hash das últimas 3 mensagens enviadas; repetição → degrade
- `tool-stage-compat` — ex: `request_invoice` só em `qualificacao` ou `fatura_enviada`
- `text-loop` — mesma string consecutiva

Falha grave → degrade para `failsafe`. Falha leve → trunca/filtra + emite evento `medium`.

## Traces obrigatórios (Fase 3)

Adicionar steps: `specialist_selected`, `specialist_started`, `specialist_completed` (com `specialist_latency_ms`), `tools_requested` (count + names), `tools_executed` (count + names), `behavior_chunks_generated` (count), `guardrails_applied` (list), `agent_timeout`, `failsafe_triggered`.

## Edge update

`whatsapp-igreen-agent-v2/index.ts` ganha a parte final do pipeline acima. Mantém modo `tool:` para debug isolado. Adiciona modo `agent:` para testar specialist isolado sem supervisor.

## Validação

1. `curl_edge_functions` ping → `{ok:true,phase:3}`
2. Mensagem "oi, quero economizar na luz" → supervisor:`green` → specialist Green retorna AgentResult com 1-2 chunks + tool `send_discovery_video`
3. Repetir mesma mensagem → `send_discovery_video` retorna `skipped:lock_conflict` ou `state_unchanged` (não envia 2x)
4. Forçar specialist throw (mock) → failsafe roda, `handoff_ativo=true`, evento `critical`
5. Forçar 5 chunks com texto idêntico → guardrail `semantic-repeat` trunca + evento
6. Conta não-igreen → continua 403

## Fora de escopo (fases seguintes)

- Specialists `telecom` / `expansao` / `qualifier` reais (Fase 3.5)
- Document validator + holder match (Fase 4)
- Automações com idempotency keys reais — roleta, tag, matrícula (Fase 4)
- RAG controlado, token-budget (Fase 5)
- Lead scoring, humanização real com typing/delay no transport (Fase 6)
- Timeout-engine / follow-ups (Fase 7)
- Mudanças em `whatsapp-ai-agent` genérico — **proibido** (D13)

## Arquivos

Criar:
- `_igreen_v2/specialist-router/resolve.ts`
- `_igreen_v2/agents/_types.ts`, `_run.ts`
- `_igreen_v2/agents/green/{run,prompt,stages}.ts`
- `_igreen_v2/agents/failsafe/run.ts`
- `_igreen_v2/behavior-engine/{prepare,humanize}.ts`
- `_igreen_v2/guardrails/validate.ts` + `rules/*.ts`
- `_igreen_v2/transport/send.ts` (stub)
- `_igreen_v2/tools/{send-discovery-video,request-invoice,set-stage}.ts`

Editar:
- `_igreen_v2/tools/_register-all.ts`
- `whatsapp-igreen-agent-v2/index.ts`

Sem migrations. Sem mudanças no SaaS genérico.
