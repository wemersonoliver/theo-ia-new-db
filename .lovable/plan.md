# Módulo de Follow-Up Personalizado

Adicionar uma nova aba dentro de `/followup` chamada **"Fluxos Personalizados"**, mantendo o módulo de IA atual intacto. O novo módulo permite criar fluxos próprios com mensagens em qualquer mídia, agendados por tempo relativo desde o início, com fila global anti-bloqueio.

---

## 1. O que o usuário poderá fazer

- Criar **múltiplos fluxos** (ex: "Boas-vindas", "Pós-venda", "Reativação 30 dias").
- Para cada fluxo definir:
  - **Nome, descrição, status (ativo/pausado)**
  - **Gatilho de início**:
    - Inatividade do contato (X minutos / horas / dias sem responder)
    - Manual (disparar via botão na conversa ou no CRM)
    - Por etapa do CRM (quando deal entra em determinada etapa)
    - Por tag do contato
    - Após finalização de atendimento (won/lost/abandoned)
  - **Filtros**: aplicar só a contatos com tag X, segmento Y, etc.
  - **Janela de envio**: padrão 08:00–19:00, sem domingos (configurável por fluxo).
  - **Excluir contatos em atendimento humano** (handoff).
  - **Encerrar fluxo se cliente responder** (toggle).
- Adicionar **passos (steps)** ao fluxo, na ordem desejada:
  - Tipo: **texto, áudio (PTT), vídeo, imagem, documento, sticker**
  - **Delay**: "X minutos / horas / dias após o passo anterior" (ou após o início)
  - Texto suporta **variáveis dinâmicas**: `{{nome}}`, `{{primeiro_nome}}`, `{{empresa}}`, `{{ultimo_produto}}`, etc.
  - Upload de mídia para Storage (novo bucket `followup-media`)
  - Pré-visualização do passo
- **Reordenar passos** via drag-and-drop.
- **Duplicar fluxo** e **importar/exportar** (JSON) — para reuso entre contas.
- **Testar fluxo**: enviar para o próprio número antes de ativar.

---

## 2. Recursos avançados sugeridos (para deixar poderoso)

1. **A/B Testing**: duas variantes de mensagem no mesmo passo, divisão %.
2. **Condicionais simples**: "se cliente respondeu → pula para passo X / encerra".
3. **Spintax** no texto: `{Oi|Olá|E aí} {{nome}}` para evitar mensagens idênticas.
4. **Randomização de delays**: ±N% para parecer mais humano.
5. **Presença "digitando..."** antes de cada texto e **"gravando áudio..."** antes de PTT (já existe no `system-followup-dispatch`, replicar).
6. **Limite anti-spam**: máx N mensagens/hora por instância, máx 1 fluxo ativo por contato.
7. **Blacklist de contatos** (não receber follow-up).
8. **Métricas por fluxo**: enviados, lidos, respondidos, taxa de conversão, opt-out.
9. **Webhook de saída**: notificar URL externa quando contato responde / converte.
10. **Integração com CRM**: ao responder, mover deal para etapa X automaticamente.
11. **Pausar fluxo em feriados** (calendário BR configurável).
12. **Disparo em massa** a partir de uma lista de contatos / segmento / importação CSV.
13. **Emoji picker e formatação WhatsApp** (negrito, itálico) no editor.
14. **Biblioteca de mídia reutilizável** (galeria) para não reupload.

---

## 3. Arquitetura técnica

### Banco de dados (novas tabelas)

- `custom_followup_flows` — definição do fluxo (id, account_id, user_id, name, description, trigger_type, trigger_config jsonb, filters jsonb, window_config jsonb, exclude_handoff, stop_on_reply, enabled, created_at, updated_at).
- `custom_followup_steps` — passos do fluxo (id, flow_id, position, type [text|audio|video|image|document|sticker], content text, media_url, media_mime, caption, delay_value int, delay_unit [minutes|hours|days], variants jsonb [A/B], conditions jsonb).
- `custom_followup_enrollments` — contato inscrito num fluxo (id, flow_id, account_id, phone, contact_id, current_step, status [active|completed|stopped|paused], started_at, last_sent_at, next_scheduled_at, stop_reason, metadata jsonb). Unique parcial (flow_id, phone) onde status='active'.
- `custom_followup_queue` — fila global de envio (id, account_id, instance_id, enrollment_id, step_id, phone, scheduled_at, status [pending|sending|sent|failed|skipped], attempts, last_error, locked_at, locked_by, sent_at). Índices em (account_id, status, scheduled_at) e (instance_id, status).
- `custom_followup_blacklist` — (account_id, phone, reason).
- Bucket Storage: `followup-media` (privado, RLS por account_id).

### RLS
- Todas as tabelas: ALL via `account_id = current_account_id()` ou `is_account_member(account_id)`.
- Service role bypassa para o dispatcher.

### Edge Functions

1. **`custom-followup-trigger`** — chamada por:
   - Cron a cada 5 min para varrer inatividade
   - Trigger DB (NOTIFY) em mudança de stage CRM, finalize_conversation, etc.
   - Endpoint manual (botão na UI)
   Cria `enrollment` + agenda primeiro passo na `custom_followup_queue`.

2. **`custom-followup-dispatcher`** — cron **a cada 1 minuto**.
   - Para cada `instance_id` ativa: pega 1 mensagem `pending` com `scheduled_at <= now()` e dentro da janela.
   - Lock pessimista (UPDATE ... WHERE status='pending' RETURNING) para evitar duplicidade.
   - Envia via Evolution (`sendText`/`sendMedia`/`sendWhatsAppAudio`).
   - **Throttle**: respeita **mínimo 7s** entre envios da mesma instância (consulta último `sent_at`). Se < 7s, reagenda para `last_sent + 7s`.
   - Em sucesso: marca `sent`, agenda próximo passo do fluxo (calcula `scheduled_at` baseado no delay do próximo step + janela 08–19/sem domingo).
   - Em falha: retry exponencial até 3x.
   - Se `stop_on_reply` e contato respondeu desde o último envio → `status='stopped'`.

3. **`custom-followup-stop`** — webhook chamado pelo `whatsapp-webhook` quando o contato responde, para parar enrollments ativos.

### Fila e anti-bloqueio
- 1 worker por instância (via SELECT FOR UPDATE SKIP LOCKED).
- Janela 08:00–19:00 BRT, sem domingos (helper `_followup-window.ts` já existe — reaproveitar).
- Espaçamento mínimo 7s configurável (default 7s, range 3–30s).
- Pausa automática se Evolution retornar erro de bloqueio (status banido).

### Frontend

- Nova aba em `/followup`: **Fluxos Personalizados**.
- Páginas:
  - **Lista de fluxos** (cards com métricas: ativos, enviados hoje, taxa de resposta).
  - **Editor de fluxo** (drawer/página): seções *Gatilho*, *Filtros*, *Janela*, *Passos* (canvas vertical drag-and-drop com cards por step), *Configurações*.
  - **Editor de passo** (modal): tipo, conteúdo/mídia upload, delay, variantes A/B.
  - **Inscrições** (tabela): contatos atualmente em fluxos, com ações pausar/parar/avançar.
  - **Métricas** (gráficos por fluxo).
- Hooks React Query: `useCustomFlows`, `useFlowSteps`, `useEnrollments`, `useFlowMetrics`.
- Componentes shadcn já existentes; drag-and-drop com `@dnd-kit/sortable` (já presente).

---

## 4. Entregas em fases

**Fase 1 — Núcleo (MVP)**
- Tabelas + RLS + bucket
- Editor de fluxo com gatilho por inatividade e passos texto/áudio/imagem/vídeo/documento
- Dispatcher com fila, lock, throttle 7s, janela 08–19, sem domingo
- Inscrição automática + parada ao responder
- Lista de fluxos e inscrições

**Fase 2 — Avançado**
- Variáveis dinâmicas + Spintax
- A/B testing + condicionais
- Disparo manual / em massa por lista
- Métricas e dashboard

**Fase 3 — Integrações**
- Gatilhos por etapa CRM, tag, finalização
- Webhook de saída
- Biblioteca de mídia, importar/exportar JSON, calendário de feriados

---

## 5. Perguntas antes de começar

1. **Convivência com o módulo IA atual**: manter os dois lado a lado em abas separadas dentro de `/followup`, ou esse novo substitui o atual?
2. **Escopo inicial**: posso entregar a **Fase 1 (MVP)** primeiro e depois iterar nas Fases 2 e 3? Ou você quer tudo de uma vez?
3. **Gatilhos no MVP**: começar só com **inatividade + manual**, ou já incluir **etapa CRM e finalização de atendimento**?
4. **Throttle**: 7s fixos, ou configurável por fluxo (ex.: 5–15s aleatório para parecer mais humano)?
