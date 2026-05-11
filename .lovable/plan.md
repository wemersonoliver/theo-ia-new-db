
# Fluxos de Atendimento (Campanhas) — Super Admin

Nova área no painel super admin para criar fluxos automáticos no estilo Typebot, disparados quando uma mensagem específica chega no **WhatsApp do sistema** (ex.: "Olá! Quero saber mais sobre o Theo IA").

## 1. Banco de dados

Três novas tabelas (todas com RLS — somente `super_admin` gerencia):

**`attendance_flows`** — cada fluxo/campanha
- `name`, `description`
- `trigger_text` (texto exato que dispara — comparação normalizada: trim + lowercase + remoção de acentos)
- `trigger_match_mode` (`exact` | `contains`) — começamos só com `exact`, mas deixamos preparado
- `is_active` (boolean)
- `pause_support_ai` (boolean, default true) — enquanto o fluxo roda, a IA de Suporte não responde
- `only_first_contact` (boolean, default false) — opcional: só dispara em conversas novas
- `created_by`, timestamps

**`attendance_flow_steps`** — passos ordenados de cada fluxo
- `flow_id`, `position` (int)
- `type`: `text` | `audio` | `video` | `image` | `link` | `delay`
- `content` (texto da mensagem ou URL/legenda do link)
- `media_path` (storage path para áudio/vídeo/imagem enviados pelo admin)
- `media_url` (alternativa: URL externa direta)
- `delay_before_seconds` (int, default 0) — tempo a esperar **antes** desse passo
- `typing_indicator` (boolean, default true para `text`/`link`)
- `recording_indicator` (boolean, default true para `audio`)
- `caption` (legenda opcional para mídia)

**`attendance_flow_runs`** — execução em andamento por contato
- `flow_id`, `phone`, `current_step`, `status` (`running`|`done`|`canceled`|`error`)
- `next_run_at` (timestamp para agendamento)
- `last_error`, `started_at`, `finished_at`
- Único parcial: `(flow_id, phone)` enquanto `status='running'`

**Storage**: novo bucket privado `attendance-flow-media` (RLS: super admin escreve; edge function lê via service role).

## 2. Detecção do gatilho

No `supabase/functions/whatsapp-webhook/index.ts`, na branch da **conversa do sistema** (linhas ~273–342), antes de chamar `triggerSupportAI`:

1. Normalizar `content` recebido.
2. Buscar `attendance_flows` ativo com `trigger_text` correspondente.
3. Se houver match:
   - Cancelar/pular `triggerSupportAI`.
   - Se `pause_support_ai`, marcar `system_whatsapp_conversations.ai_active = false` para essa conversa.
   - Criar `attendance_flow_runs` (status `running`, `current_step = 0`, `next_run_at = now()`).
   - Disparar (fire-and-forget) a edge function `attendance-flow-dispatch`.

## 3. Execução do fluxo (edge functions)

**`attendance-flow-dispatch`** (verify_jwt = false, invocada pelo webhook e pelo cron)
- Pega o run, lê o passo atual.
- Se `delay_before_seconds > 0` e ainda não passou, atualiza `next_run_at` e sai (cron pega depois).
- Antes de enviar:
  - Se `type=text|link` e `typing_indicator`: chama Evolution `sendPresence` com `composing` por ~2-4s (proporcional ao tamanho do texto, com teto).
  - Se `type=audio` e `recording_indicator`: chama Evolution `sendPresence` com `recording`.
- Envia via WhatsApp do sistema (instância global, mesma rota usada por `support-ai-agent`):
  - `text`/`link`: `send-whatsapp-message` (sistema)
  - `audio`/`video`/`image`: `send-whatsapp-media` (sistema), passando base64 do storage ou URL
- Avança `current_step`. Se acabou, `status='done'`. Senão, agenda `next_run_at = now() + delay_before_seconds_do_próximo`.
- Importante: se o usuário responder antes do fluxo terminar, **não cancelamos** automaticamente (o admin escolhe via `pause_support_ai`); a IA de Suporte fica desligada até o run terminar.

**Cron (pg_cron)**: a cada 30s chama `attendance-flow-dispatch` para processar todos os runs `running` com `next_run_at <= now()`.

## 4. UI — `/admin/flows` (Construtor visual)

Item novo no `AdminSidebar` ("Fluxos de Atendimento", ícone `Workflow`).

**Tela lista**: tabela de fluxos (nome, gatilho, status, total de passos, ações: editar/duplicar/ativar/excluir) + botão "Novo Fluxo".

**Tela editor** (`/admin/flows/:id`):
- Cabeçalho: nome, descrição, **mensagem-gatilho**, switches (`Ativo`, `Pausar IA de Suporte`).
- **Canvas vertical de passos** (estilo Typebot simplificado):
  - Lista ordenável (drag-and-drop com `@dnd-kit`, já usado no CRM Kanban).
  - Cada passo é um card colorido por tipo, mostrando: ícone, prévia do conteúdo, delay e indicadores (digitando/gravando).
  - Botão `+` entre cards abre um menu para escolher o tipo do próximo passo: **Texto, Áudio, Vídeo, Imagem, Link, Tempo (delay puro)**.
- **Editor de cada tipo**:
  - Texto: `<Textarea>` + `delay_before_seconds` + switch "mostrar 'digitando…'".
  - Áudio: upload (.mp3/.ogg) → storage; campo opcional URL externa; `delay_before_seconds` + switch "mostrar 'gravando áudio…'".
  - Vídeo: upload (.mp4) ou URL + caption + delay.
  - Imagem: upload + caption + delay.
  - Link: texto da mensagem (com URL inline) + delay + switch "digitando".
  - Tempo: só `delay_before_seconds` (passo "espera pura").
- Botão **"Testar fluxo"**: campo para informar telefone + dispara um run imediato (insert em `attendance_flow_runs`, chama dispatch). Mostra log das últimas execuções desse fluxo (últimos 20 runs com status).

Acesso protegido por `super_admin` (mesmo padrão de `/admin/*`).

## 5. Indicadores "digitando" e "gravando" no WhatsApp

Evolution API expõe `POST /chat/sendPresence/{instance}` com `{ number, delay, presence: "composing" | "recording" }`. O dispatcher chama isso imediatamente antes do envio real, com delay proporcional ao conteúdo (texto: ~40ms por caractere, máx 6s; áudio: duração estimada do arquivo, máx 8s). Isso reproduz o comportamento natural do Typebot/WhatsApp.

## 6. Detalhes técnicos

- Tabelas com RLS `has_role(auth.uid(),'super_admin')`.
- Bucket `attendance-flow-media` com policy: leitura/escrita só super admin; service role acessa em background.
- Edge function `attendance-flow-dispatch`: `verify_jwt = false`, usa service role.
- Cron `pg_cron`: `select cron.schedule('attendance-flow-tick', '*/30 * * * * *', ...)` chamando `attendance-flow-dispatch` (sem payload — processa fila inteira).
- Reaproveita instância global de WhatsApp do sistema (`system_whatsapp_instance`) — mesmas helpers já usadas em `support-ai-agent`.
- Logs em `attendance_flow_runs.last_error` para debug.
- Match de gatilho: comparação normalizada (trim + lower + remove acentos) para tolerar variações de capitalização/espaço.

## 7. Entregáveis

1. Migração SQL: 3 tabelas + RLS + índices + bucket de storage + cron job.
2. Edge function `attendance-flow-dispatch` (+ `config.toml`).
3. Hook do webhook do sistema para disparar o fluxo no match.
4. Hooks React: `useAttendanceFlows`, `useAttendanceFlowSteps`, `useAttendanceFlowRuns`.
5. Páginas: `src/pages/admin/AdminFlows.tsx` (lista) e `src/pages/admin/AdminFlowEditor.tsx` (editor visual).
6. Item no `AdminSidebar` + rotas em `App.tsx`.

## 8. Fora do escopo desta entrega

- Ramificações condicionais (if/else, botões interativos, captura de variáveis). Estrutura linear primeiro; podemos evoluir para grafo depois sem migrar dados (basta adicionar `next_step_id` opcional).
- Disparar a partir do WhatsApp do **usuário final** (clientes dos clientes) — esta entrega é só no WhatsApp do sistema, conforme o caso de uso descrito (campanha do Theo IA).
