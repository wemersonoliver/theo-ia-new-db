
# Plano: Follow-up pré-gerado em lote (1 chamada de IA por lead)

## Análise da sua ideia

Sua proposta resolve a raiz do custo. Hoje cada lead inativo gera até **24 chamadas Gemini** (análise + geração × 12 etapas). Sua proposta reduz para **1 chamada por lead**, gerando as 12 mensagens já encadeadas com horários definidos.

### Ganhos esperados
- ~95% de redução do custo de IA no follow-up.
- Latência zero no envio (worker só lê e dispara).
- Eliminação de timeouts atuais em `system-followup-ai` e `followup-ai`.

### Gargalos identificados e soluções

1. **Sequência precisa ser narrativamente encadeada** (msg 2 referencia msg 1, msg 6 sobe a tensão, msg 12 é despedida).
   - **Solução**: prompt único que pede um arco narrativo de 12 etapas, com função-tool retornando array ordenado. Cada item declara `step`, `hook`, `references_previous` (resumo do que a anterior disse), `content`. A IA é instruída a NÃO repetir gancho consecutivo e respeitar a curva: dias 1-2 leveza, 3-4 dor/solução, 5 escassez real, 6 pergunta de saída.

2. **Mensagens "envelhecem"** — cenário do cliente pode mudar.
   - **Solução**: placeholders dinâmicos resolvidos no envio (`{{nome}}`, `{{dia_relativo}}`). Sem regeneração — se houver evento, a sequência é cancelada inteira.

3. **Dois cenários de cancelamento** (sua exigência):
   - **Cenário A — Cliente responde**: IA continua o atendimento normalmente. Follow-up é totalmente cancelado.
   - **Cenário B — Humano envia mensagem** (atendente assume): IA é desativada (`ai_active=false`) E follow-up é cancelado.
   - **Solução**: hook único no `whatsapp-webhook` que detecta:
     - mensagem entrante (`from_me=false`) → cancela sequência, mantém `ai_active=true`.
     - mensagem saída humana (`from_me=true AND sent_by='human'`) → cancela sequência E garante `ai_active=false`.
   - Função SQL `cancel_followup_sequence(p_user_id, p_phone, p_reason)` faz tudo atomicamente: `UPDATE tracking SET status='engaged'/'handoff'` + `DELETE followup_messages WHERE sent_at IS NULL`.

4. **Janela de horário muda depois do agendamento**.
   - **Solução**: dispatcher valida `isWithinWindow` antes de enviar; se fora, empurra para próximo slot válido (não regenera texto).

5. **IA falha em retornar 12 itens válidos**.
   - **Solução**: function calling com schema estrito `minItems: 12, maxItems: 12`. Em falha, marca tracking `generation_failed` e admin é notificado via tabela de logs.

6. **Custo da chamada única**: ~3-4k output tokens (12 mensagens curtas + metadados). Ainda é ~85% mais barato que 24 chamadas atuais.

## Arquitetura

```text
[followup-check-inactive] (cron)
        │
        ▼
   tracking criado (status='pending')
        │
        ▼
[NOVA: followup-generate-sequence] (cron 5 min)
        │
        ├─ 1 chamada Gemini → 12 mensagens encadeadas via function calling
        ├─ Calcula 12 scheduled_at em janelas BRT (manhã+tarde × 6 dias)
        ├─ INSERT em followup_messages (12 linhas)
        └─ tracking → status='scheduled', sequence_generated_at=now()
        │
        ▼
[NOVA: followup-dispatch] (cron 5 min, SEM IA)
        │
        ├─ SELECT followup_messages WHERE sent_at IS NULL AND scheduled_at <= now()
        ├─ Valida janela BRT + tracking ainda 'scheduled'
        ├─ Resolve placeholders
        ├─ Envia via Evolution API
        └─ UPDATE sent_at = now()

[whatsapp-webhook] (já existe — adicionar hook)
        │
        ├─ Mensagem do cliente (from_me=false)
        │      └─ cancel_followup_sequence(reason='engaged')
        │
        └─ Mensagem humana (from_me=true, sent_by='human')
               └─ ai_active=false + cancel_followup_sequence(reason='handoff')
```

## Mudanças de banco

### Nova tabela `followup_messages`

```text
id                uuid PK
tracking_id       uuid FK → followup_tracking(id) ON DELETE CASCADE
user_id           uuid
account_id        uuid
phone             text
step              int          -- 1..12
hook_used         text
content           text
scheduled_at      timestamptz
sent_at           timestamptz  -- null = pendente
status            text         -- 'scheduled'|'sent'|'cancelled'|'failed'
created_at        timestamptz default now()
```

Índices: `(scheduled_at) WHERE sent_at IS NULL`, `(tracking_id)`.

RLS: idêntico ao `followup_tracking` (owner via `user_id` + super_admin).

### Tabela espelho `system_followup_messages` (mesma estrutura, sem `user_id`/`account_id`).

### Ajustes em `followup_tracking` e `system_followup_tracking`

- Coluna `sequence_generated_at timestamptz`.
- Coluna `cancellation_reason text` (`engaged` | `handoff` | `exhausted` | `disabled`).
- Status novo permitido: `scheduled`, `handoff`.

### Função SQL

```text
cancel_followup_sequence(p_user_id, p_phone, p_reason text)
  → UPDATE followup_tracking SET status=p_reason, cancellation_reason=p_reason
  → DELETE followup_messages WHERE tracking_id=... AND sent_at IS NULL
```

Versão `system_cancel_followup_sequence(p_phone, p_reason)` para o módulo suporte.

## Edge functions

1. **NOVA `followup-generate-sequence`** (e `system-followup-generate-sequence`)
   - Pega trackings `status='pending' AND sequence_generated_at IS NULL`.
   - 1 chamada Gemini com prompt narrativo (arco completo dos 12 passos).
   - Function calling retorna array com 12 itens.
   - Calcula 12 horários (loop sobre `calculateNextSchedule`).
   - Insere `followup_messages` em batch.
   - Loga uso em `ai_usage_log` com `source='followup-sequence-gen'`.

2. **NOVA `followup-dispatch`** (e `system-followup-dispatch`)
   - SEM Gemini.
   - Valida janela + intervalo + tracking ativo.
   - Envia via Evolution e marca `sent_at`.

3. **Modificar `whatsapp-webhook`**
   - Em mensagem entrante: chama `cancel_followup_sequence(user, phone, 'engaged')`.
   - Em mensagem humana saindo: garante `ai_active=false` + `cancel_followup_sequence(user, phone, 'handoff')`.

4. **Modificar `support-ai-agent` / webhook do system WhatsApp** com hooks equivalentes para o `system_*`.

5. **Deprecar `followup-ai` e `system-followup-ai`** (manter no repo 1 semana para rollback, removidos do cron).

## Cron (atualizar via insert SQL — não migration)

- `followup-generate-sequence`: a cada 5 min.
- `followup-dispatch`: a cada 5 min.
- `system-followup-generate-sequence`: a cada 5 min.
- `system-followup-dispatch`: a cada 5 min.
- Pausar schedules de `followup-ai` e `system-followup-ai`.
- Manter `followup-check-inactive` e `system-followup-check-inactive`.

## Plano de rollout

1. Migration: `followup_messages`, `system_followup_messages`, colunas e função SQL.
2. Implementar `followup-generate-sequence` + `followup-dispatch` (e os system).
3. Adicionar hooks de cancelamento no webhook.
4. Atualizar cron jobs.
5. Monitorar `ai_usage_log` por 48h, comparar custo vs. semana anterior.

## Métricas de sucesso

- Custo Gemini do follow-up: queda ≥ 90%.
- Mensagens enviadas após resposta do cliente: 0.
- Mensagens enviadas após handoff humano: 0.
- Mensagens fora da janela BRT: 0.
