
# Implementação — Fluxo de Notificações de Trial

Cadência automática via WhatsApp do sistema, com 9 mensagens (3 antes do fim do trial + 6 após), copy persuasiva personalizada, e IA reativa quando o cliente responder.

---

## 1. Banco de Dados

### Tabela `trial_notification_config` (singleton, admin)
- `enabled` (bool, default true)
- `morning_window_start/end`, `evening_window_start/end` (text — janela horária respeitada)
- `discount_coupon_code` (text, default `VOLTA20`)
- `discount_percent` (int, default 20)
- 9 templates editáveis: `step_1_template` … `step_9_template` (text)
- `step_offsets` (jsonb) — defaults: `[-3,-2,-1,2,4,6,7,9,11]` (dias relativos ao fim do trial)
- timestamps

### Tabela `trial_notification_tracking`
- `id`, `account_id`, `owner_user_id`, `phone`
- `trial_ends_at` (timestamptz)
- `current_step` (int, default 0)
- `status` (`scheduled` | `paused_engaged` | `converted` | `handoff` | `exhausted`)
- `last_sent_at`, `next_scheduled_at`
- `business_context` (text — cache do `business_description` do card CRM)
- `engagement_data` (jsonb)
- timestamps

### Tabela `trial_notification_messages` (log)
- `id`, `tracking_id`, `phone`, `step` (1–9), `phase` (`pre`|`post`)
- `content` (texto final renderizado)
- `scheduled_at`, `sent_at`, `status` (`scheduled`|`sent`|`failed`|`skipped`)
- timestamp

### RPC `cancel_trial_notification(p_account_id, p_reason)`
Pausa/encerra o tracking e apaga mensagens futuras (status `converted` ou `handoff`).

RLS: somente `super_admin` lê config/tracking/messages. Edge functions usam service role.

---

## 2. Templates das 9 Mensagens (escolha do usuário, já com tom consultivo+provocativo)

Placeholders disponíveis: `{nome}`, `{business_context}`, `{link_checkout}`, `{cupom}`, `{desconto}`.

**Step 1 (D-3):**
> {nome}, faltam **3 dias** do seu teste. Nesse tempo, vi que clientes que ativam o agente IA economizam em média 4h/dia de atendimento. Posso te ajudar a deixar tudo redondo antes de acabar?

**Step 2 (D-2):**
> {nome}, faltam **2 dias** ⏰ Quem assina agora não perde nenhuma conversa nem agendamento — o Theo segue atendendo no piloto automático 24/7. Quer garantir? {link_checkout}

**Step 3 (D-1):**
> {nome}, último dia. Não quero te ver perder o que já configurou — IA, contatos, agendamentos. Renova em 1 clique: {link_checkout}

**Step 4 (D+2):**
> Oi {nome}, aqui é o Theo. Seu teste encerrou anteontem e percebi que você não assinou. Sem cobrança, juro 🙏 Mas queria muito te ouvir: **o que faltou pra você seguir com a gente?** Foi preço, alguma função, dificuldade na configuração? Sua resposta me ajuda a melhorar a plataforma.

**Step 5 (D+4):**
> {nome}, sabia que 7 em cada 10 clientes que testam o Theo voltam depois? Não é mágica — é porque o problema de "responder cliente fora do horário" não some sozinho. {link_checkout}

**Step 6 (D+6) — usa `{business_context}`:**
> {nome}, vi aqui que você atua com **{business_context}**. Especificamente pra esse modelo, o Theo costuma resolver: triagem inicial, envio de orçamento, confirmação de horário — sem você levantar o dedo. Vale uma segunda chance? {link_checkout}

**Step 7 (D+7) — meta-gancho:**
> {nome}, presta atenção: esta é minha 4ª mensagem. Você ainda não bloqueou, ainda não respondeu "para" — então alguma parte de você quer voltar. Estatística real: **metade das pessoas que recebem essa mensagem volta a conversar comigo**. E é exatamente isso que o Theo faz com seus leads parados. {link_checkout}

**Step 8 (D+9) — desconto:**
> {nome}, última cartada generosa: cupom de **{desconto}% off** no primeiro mês se assinar até amanhã. Código: **{cupom}**. {link_checkout}

**Step 9 (D+11) — fechamento (com ajuste pedido):**
> Beleza {nome}, vou parar de te incomodar um pouco 😄. Mas deixo registrado: enquanto seu concorrente automatiza, você responde no braço. Se mudar de ideia: {link_checkout} 🤝

---

## 3. Edge Functions

### 3.1 `trial-notification-scheduler` (cron a cada 30min)
- Varre owners de account em trial sem subscription ativa, não super_admin
- Calcula `trial_ends_at = profiles.created_at + (trial_days + trial_extra_days)`
- Para cada candidato sem tracking → cria tracking + agenda primeiro step elegível (D-3 em diante)
- Puxa `business_context` do `admin_crm_deals.business_description` (ou business_summary) do user
- Pula owner sem telefone E11 válido

### 3.2 `trial-notification-dispatch` (cron a cada 10min)
- Pega mensagens `scheduled_at <= now()` dentro da janela horária + system_whatsapp_instance conectada
- Antes de enviar, **revalida**:
  - subscription ainda inativa? (senão → `converted`, cancela tudo)
  - tracking não está `paused_engaged` ou `handoff`?
- Renderiza template substituindo placeholders (`buildCheckoutUrl` aponta para plano recomendado da tabela `plans`)
- Envia via Evolution API (instância sistema)
- Loga em `trial_notification_messages`, atualiza `current_step` + `next_scheduled_at` no tracking

### 3.3 Hook no `kiwify-webhook`
Ao confirmar pagamento, chama `cancel_trial_notification(account_id, 'converted')`.

### 3.4 Hook no `whatsapp-webhook` (instância sistema)
Quando chega mensagem entrante de telefone com tracking ativo:
- Marca tracking como `paused_engaged`
- Dispara `system-followup-ai` / `support-ai-agent` para responder
- IA continua o diálogo normalmente; se a resposta da IA detectar palavras-chave de handoff (`falar com humano`, `atendente`, `pessoa`, reclamação), marca tracking como `handoff` e notifica admins

> Decisão #4: depois que o cliente responde, a IA assume; só transfere se ela mesma sugerir.

---

## 4. Painel Admin — `/admin/trial-followup`

Novo item no sidebar admin com:
- **Card de configuração**: toggle global, janela horária, cupom/desconto, editor das 9 mensagens (textarea com placeholders)
- **Tabela de trackings ativos**: cliente, telefone, trial_ends_at, step atual, próximo envio, status, botão "Cancelar fluxo"
- **Métricas**: total disparado, % conversão por step, taxa de resposta

Hook novo: `useTrialNotificationAdmin` (config + trackings + métricas).

---

## 5. pg_cron

```sql
select cron.schedule('trial-notif-scheduler', '*/30 * * * *', $$ ... net.http_post ... $$);
select cron.schedule('trial-notif-dispatch',  '*/10 * * * *', $$ ... net.http_post ... $$);
```

---

## 6. Arquivos a criar/editar

**Migrations:**
- nova migration com as 3 tabelas + RPC + RLS + seed da config singleton com os 9 templates escolhidos

**Edge functions (novas):**
- `supabase/functions/trial-notification-scheduler/index.ts`
- `supabase/functions/trial-notification-dispatch/index.ts`

**Edge functions (editadas):**
- `supabase/functions/kiwify-webhook/index.ts` — chama RPC ao confirmar pagamento
- `supabase/functions/whatsapp-webhook/index.ts` (rota sistema) — pausa tracking + dispara IA

**Frontend:**
- `src/pages/admin/AdminTrialFollowup.tsx` (nova)
- `src/hooks/useTrialNotificationAdmin.ts` (novo)
- `src/components/admin/AdminSidebar.tsx` — adicionar item de menu
- `src/App.tsx` — adicionar rota `/admin/trial-followup`

**pg_cron:** inserts via insert tool após deploy das funções.

---

## 7. O que o usuário verá no fim

- Painel admin novo "Recuperação de Trial" mostrando todos os clientes em fluxo
- Mensagens disparando automaticamente nos timings D-3, D-2, D-1, D+2, D+4, D+6, D+7, D+9, D+11
- Se o cliente assina (Kiwify confirma) → fluxo encerra
- Se o cliente responde → IA continua a conversa, fluxo pausa
- Templates editáveis sem precisar mexer no código

Posso prosseguir com a implementação?
