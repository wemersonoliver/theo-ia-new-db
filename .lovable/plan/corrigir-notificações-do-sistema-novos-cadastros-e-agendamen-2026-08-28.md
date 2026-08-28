# Corrigir notificações do sistema (novos cadastros e agendamentos)

## O que está acontecendo

O WhatsApp de notificações do sistema (`theo_ia_system_notifications`) foi migrado para o provedor **WAHA** e está conectado — verifiquei no banco: `provider = waha`, `status = connected`.

Porém, várias funções de notificação ainda enviam as mensagens **direto pela Evolution API**, usando apenas o nome da instância. Como essa sessão não existe mais na Evolution, o envio falha silenciosamente (o erro só vai para o log) e ninguém recebe nada.

Isso explica os dois sintomas:

- **Novos usuários cadastrados**: a função de notificação busca os contatos corretos (Wemerson e Rafael, ambos ativos), monta a mensagem e tenta enviar pela Evolution → falha.
- **Notificação de agendamentos**: mesma coisa. A função de agendamentos prioriza a instância do sistema (que está conectada) e envia pela Evolution → falha. Para a cliente que reclamou, os contatos de notificação dela existem, mas a mensagem nunca sai.

## Correção

Trocar o envio direto pela Evolution pelo roteador de provedor já existente no projeto (`_wa_provider.ts`), que descobre sozinho se a instância é WAHA ou Evolution e usa as credenciais certas. Esse roteador já é usado com sucesso nas mensagens normais de WhatsApp.

Funções a ajustar:

1. **Notificação de novo usuário** — envio por provedor resolvido, com log claro de sucesso/erro por contato.
2. **Notificação de agendamento** (criação e reagendamento) — mesmo ajuste; mantém a regra atual: usa a instância do sistema quando conectada, senão cai para a instância do próprio usuário (que pode ser Evolution ou WAHA).
3. **Notificação de falha de API** — mesmo problema, mesmo ajuste.
4. **Notificações de transferência para humano (handoff)** — mesmo problema no agente de IA e no fluxo iGreen; ajustar junto para não sobrar caminho quebrado.

Também vou incluir tratamento de erro visível: quando o envio falhar, o motivo real do provedor fica registrado no log da função, em vez de falhar em silêncio.

## Detalhes técnicos

- Substituir `evolutionRequest(... /message/sendText/<instance> ...)` por `resolveInstanceContext(supabase, { system: true })` + `sendWhatsAppText(ctx, phone, message)`.
- Arquivos: `supabase/functions/notify-new-user/index.ts`, `supabase/functions/manage-appointment/index.ts` (`notifyAppointment`), `supabase/functions/notify-api-failure/index.ts`, `supabase/functions/whatsapp-ai-agent/index.ts` (3 pontos de notificação pelo sistema), `supabase/functions/_igreen_v2/automations/handoff.ts`.
- Manter o fallback para a instância do usuário em `notifyAppointment` via `resolveInstanceContext(supabase, { userId })`.
- Redeploy das funções alteradas.

## Verificação

- Disparar a notificação de novo usuário em teste e conferir nos logs `sent: 2/2`.
- Criar um agendamento de teste na conta que reclamou e confirmar a chegada da mensagem no número cadastrado em Notificações.
