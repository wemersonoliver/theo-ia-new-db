## Diagnóstico

A mensagem que chegou ao Theo às **01:15 da madrugada (BRT)** (`2026-06-19 04:15 UTC`) foi gerada pelo dispatcher `followup-ai` (assinatura `sent_by: "followup_ai"`). Ao analisar o código, encontrei dois bugs reais que afetam **qualquer conta** que use o follow-up clássico:

1. **`followup-ai/index.ts` não checa janela horária no envio.** Ele só pega `followup_tracking` com `next_scheduled_at <= now()` e despacha — diferente do `followup-dispatch` que já chama `isWithinWindow(config)` antes de enviar. Resultado: se o agendamento cair de madrugada (por bug ou backlog), o envio acontece sem barreira.

2. **`calculateNextSchedule` (em `followup-ai` e em `followup-check-inactive`) opera em UTC, não em BRT.** Faz `new Date().setHours(8, ...)` — ou seja, configura "08:00" no fuso do servidor (UTC). Como BRT = UTC−3, "08:00 UTC" cai às **05:00 da manhã em São Paulo**. Quando o passo da manhã é avançado a partir de um envio noturno, o próximo `next_scheduled_at` cai antes do amanhecer no Brasil. Também não bloqueia domingo.

A conta `consultoriafontoura@gmail.com` (Mexicomigo, plano emagrecimento) tem `followup_config` ativa com janela 08:00–12:00 e 13:00–19:00 BRT, mas o tracking foi reagendado em UTC e disparou de madrugada (já é a 2ª recorrência desse mesmo lead — mensagens em 17/06 e 19/06 todas com assinatura followup_ai).

## Mudanças no código

### 1. `supabase/functions/followup-ai/index.ts`

- Importar `isWithinWindow` e `generateScheduleSequence` de `../_followup-window.ts`.
- Logo após carregar `config` para cada `item` (após linha 364), checar `isWithinWindow(config)`. Se estiver **fora da janela**:
  - Reverter o "claim" reagendando `next_scheduled_at` para o **próximo slot válido em BRT** via `generateScheduleSequence(config, 1)[0]`.
  - Não enviar mensagem, não consumir o passo, `continue`.
- Substituir a função `calculateNextSchedule` (linhas 752–782) por uma versão BRT-aware:
  - Reaproveitar `generateScheduleSequence` quando possível, ou implementar o cálculo manualmente convertendo o "agora" para `America/Sao_Paulo` antes de aplicar `setHours`, gerando o slot em horário local BRT e devolvendo o UTC equivalente.
  - Pular domingo (`day === 0`) automaticamente.
  - Manter a regra de "manhã x tarde" (passos ímpares de manhã, pares à tarde) e o avanço de dia quando o passo atual foi à tarde.
  - Garantir que se o slot calculado cair no passado, avança 1 dia (já pulando domingo).

### 2. `supabase/functions/followup-check-inactive/index.ts`

- Substituir `calculateNextSchedule` (linhas 213–250) pela mesma lógica BRT-aware.
- Garantir que o primeiro agendamento de qualquer novo tracking só cai entre 08:00 e 19:00 BRT, segunda a sábado.

### 3. Nenhuma mudança em `followup-dispatch/index.ts`
Já chama `isWithinWindow(config)` e usa `generateScheduleSequence` corretamente.

## Mudanças no banco (via `supabase--insert`, sem migration)

São ações pontuais de **reagendamento de dados**, não alteração de schema:

- **Para todos os usuários:** todo `followup_tracking` com `status='pending'` cujo `next_scheduled_at` está no passado **ou** cairia fora da janela BRT (08–19h, seg–sáb), é empurrado para amanhã entre 08:00 e 19:00 BRT (jitter aleatório), pulando domingo. Isso limpa o backlog global que o cron pode disparar a qualquer momento.
- **Para o usuário `consultoriafontoura@gmail.com` e o contato `5547991293662`:** marcar o tracking corrente como `declined` (cancela o ciclo atual) — assim o lead não recebe a próxima rodada do follow-up até que uma nova janela de inatividade dispare naturalmente, agora já pelo código corrigido.

## Como verificar

1. Após o deploy, listar `followup_tracking` `pending` da conta `9f9b5baf-…-bd55-…` e confirmar que `next_scheduled_at` cai dentro de 08:00–19:00 BRT em dia útil.
2. Forçar uma chamada manual da função `followup-ai` fora da janela (ex.: agora à noite) e confirmar nos logs que retorna `processed: 0` com reagendamentos para o próximo slot válido.
3. Acompanhar `whatsapp_conversations` do telefone 5547991293662 por 48h e confirmar ausência de mensagens `sent_by:followup_ai` fora do horário comercial brasileiro.

## O que NÃO muda

- `followup-dispatch` (já correto).
- `igreen-scenario-dispatcher` (objeto de outro plano).
- `whatsapp-ai-agent` (responde quando o cliente escreve, não dispara em massa).
- Schema do banco — não há `CREATE TABLE`, `ALTER`, RLS ou migration. Apenas `UPDATE` de dados.
