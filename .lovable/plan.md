## Diagnóstico (confirmado no banco)

A instância WAHA da Débora está **conectada** e o cron `send-appointment-reminders` **está rodando** para ela. Dois lembretes de hoje (18:00) foram marcados como `reminder_sent=true` exatamente nos horários corretos (12:00 e 12:25 BRT — 6h antes). Ou seja: o disparador funciona.

O problema **não é o formato do telefone** — o WAHA aceita os números como estão (sem o 9). O que faz parecer "nada foi enviado" são duas coisas no código do `send-appointment-reminders`:

**1. Lembrete enviado nunca aparece no painel de Conversas.**
A função `saveMessageToConversation` só grava se a conversa **já existir**. Como quase todo lead de agendamento é primeiro contato, a conversa não existe → o lembrete é entregue no WhatsApp mas some do painel. Do lado da Débora, "não foi enviado".

**2. Nenhum log útil por atendimento.**
Existe só um `console.log` genérico de sucesso, sem chatId, sem resposta do WAHA, sem motivo de falha. Não dá para auditar quais lembretes realmente saíram.

## Correção (apenas `supabase/functions/send-appointment-reminders/index.ts`)

### Passo 1 — Upsert da conversa ao enviar lembrete
Trocar `saveMessageToConversation` por um upsert:
- Se a conversa existir → append no `messages[]` (como hoje).
- Se **não existir** → criar linha em `whatsapp_conversations` com `account_id`, `user_id`, `phone`, `contact_name` do appointment, `ai_active=true`, `messages=[<lembrete>]`, `total_messages=1`, `last_message_at=now()` e — quando o WAHA retornar — `wa_chat_id`.

Efeito: o lembrete sempre aparece no painel, e a resposta "SIM" do cliente cai no fluxo normal da IA.

### Passo 2 — Aproveitar o `wa_chat_id` retornado pelo WAHA
`sendWhatsAppText` já devolve `waChatId` no resultado. Salvar esse valor na conversa (novo campo ou update) para que os próximos envios/typing usem o chatId real (evita o WAHA errar por causa da tentativa de adicionar 9).

### Passo 3 — Log estruturado por appointment
Para cada agendamento processado, imprimir uma linha padronizada:
```
[reminder] apt=<id> user=<userId> phone=<original> result=<sent|waha-error:<status>> chatId=<retornado|null>
```
Sem essa linha hoje, não temos como confirmar entrega quando o cliente reclama.

### Passo 4 — Release da claim em falha real do WAHA (já existe, manter)
O comportamento atual de liberar `reminder_sent=false` quando `sendWhatsAppText` retorna `!ok` está correto. Apenas garantir que o log do Passo 3 imprima o status HTTP e o corpo do erro do WAHA.

## O que NÃO vou mudar

- **Nada de normalização de telefone** para WAHA. O WAHA aceita o número como veio (o próprio `sendWhatsAppText` já faz `check-exists` com as duas variantes BR internamente).
- **Nenhuma migração de banco**.
- **Nenhuma mudança no front**.
- **Nenhum outro helper WAHA/Evolution**.

## Como validar depois do deploy

1. Rodar `send-appointment-reminders` manualmente e conferir nos logs: cada appointment deve imprimir a linha `[reminder] apt=... result=...`.
2. Para os appointments futuros da Débora (07/20, 07/22, 07/23): quando o cron disparar 6h antes, a mensagem deve aparecer no painel de **Conversas** do lead — mesmo se for a primeira mensagem — e chegar no WhatsApp real.
3. Se algum não chegar, o log agora diz exatamente por quê (status do WAHA).
