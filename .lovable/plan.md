
# Igreen V2 — Fase 4 (Plano final)

Document Validator isolado + Confidence Thresholds em código + Holder Match + Soft Confirmation + 3 automações reais idempotentes. Tudo amarrado por `correlation_id` ponta-a-ponta, com `validation_version` e snapshots em torno da validação documental.

## 1. Correlation ID ponta-a-ponta

**Formato:** `igr_${Date.now()}_${randomHex(6)}` (helper em `observability/correlation.ts`).

**Geração:** no início do handler `whatsapp-igreen-agent-v2/index.ts`. Propagado via parâmetro opcional em:

- `trace()` → coluna nova `correlation_id` em `igreen_traces`
- `emitEvents()` → coluna nova `correlation_id` em `igreen_state_events`
- `ToolContext` e `AgentContext` → passa adiante
- `executeTool()` → grava em `tool_execution_started/finished`
- `withIdempotency()` e `AutomationResult` → grava em `igreen_automation_executions.correlation_id`
- `transport.send()` → loga
- `igreen-document-validator` → recebe no payload e devolve no response

**Migração:** `ALTER TABLE igreen_traces / igreen_state_events / igreen_automation_executions / igreen_document_validations ADD COLUMN correlation_id text` + index.

## 2. Estado documental separado + `validation_version`

Migração em `igreen_conversation_state`:

```
document_status text          -- pending | awaiting_soft_confirm | validated | rejected | failed
document_confidence numeric(4,3)
holder_match_status text      -- match | mismatch | unknown
validation_attempts int NOT NULL DEFAULT 0
validation_version int NOT NULL DEFAULT 1
```

`validation_version` permite evolução do pipeline (v1 Gemini → v2 novo provider/thresholds) sem quebrar estados antigos. Definido em constante `CURRENT_VALIDATION_VERSION = 1` em `document-rules-engine/version.ts`; gravado a cada validação concluída e devolvido pelo validator no response (`pipeline_version`).

Adicionar campos à whitelist `ALLOWED_FIELDS` em `state-engine/update.ts`. Novas transições em `state-engine/transitions.ts` (`qualificacao → fatura_enviada → fatura_validada` + `→ fatura_rejeitada`).

## 3. Edge function isolada `igreen-document-validator`

**Contrato puro (sem Supabase client, sem escrita de estado):**

Request:
```
{
  correlation_id, account_id, phone,
  kind: "invoice" | "identity",
  media_url, mime_type, byte_size,
  pipeline_version: 1
}
```

Response:
```
{
  correlation_id,
  pipeline_version: 1,
  provider: "gemini",
  classification: "green_invoice" | "other_invoice" | "unreadable" | "not_invoice",
  confidence: number,
  extracted: { holder_name?, document_id?, address?, energy_consumption_kwh?, distributor? },
  error?: string
}
```

**Restrições (hard):** sem `applyPatch`, sem `emitEvents`, sem `transport.send`, sem decisão de fluxo. Retorna **só JSON**.

**Resiliência:** timeout hard **12 s**, **2 retries** com backoff exponencial (1 s, 3 s), fallback `{classification:"unreadable", confidence:0, error}`. `verify_jwt = false` no `config.toml`.

## 4. Guardrail de MIME/tamanho

`document-rules-engine/media-guard.ts`:
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Tamanho: 50 KB ≤ x ≤ 10 MB
- Roda **antes** do validator. Falha → evento `media_rejected:high`, specialist pede reenvio.

## 5. Confidence thresholds em código puro

`document-rules-engine/confidence-thresholds.ts` (função pura, sem prompt):

```
>= 0.90 → "auto_approve"
0.70..0.899 → "request_soft_confirmation"
<  0.70 → "request_resend"
```

## 6. Holder match isolado

`document-rules-engine/holder-match.ts` — normaliza (lowercase + sem acento), Jaccard + Levenshtein no token principal. Output: `"match" | "mismatch" | "unknown"` + score. **Mismatch bloqueia aprovação** mesmo com confidence 0.95.

## 7. Soft confirmation (faixa 0.70–0.89)

Nova etapa `awaiting_soft_confirm`. Fluxo:
1. Validator → `confidence 0.82, holder_name="Maria O."`
2. Threshold → `request_soft_confirmation`
3. Specialist: *"Confirma que essa fatura está no nome de Maria Oliveira?"*
4. Patch: `document_status="awaiting_soft_confirm"` (sem `etapa_funil=fatura_validada`)
5. Fast-path detecta "sim/não" na próxima mensagem
6. Sim → `applyPatch({etapa_funil:"fatura_validada", document_status:"validated"})` + automações
7. Não → reenvio

## 8. Lock por `media_url` no validate

Tool `tools/validate-green-invoice.ts`:
- `idempotencyKey = "validate_invoice:" + sha1(media_url)`
- Lock TTL **120 s** via `igreen_tool_locks`
- Conflito → `skipped:lock_conflict`
- Internamente: `media-guard → validator → thresholds → holder-match` → devolve `suggested_state_patch` + `events`
- **Não** envia mensagem (specialist decide texto)

## 9. Snapshots automáticos em torno da validação

Mantém alinhado com D9 (state = fonte da verdade) e habilita recovery/debug em race, retry, timeout, divergência de provider.

Novo helper `state-engine/snapshot.ts` → grava em `igreen_state_snapshots` (tabela já existente; criada na migração da Fase 1):

```
snapshot({ account_id, phone, label, correlation_id })
```

Disparado em 2 pontos **dentro de `validate-green-invoice.ts`** (não no specialist, garante atomicidade):
- **Antes** da chamada ao validator: `label="before_document_validation"`
- **Depois** do resultado final (com ou sem erro/skip): `label="after_document_validation"`

Cada snapshot inclui `state_version`, `correlation_id`, `validation_version` e `attempt`.

## 10. Automações reais idempotentes

Pasta `automations/`:

| Automação | idempotency_key | Função |
|---|---|---|
| `handoff` | `handoff:${account}:${phone}:${reason}` | `handoff_ativo=true`, evento `critical` |
| `tagging` | `tag:${account}:${phone}:${tag}` | Adiciona tag em `contacts.tags` via `tag_contact_reserved` |
| `media-dispatch` | `media:${account}:${phone}:${media_key}` | Marca envio em `extras.dispatched_media[]` |

Todas: `AutomationResult`, `withIdempotency()`, state-aware (no-op se já feito), recebem `correlation_id`. Registro central `automations/_register-all.ts` quebra em duplicata.

**Fora de escopo Fase 4:** roleta, CRM stage move, enrollment, follow-up cancel.

## 11. Logs mínimos do OCR (LGPD + custo)

`igreen_document_validations` recebe apenas:
- `provider, classification, confidence, threshold_decision`
- `extracted` mínimo: `holder_name`, `document_id_masked` (`***.456.***-89`), `distributor`, `kwh`
- `media_url` (referência, não conteúdo)
- `correlation_id`, `pipeline_version`, `attempts`

Sem `raw_response`, sem base64, sem payload Gemini completo.

## 12. Pipeline atualizado (edge principal)

```
1. gerar correlation_id
2. fast-path (inclui detector "sim/não" quando document_status=awaiting_soft_confirm)
3. supervisor
4. specialist green
   ├─ mensagem com mídia → tool_calls = [{name:"validate_green_invoice", args:{media_url, mime, size}}]
   └─ else fluxo atual
5. tool-router executa
   └─ validate_green_invoice:
        snapshot("before_document_validation")
        → media-guard → validator → thresholds → holder-match
        snapshot("after_document_validation")
        → suggested_state_patch + events
6. guardrails
7. state-engine.applyPatch (único writer)
8. automation-router (NOVO): lê events da rodada, dispara handoff/tagging/media-dispatch
9. behavior-engine → transport
10. trace.complete com correlation_id
```

## 13. Testes obrigatórios

Script `/tmp/phase4_tests.sh`:

| # | Cenário | Esperado |
|---|---|---|
| 1 | MIME `text/html` | `media_rejected:high`, validator não chamado |
| 2 | PDF 10 bytes | Bloqueado por `media-guard` |
| 3 | Confidence 0.65 | `request_resend`, sem `fatura_validada` |
| 4 | 0.82 + holder match | `awaiting_soft_confirm`, pergunta de confirmação |
| 5 | 0.95 + holder **mismatch** | Bloqueia aprovação |
| 6 | 0.95 + holder match | `validated`, `tagging("fatura_ok")` 1× |
| 7 | Provider timeout | 2 retries, fallback, `validation_failed:high`, pipeline OK |
| 8 | Mesma `media_url` 2× paralelo | 1 exec + 1 `skipped:lock_conflict` |
| 9 | Webhook duplicado | Automações `skipped:already_executed` |
| 10 | Soft confirm "sim" | `applyPatch(fatura_validada)` + automações |
| 11 | 5 msgs com mídia em paralelo | 0 perdas de patch |
| 12 | Conta `is_igreen=false` | 403 (D13) |
| 13 | Snapshots gravados | 2 linhas em `igreen_state_snapshots` por validação (before+after) |
| 14 | `validation_version` propagada | request/response/state/validations todos com `1` |

Relatório final em `/mnt/documents/igreen_v2_phase4_test_report.md`.

## 14. Arquivos

**Novos:**
```
supabase/functions/
├── igreen-document-validator/index.ts
└── _igreen_v2/
    ├── observability/correlation.ts
    ├── document-rules-engine/
    │   ├── version.ts                       (CURRENT_VALIDATION_VERSION=1)
    │   ├── confidence-thresholds.ts
    │   ├── holder-match.ts
    │   ├── invoice-rules.ts
    │   └── media-guard.ts
    ├── state-engine/snapshot.ts             (helper labels before/after)
    ├── tools/validate-green-invoice.ts
    ├── automations/
    │   ├── _register-all.ts
    │   ├── handoff.ts
    │   ├── tagging.ts
    │   └── media-dispatch.ts
    └── automation-router/
        ├── registry.ts
        └── dispatch.ts
```

**Editados:**
- `_igreen_v2/observability/trace.ts` — aceita `correlation_id`
- `_igreen_v2/state-engine/update.ts` — whitelist + transições + grava `validation_version` quando vier no patch
- `_igreen_v2/state-engine/transitions.ts`
- `_igreen_v2/tool-router/{types.ts,execute.ts}` — propaga correlation_id
- `_igreen_v2/automations/_idempotency.ts`
- `_igreen_v2/agents/green/{run.ts,prompt.ts,stages.ts}` — detecta mídia, soft-confirm, mismatch
- `_igreen_v2/fast-path/decide.ts` — detector "sim/não"
- `_igreen_v2/tools/_register-all.ts`
- `whatsapp-igreen-agent-v2/index.ts` — gera correlation_id, chama automation-router após state-engine
- `supabase/config.toml` — `[functions.igreen-document-validator] verify_jwt=false`

**Migração SQL (uma única):**
```sql
ALTER TABLE public.igreen_conversation_state
  ADD COLUMN IF NOT EXISTS document_status text,
  ADD COLUMN IF NOT EXISTS document_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS holder_match_status text,
  ADD COLUMN IF NOT EXISTS validation_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_version int NOT NULL DEFAULT 1;

ALTER TABLE public.igreen_traces                ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_state_events          ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_automation_executions ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.igreen_document_validations
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS pipeline_version int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_igreen_traces_corr ON public.igreen_traces(correlation_id);
CREATE INDEX IF NOT EXISTS idx_igreen_events_corr ON public.igreen_state_events(correlation_id);
```

**Diretivas preservadas:** D1, D4, D5, D9 (snapshots), D10, D13, D14 (único writer), D15 (idempotência).

## 15. Critério de pronto

- [ ] Documento atravessa pipeline completo (mídia → guard → validator → thresholds → holder → state → automações)
- [ ] Thresholds funcionando (3 faixas)
- [ ] Soft confirmation funcionando (4 + 10)
- [ ] Holder mismatch bloqueia (5)
- [ ] Automações idempotentes (6 + 9)
- [ ] `correlation_id` presente em traces/events/automations/validations
- [ ] `validation_version` presente em state + validations + response do validator
- [ ] Snapshots `before_document_validation` e `after_document_validation` gravados em toda validação
- [ ] Failsafe validado (7)
- [ ] Zero impacto no `whatsapp-ai-agent` genérico
- [ ] Relatório final em `/mnt/documents/`
