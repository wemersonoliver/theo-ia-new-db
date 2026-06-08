## Objetivo
Após o vídeo de descoberta ser enviado pelo green specialist, agendar uma mensagem automática 2 minutos depois:

> O que achou, {primeiroNome}?
> Posso te mostrar qual seria sua economia mensal na prática?

Se o cliente responder antes dos 2 minutos, o cron cancela a mensagem (já é o comportamento atual da function `process-igreen-video-followups`). Quando o cliente finalmente responder, o supervisor → green specialist segue para o stage `ask_valor_fatura` perguntando o valor médio da fatura.

## Infraestrutura já existente (não precisa criar)
- Tabela `igreen_product_video_followups` (account_id, user_id, phone, message, scheduled_at, sent_at, cancelled_at, …)
- Edge function `process-igreen-video-followups` — varre pendências, cancela se cliente respondeu após `created_at`, senão envia via Evolution API e persiste no histórico.
- Cron `process-igreen-video-followups-every-minute` já ativo (`* * * * *`).

## Mudanças de código

### 1. `supabase/functions/_igreen_v2/tools/send-discovery-video.ts`
Adicionar a função auxiliar `scheduleVideoFollowup(account_id, phone, client_name)` e chamá-la logo após o `recordTransportEvent({ status: "sent" })` (somente no caminho de sucesso real do envio):

- Anti-dupe: se já existe linha em `igreen_product_video_followups` para (`account_id`, `phone`) criada nos últimos 30 minutos, não inserir outra.
- Resolve `user_id` a partir de `accounts.owner_user_id` (coluna `user_id` da tabela é NOT NULL). Se não houver `owner_user_id`, loga e pula sem quebrar o envio do vídeo.
- Pega o primeiro nome de `extras.client_name` (fallback `extras.nome_cliente`). Se vazio, usa "E aí, o que achou?" sem nome.
- `scheduled_at = now() + 2 min`.
- Mensagem: `O que achou, {nome}?\nPosso te mostrar qual seria sua economia mensal na prática?`.

Erros são apenas logados — nunca quebram a tool de envio do vídeo.

### 2. `supabase/functions/_igreen_v2/agents/green/prompt.ts`
O prompt do stage `ask_valor_fatura` (linha 80–81) já reconhece a mensagem anterior antes de perguntar o valor médio — funciona tanto se o cliente responder antes dos 2 min (à mensagem do vídeo) quanto se responder depois (à mensagem de follow-up). Nenhuma alteração necessária.

### 3. `supabase/functions/_igreen_v2/agents/green/stages.ts`
Sem mudança. O ramo `etapa === "novo"` já direciona para `ask_valor_fatura` assim que `extras.video_sent === true`.

### 4. `supabase/functions/process-igreen-video-followups/index.ts`
Sem mudança. Já cancela quando `repliedAfter > created_at` e já persiste a mensagem enviada em `whatsapp_conversations`.

## Migrations
Nenhuma — tabela, RLS e cron já existem.

## Fluxo resultante

```text
IA envia vídeo
   │
   ├── extras.video_sent = true
   └── insert igreen_product_video_followups (scheduled_at = now+2min)
                │
   ┌────────────┴─────────────┐
Cliente responde            Cliente fica
em < 2 min                  em silêncio
   │                            │
cron cancela                cron envia em ~2 min:
   │                        "O que achou, Wemerson?
   │                         Posso te mostrar qual seria
   │                         sua economia mensal na prática?"
   │                            │
   └──────────┬─────────────────┘
              ▼
   supervisor → green → ask_valor_fatura
   "Qual o valor médio da sua fatura mensal?"
```

## Arquivos alterados
- `supabase/functions/_igreen_v2/tools/send-discovery-video.ts` (única mudança real de código)
