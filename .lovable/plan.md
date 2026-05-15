
# Evolução do Follow-Up Personalizado — Sugestões 1 a 7

Vou entregar em **3 ondas**, do mais imediato (já dá valor sozinho) até o mais avançado.

---

## Onda 1 — Ativação no dia a dia (sugestões 1, 2, 7)

### 1. Disparo manual a partir de Conversas e CRM
- Botão **"Inscrever em fluxo"** dentro do drawer da conversa e dentro do `DealDetailsDrawer` do CRM.
- Modal escolhe o fluxo, mostra próximo envio previsto, e chama `custom-followup-enroll`.
- Em massa: na lista de Contatos, seleção múltipla → "Inscrever selecionados em fluxo".

### 2. Gatilhos por etapa do CRM e por finalização de atendimento
- Novos `trigger_type`: `crm_stage_enter`, `crm_stage_exit`, `conversation_finalized`.
- `trigger_config` guarda `pipeline_id`, `stage_id`, `outcome` (won/lost/abandoned).
- Hook em `useCRMDeals.move` e em `useFinalizeConversation` chama `custom-followup-enroll` com o motivo.
- UI: `FlowEditorDialog` ganha selects de pipeline/stage e checkboxes de outcome quando o trigger muda.

### 7. Calendário de feriados
- Nova tabela `custom_followup_holidays` (account_id, date, name) + seed opcional dos feriados nacionais BR.
- Toggle por fluxo: **"Pausar em feriados"** salvo em `window_config.skip_holidays`.
- Dispatcher consulta a tabela e reagenda para o próximo dia útil.
- UI: aba "Feriados" dentro de Fluxos Personalizados para CRUD da lista.

---

## Onda 2 — Inteligência de envio (sugestões 3, 6)

### 3. A/B testing de variantes por passo
- O campo `variants jsonb` já existe em `custom_followup_steps`. Estrutura:
  `[{ id, weight, content, media_url, media_mime, caption }]`.
- Editor do passo ganha aba **"Variantes A/B"** com pesos somando 100%.
- Dispatcher sorteia variante por peso, salva `variant_id` no registro da fila e em `custom_followup_enrollments.metadata.variants_sent` para análise.

### 6. Biblioteca de mídia reutilizável + import/export JSON
- Nova tabela `custom_followup_media_library` (account_id, name, type, url, mime, size, tags).
- `StepDialog` ganha duas opções: "Upload" (já existe) ou **"Escolher da biblioteca"**.
- Aba "Biblioteca" com grid de mídias (preview, busca por nome/tag, delete).
- Botões **Exportar** (gera JSON do fluxo + steps) e **Importar** (cria fluxo a partir de JSON, refaz upload das mídias se vierem como base64).

---

## Onda 3 — Observabilidade e integrações (sugestões 4, 5)

### 4. Métricas detalhadas
- Nova tabela `custom_followup_events` (enrollment_id, step_id, type [sent|delivered|read|replied|converted|opted_out|failed], variant_id, occurred_at).
- Dispatcher grava `sent`. Webhook do WhatsApp grava `delivered`/`read` (status=2/3) e `replied` (mensagem inbound).
- `useFinalizeConversation` com outcome=won grava `converted`.
- Dashboard por fluxo: enviados, taxa entrega, leitura, resposta, conversão, **comparativo entre variantes A/B**.
- Componente `FlowMetrics` com Recharts (barras + linha temporal).

### 5. Webhook de saída ao responder/converter
- Nova tabela `custom_followup_webhooks` (account_id, flow_id nullable, url, secret, events[], active).
- Edge function `custom-followup-webhook-dispatch` (assina HMAC-SHA256 com `secret`, retry 3x exponencial).
- Eventos: `enrolled`, `step_sent`, `replied`, `stopped`, `converted`.
- UI: aba "Webhooks" com CRUD, teste de envio e log das últimas 50 entregas.

---

## Detalhes técnicos relevantes (para o time técnico)

- Todas as novas tabelas seguem o padrão atual: `account_id`, RLS por `is_account_member`, service role para os dispatchers.
- Migrations separadas por onda — mais fácil reverter.
- Edge functions novas: `custom-followup-webhook-dispatch`. Reaproveitamos `custom-followup-enroll` para os novos triggers.
- `pg_cron` já roda o dispatcher a cada 1 min; nada novo a agendar.
- TypeScript: todos os novos jsonb tipados em `useCustomFollowup.ts`.

---

## Pergunta antes de começar

Posso seguir nessa ordem (Onda 1 → 2 → 3) entregando cada onda em uma resposta? Ou você prefere outra prioridade (ex.: começar pelas métricas)?
