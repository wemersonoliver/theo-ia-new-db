# Fase 5 v2 — Transport / Memory / RAG / Cost Safety (iGreen v2)

Plano aprovado. Execução em BUILD MODE seguindo §8 abaixo.

## 0. Invariantes invioláveis

| # | Regra | Enforcement |
|---|---|---|
| D13 | `state-engine/update.ts` é o **único writer** de `igreen_lead_data` | Nenhum módulo novo escreve direto; só emite `suggested_state_patch` |
| D14 | Automações idempotentes por `correlation_id + automation_key` | Reuso de `_idempotency.ts` |
| D15 | `whatsapp-ai-agent` genérico intocado | Toda lógica iGreen em `_igreen_v2/` |
| — | `correlation_id` propagado em 100% dos novos módulos | Tipado em todas as assinaturas |
| — | CPF/document masking em todos os logs novos | Reuso de `pii-guard` |
| — | Sem Redis/Upstash; Postgres-only | `igreen_rate_buckets` com `UPDATE…RETURNING` |
| — | Sem long-term memory | Apenas window + summary |

## 1. Módulos novos (`supabase/functions/_igreen_v2/`)

```text
transport/        typing.ts · humanize.ts · media-queue.ts · send-orchestrator.ts
memory/           short-term.ts · summarizer.ts · pii-guard.ts
rag/              retriever.ts · cache.ts · context-builder.ts · embedding-worker.ts
cost-governor/    token-budget.ts · rate-limiter.ts · timeout-orchestrator.ts · cancel-registry.ts
retry/            backoff.ts
```

Edge functions novas: `igreen-rag-ingest`, `igreen-memory-gc` (pg_cron 10min), `igreen-phase5-runner`.

## 2. Context Budget Allocator (oficial)

`rag/context-builder.ts` aplica alocação por seção com prioridades. Orçamento padrão **8.000 tokens** (configurável por `account_id`).

| # | Seção | Budget | Truncável | Ordem trunc. | Estratégia |
|---|---|---:|---|---:|---|
| 1 | system_prompt + guardrails | 1.200 | **NÃO** | — | Overflow → abort + fallback |
| 2 | safety_reserve (output) | 1.400 | NÃO | — | Reservado |
| 3 | current_conversation | 1.600 | parcial | 5º | Mantém ≥ 2 últimas íntegras |
| 4 | memory_summaries | 600 | sim | 4º | Mantém o mais recente |
| 5 | tool_outputs | 1.400 | sim (com resumo) | 3º | >800 tokens → summarize |
| 6 | rag_chunks | 1.800 | sim | **1º** | Remove menor score primeiro |

Eventos: `context.budget_allocated`, `context.section_truncated`, `context.guardrails_overflow`, `context.tool_output_summarized`. Assertion final: soma ≤ total_budget.

## 3. Schema (1 migration, 12 tabelas + view)

Todas com GRANT + RLS + índices.

```text
igreen_transport_events       UNIQUE(correlation_id, chunk_index)
igreen_memory_window          BTREE(account_id, phone, created_at), expires_at parcial
igreen_memory_summaries       BTREE(account_id, phone, created_at)
igreen_knowledge_chunks       HNSW(embedding vector(1536))
igreen_rag_cache              PK(query_hash), expires_at parcial
igreen_rag_traces             BTREE(correlation_id)
igreen_account_limits         PK(account_id)
igreen_rate_buckets           PK(key); UPDATE…RETURNING atômico
igreen_cancellations          PK(correlation_id)
igreen_token_usage            BTREE(account_id, created_at)
igreen_context_allocations    BTREE(correlation_id, section)
igreen_tool_output_cache      PK(output_hash), expires_at parcial
view igreen_phase5_metrics    p50/p95 por fase + RAG hit-rate + tokens/seção
```

RLS: `account_id` scope; `service_role` bypass para edge functions.

## 4. Cost Governor

- `token-budget`: input 6.000 / output 1.200 por turno; 400k/dia por `account_id` (`igreen_account_limits`).
- `rate-limiter`: 8/min por phone, 120/min por account (token-bucket Postgres atômico).
- `timeout-orchestrator`: tool=12s, agent=25s, transport=8s, RAG=4s. Fallback determinístico em timeout.
- `cancel-registry`: `igreen_cancellations` consultado pelo follow-up scheduler.

## 5. Retry / Backoff

`base=400ms, factor=2, max=8s, attempts=3`. Classes: `transient`, `provider_4xx` (no-retry), `budget` (no-retry). Aplicado em Gemini, Evolution, embeddings, validator HTTP.

## 6. Transport

- `typing`: presence=composing, duração `min(8s, chars/45)`
- `humanize`: split 220 chars + jitter 1.2–2.8s + pausa em `?`
- `media-queue`: FIFO por phone com lock `transport:{phone}` em `igreen_locks`
- `send-orchestrator`: wrapper único; registra `igreen_transport_events`

## 7. Memory

- `short-term`: N=12, TTL 24h, em `igreen_memory_window`
- `summarizer`: comprime 8 mais antigas em ≤400 tokens via Gemini Flash Lite
- `pii-guard`: mascara CPF/RG/document_id antes de persistir
- Sem LTM nesta fase

## 8. Ordem de execução (autorizada)

1. **Migration única** (12 tabelas + GRANT + RLS + índices + view)
2. **cost-governor** (token + rate + timeout + cancel)
3. **retry/backoff**
4. **transport** (typing → humanize → media-queue → send-orchestrator)
5. **memory** (short-term → pii-guard → summarizer)
6. **rag** (cache → retriever → **context-builder com Budget Allocator** → ingest)
7. **Integração no `whatsapp-igreen-agent-v2`** (timeout-orchestrator wrappa agent.run; transport substitui send direto)
8. **`igreen-phase5-runner`** — 19 cenários ao vivo
9. **Relatório** `/mnt/documents/igreen_v2_phase5_live_validation_report.md`

Cada etapa fecha com smoke test isolado antes de avançar.

## 9. 19 cenários (gate de PASS)

1. Typing antes de cada chunk
2. Ordem preservada texto+áudio paralelos
3. Media-queue lock impede concorrência
4. Memory window respeita N=12
5. Summarizer comprime + mantém continuidade
6. PII mascarada (CPF nunca cru)
7. RAG cache hit reduz latência >40%
8. RAG threshold pula chunks ruins
9. RAG budget corta excedente
10. Context budget: RAG cai primeiro sob pressão
11. Context budget: guardrails nunca truncados → abort + fallback
12. Tool output longo é resumido, não dropado
13. Token budget bloqueia turno acima do cap diário
14. Rate limit por phone (8/min)
15. Rate limit por account (120/min)
16. Timeout em tool → fallback determinístico
17. Cancel registry aborta follow-up quando lead responde
18. Retry exponencial em 429 do Gemini
19. Multi-instância: 2 workers em rate_buckets sem corrida

**Critério READY-FOR-PHASE-6**: 19/19 PASS · correlation 100% · zero patch perdido · zero guardrails_overflow não tratado · zero write fora do state-engine · zero regressão nas Fases 1–4.

## 10. Entregáveis

- 5 módulos + 3 edge functions novas
- 1 migration (12 tabelas + view + GRANT + RLS + índices)
- `igreen-phase5-runner` com 19/19 PASS
- Relatório com latências p50/p95, RAG hit-rate, tokens por seção, evidências SQL
- Memory index atualizado (D16–D21 + Context Budget Allocation)

Aguardando handoff para BUILD MODE — primeiro passo será a migration única.
