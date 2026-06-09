## Objetivo

Quando um cliente **inicia o atendimento demonstrando interesse no produto Conexão Green** ("quero saber da conexão green", "como economizar na conta de luz", "energia por assinatura") e **para de responder antes de receber o vídeo de descoberta**, ele deve ser automaticamente matriculado no **Cenário 1 (`CENARIO1`)**. Esse comportamento vira padrão para todos os usuários do plano Igreen.

## Sinais que o sistema já mantém

- `igreen_conversation_state` é gravada pelo agente Green com `produto='green'` assim que a intenção Conexão Green é detectada (antes do vídeo).
- `igreen_conversation_state.extras` recebe `video_sent: true` somente quando a tool `send_discovery_video` executa com sucesso.
- `igreen_conversation_state.last_event_at` é atualizado a cada mensagem do lead.
- `whatsapp_conversations.messages[]` traz o histórico com `from_me` e `timestamp`.
- `igreen_scenarios` da conta Igreen já tem o **Cenário 1** (`trigger_tag='CENARIO1'`, `product_key='green'`) padronizado.
- A edge `igreen-scenario-enroll` já cria matrícula idempotente.

Falta apenas a varredura periódica que detecta o silêncio na fase pré-vídeo e dispara o enroll.

## Plano (anti-falhas, baixo custo)

### 1. Nova edge function `igreen-pre-video-sweeper`

- Roda sob `service_role`, `verify_jwt = false`.
- **Invocada por pg_cron 1×/hora** (`0 * * * *`). ~24 execuções/dia → custo desprezível.
- `BATCH_LIMIT = 100` por execução.
- `SILENCE_MINUTES = 60` (alinhado à frequência horária).
- `LOOKBACK_HOURS = 24` (não ressuscita leads antigos quando a feature ativar).

**Query base** em `igreen_conversation_state`:
- `produto = 'green'`
- `coalesce((extras->>'video_sent')::bool, false) = false`
- `coalesce(handoff_ativo, false) = false`
- `last_event_at < now() - interval '60 minutes'`
- `last_event_at > now() - interval '24 hours'`
- `coalesce(extras->>'pre_video_enrolled_at', '') = ''`

**Para cada candidato — guard-rails antes do enroll:**
1. Carrega `whatsapp_conversations` por `(account_id, phone)`.
2. Confirma que a última mensagem foi do AI (`from_me=true`). Se foi do cliente, aborta.
3. Confirma `closed_at IS NULL` e `outcome IS NULL`.
4. Confirma que **não existe** linha em `igreen_product_video_followups` para `(account_id, phone)` — se existir, o vídeo já entrou em jogo (outro fluxo cuida).
5. Confirma que **não existe** enrollment ativo em `igreen_scenario_enrollments` para `(account_id, contact_phone)`.
6. Busca cenário ativo da conta com `trigger_tag ILIKE 'CENARIO1'`, `product_key='green'`, `enabled=true`. Se não houver, marca `extras.pre_video_skipped_reason='scenario_disabled'` e segue.
7. Resolve `contact_id` em `contacts` por `(account_id, phone)` (best effort).
8. Chama `igreen-scenario-enroll` via fetch interno com `x-internal-key` e payload `{ account_id, phone, contact_id, trigger_tag: 'CENARIO1' }`.
9. Em sucesso: atualiza `extras` com `pre_video_enrolled_at = now()` e `pre_video_enrolled_via = 'sweeper'`; registra evento em `igreen_scenario_events` (`event='auto_enroll_pre_video'`).
10. Em erro HTTP: **não** marca `pre_video_enrolled_at` (idempotência preserva retry no próximo ciclo).

### 2. pg_cron

Job `igreen-pre-video-sweeper-1h` executando `0 * * * *`, chamando a nova edge com `x-internal-key` (mesmo padrão dos demais jobs Igreen).

### 3. Salvaguardas explícitas

- **Janela de silêncio 60 min** evita enrolar lead ainda ativo.
- **Última msg `from_me=true`** evita enrolar quem já respondeu.
- **`video_sent=false`** garante que quem recebeu o vídeo NÃO entra por aqui (outro fluxo).
- **`pre_video_enrolled_at` em `extras`** = idempotência sem nova tabela.
- **`igreen_stop_for_phone` dentro do enroll** evita duplicar com outros cenários.
- **`LOOKBACK_HOURS=24`** evita varrer histórico antigo na ativação.
- **`handoff_ativo=false`** evita atropelar humano.
- **Sem dependência de plano**: se a conta não tem cenário CENARIO1 ativo, nada acontece.

### 4. Custo (resumo honesto)

- 24 invocações/dia, cada uma com 1 SELECT indexável + N consultas pequenas só para os poucos candidatos reais.
- Sem nova tabela, sem novas colunas (uso `extras jsonb` existente).
- Nenhuma escrita em loop pesado — apenas no momento do enroll real.

### 5. Sem mudanças necessárias

Frontend, agente Green, dispatcher, tool `send-discovery-video`, fluxo pós-vídeo: **inalterados**.

## Arquivos afetados

```text
supabase/functions/igreen-pre-video-sweeper/index.ts   (novo)
supabase/config.toml                                   (verify_jwt = false p/ a nova função)
pg_cron job                                            (via supabase--insert)
```

## Validação manual

1. Lead novo manda "quero saber da conexão green" → IA pergunta o nome → lead some.
2. Após 60 min, na próxima execução horária, aparece linha em `igreen_scenario_enrollments` (`scenario_key=CENARIO1`, `status=active`); `extras.pre_video_enrolled_at` preenchido.
3. Lead que recebeu o vídeo (`extras.video_sent=true`) → sweeper ignora.
4. Lead que respondeu o nome mas não chegou ao vídeo → ainda assim é enrolado (correto: não passou da fase do vídeo).
5. Lead já matriculado em outro cenário → skip pelo guard 5.

Posso seguir para implementação?