# Fase 6 v2 — Optimization, Scalability & Operational Intelligence

## 0. Invariantes preservados (D13–D15 + Fase 5)

- `state-engine/update.ts` permanece **único writer** de `igreen_lead_data`
- Toda automação continua idempotente por `correlation_id + automation_key`
- `whatsapp-ai-agent` genérico intocado; toda lógica nova em `_igreen_v2/`
- `correlation_id` propagado em 100% dos novos módulos
- PII masking via `memory/pii-guard.ts` reutilizado
- Postgres-only; sem Redis; sem LTM
- Context Budget Allocator (Fase 5) continua autoridade final sobre tokens

## 1. Migration única (8 tabelas + view)

Todas com GRANT + RLS + índices + `account_id` + `correlation_id` onde aplicável.

```text
igreen_provider_health           PK(provider, model); window contadores success/fail/latency
igreen_provider_circuit_breakers PK(provider, model); state(closed|open|half_open), opened_at, cooldown_until
igreen_model_routing             BTREE(correlation_id); selected_model, reason, escalated_from, estimated_cost_cents
igreen_prompt_compression        BTREE(correlation_id); tokens_in, tokens_out, ratio, sections_collapsed jsonb
igreen_queue_pressure            BTREE(account_id, created_at); pressure_level(low|med|high), in_flight, queued, mode
igreen_conversation_priority     PK(account_id, phone); score int, tier(hot|warm|cold), last_scored_at
igreen_cost_profiles             PK(account_id); profile(balanced|economy|performance), overrides jsonb
igreen_operational_metrics       BTREE(account_id, created_at); metric, value, dims jsonb
view igreen_phase6_metrics       p50/p95 por módulo + cost/lead + savings + degradation + cache hits
```

RLS: scope `account_id`; service_role bypass.

## 2. Módulos novos (`supabase/functions/_igreen_v2/`)

```text
model-router/           selector.ts · cost-estimator.ts · escalation.ts
prompt-compression/     compressor.ts · section-collapser.ts · redundancy.ts
provider-health/        recorder.ts · circuit-breaker.ts · degradation-detector.ts
adaptive-cost/          profile-loader.ts · adjuster.ts (RAG depth / top-k / retries)
queue-pressure/         monitor.ts · shed-load.ts · degraded-mode.ts
conversation-priority/  scorer.ts · tier-resolver.ts
analytics/              recorder.ts · cost-tracker.ts
operational-metrics/    emitter.ts · aggregator.ts
```

## 3. Smart Model Routing

| Tarefa | Modelo padrão |
|---|---|
| confirmação simples / small talk / classificação / resumo | Gemini Flash Lite |
| RAG synthesis | Gemini Flash |
| objection handling complexo / análise longa | Gemini Pro |

Roteamento por: estágio do funil, tamanho do contexto, criticidade, tool usage, confidence, token budget restante, perfil de custo, estado do circuit breaker.

Eventos: `model_router.selected`, `model_router.escalated`, `model_router.cost_saved_estimate`.

## 4. Prompt Compression Engine

Meta: **≥35% redução de tokens médios por turno**.

Operações: dedup, colapso de histórico repetitivo, sumarização de mensagens emocionais longas, redução de tool outputs antigos, listas → resumo estruturado.

Invioláveis (nunca comprimir): últimas 2 mensagens, guardrails, pending actions, soft confirmations, dados críticos (CPF, valores, datas confirmadas).

Eventos: `prompt.compressed`, `prompt.compression_ratio`, `prompt.section_collapsed`.

## 5. Provider Health + Circuit Breaker

- `recorder.ts`: registra latência e erros por `(provider, model)` em janela deslizante
- `circuit-breaker.ts`: estados closed/open/half-open com cooldown automático
- `degradation-detector.ts`: detecta degradação e força fallback de modelo via model-router

Eventos: `provider.degraded`, `provider.circuit_open`, `provider.fallback_model`.

## 6. Adaptive Cost Engine

Perfis em `igreen_cost_profiles` por `account_id`:

| Modo | RAG top-k | RAG threshold | Retries | Modelo padrão |
|---|---|---|---|---|
| balanced | 5 | 0.78 | 3 | Flash |
| economy | 2 | 0.85 | 1 | Flash Lite |
| performance | 8 | 0.72 | 3 | Pro |

Ajuste dinâmico quando uso diário ultrapassa thresholds.

## 7. Queue Pressure Management

- `monitor.ts`: lê in-flight + queued por account; calcula pressão
- Pressão alta → reduzir typing/jitter, simplificar prompts, pausar RAG em baixa prioridade
- `shed-load.ts`: rejeita/atrasa baixa prioridade com fallback determinístico

Eventos: `queue.pressure_high`, `queue.degraded_mode`, `queue.recovered`.

## 8. Conversation Prioritization

Score por conversa, recalculado a cada turno:

- **Hot**: aguardando pagamento, validação documental, onboarding ativo, resposta pendente <2min
- **Warm**: lead engajado nas últimas 24h
- **Cold**: small talk, follow-up frio, ocioso >24h

Usado por queue-pressure (shed-load) e model-router (escalação seletiva).

## 9. Observability avançada

Métricas em `igreen_operational_metrics`:

- **Performance**: latency por módulo, queue wait, retry depth, timeout rate, provider degradation
- **Financeiro**: custo/lead, custo/account, savings (routing + compression)
- **Qualidade**: response_success_rate, fallback_rate, automation_success_rate, human_handoff_rate

View `igreen_phase6_metrics` agrega tudo para dashboards.

## 10. Integração no orchestrator (`whatsapp-igreen-agent-v2`)

Nova ordem do pipeline:

```text
1.  correlation_id
2.  fast-path
3.  queue-pressure check (shed-load se crítico)
4.  rate-limit (Fase 5)
5.  adaptive-cost profile load
6.  conversation-priority score
7.  supervisor decide
8.  model-router select (respeita circuit-breaker)
9.  memory + RAG retrieve
10. context-builder (Fase 5)
11. prompt-compression
12. timeout-orchestrator wrap
13. agent.run
14. tools (com provider-health recording)
15. transport.send (orchestrator Fase 5)
16. analytics + operational-metrics emit
17. state-engine.applyPatch (único writer)
```

## 11. Ordem de execução autorizada (§8)

1. **Migration única** (8 tabelas + view + GRANT + RLS + índices)
2. **provider-health** (recorder + circuit-breaker + degradation-detector)
3. **model-router** (selector + cost-estimator + escalation)
4. **prompt-compression** (compressor + section-collapser + redundancy)
5. **adaptive-cost** (profile-loader + adjuster)
6. **conversation-priority** (scorer + tier-resolver)
7. **queue-pressure** (monitor + shed-load + degraded-mode)
8. **analytics + operational-metrics**
9. **Integração no `whatsapp-igreen-agent-v2`**
10. **`igreen-phase6-runner`** — 15 cenários ao vivo
11. **Relatório** `/mnt/documents/igreen_v2_phase6_live_validation_report.md`

Cada etapa fecha com smoke test isolado antes de avançar.

## 12. Gate READY-FOR-PHASE-7 — 15 cenários

1. Model routing seleciona Flash Lite para confirmação simples
2. Model routing escala para Pro em objeção complexa
3. Provider degradado → fallback automático de modelo
4. Circuit breaker abre após N falhas consecutivas
5. Compression reduz ≥35% tokens médios
6. Compression nunca toca últimas 2 msgs nem guardrails
7. Queue pressure alta ativa degraded_mode
8. Shed-load rejeita cold antes de hot
9. Economy mode reduz custo medido vs balanced
10. Performance mode aumenta qualidade sem quebrar budget
11. Zero patches perdidos sob pressão
12. Retries controlados (sem loop) em 429/timeout
13. RAG simplificado em pressão alta (top-k reduzido)
14. Priorização: hot lead processado antes de cold
15. Throughput alto (N concorrente) sem colapso + correlation 100% + analytics populadas

**Critério READY**: 15/15 PASS · correlation 100% · zero write fora do state-engine · zero regressão Fases 1–5 · compression ≥35% · cost savings mensurável.

## 13. Fora de escopo (proibido nesta fase)

Voz, chamadas telefônicas, Redis, multi-agent swarm, LTM, canais além do WhatsApp, IA generativa de voz.

## 14. Entregáveis

- 8 módulos novos em `_igreen_v2/`
- 1 migration (8 tabelas + view + GRANT + RLS + índices)
- Orchestrator atualizado com novo pipeline (17 passos)
- `igreen-phase6-runner` com 15/15 PASS
- Relatório operacional com p50/p95 por módulo, savings, throughput, cost/lead
- Memory index atualizado (D22–D28 + Smart Model Routing + Compression + Circuit Breaker + Adaptive Cost + Queue Pressure)

Aguardando handoff para BUILD MODE — primeira etapa: **migration única + provider-health layer**.
