# Corrigir disparos noturnos do iGreen Scenario Dispatcher

## Problema

A conta `marcioevandrocosta@hotmail.com` enviou mensagens de cenários (`sent_by: igreen_scenario`) às **23:15 BRT** para os contatos `5571983459826` e `5541985171405`. A causa é que o `igreen-scenario-dispatcher` **não respeita janela horária**, ao contrário do `followup-dispatch` clássico (08–19 BRT). Após o travamento do WhatsApp do usuário, o backlog foi disparado de madrugada — risco real de ban do número.

## Objetivo

Garantir que mensagens de cenários iGreen **só sejam enviadas entre 08:00 e 19:00 BRT, de segunda a sábado**, mesmo quando há backlog após reconexão ou quando o delay de um item cairia fora da janela.

## Mudanças em `supabase/functions/igreen-scenario-dispatcher/index.ts`

### 1. Reusar helpers de janela existentes
Importar `isWithinWindow` e `generateScheduleSequence` de `../_followup-window.ts` (já testados e usados pelo followup clássico). Janela padrão: `morning_window_start=08:00`, `evening_window_end=19:00`, bloqueia domingo.

### 2. Guard global no loop (antes de processar cada enrollment)
No início do `for (const enrollment of due)`, se `!isWithinWindow({})`:
- Reagendar `next_run_at` para o próximo slot válido via `generateScheduleSequence({}, 1)[0]`
- `skipped++` e `continue`
- **Não enviar nada fora da janela, ponto final.**

### 3. Clamp do `addDelay` para dentro da janela (linha 265)
Nova função `clampToWindow(target: Date): Date`:
- Converte `target` para BRT
- Se cair antes das 08:00 → move para 08:00 do mesmo dia
- Se cair depois das 19:00 → move para 08:00 + jitter do próximo dia útil
- Se cair em domingo → pula para segunda
- Retorna em UTC
Aplicar em todos os `next_run_at` calculados: linha 191 (instance disconnected), 231 (retry), 265 (próximo item do bundle), 281 (catch error), 327 (applyFinalTag retry), 399/449 (advanceToNext).

### 4. Corrigir `slotForPeriod` para nunca retornar passado
No final da função, se `result < new Date()`, recursar com `forDay = amanhã` (e pular domingo). Garante que backlog não dispare instantaneamente.

### 5. Cap de envios por run por contato
Adicionar `Set<string>` de `account_id:phone` já processados no run. Se o contato já recebeu uma mensagem neste tick, pular os demais enrollments do mesmo contato (defesa contra múltiplos enrollments simultâneos).

## Mudança no banco (migration)

Reagendar os enrollments ativos cujo `next_run_at` está no passado ou cairia fora da janela, para o próximo slot válido (amanhã 08:00–19:00 BRT, segunda a sábado). Isso limpa o backlog acumulado de TODOS os usuários, não só do Márcio.

```sql
UPDATE igreen_scenario_enrollments
SET next_run_at = (
  (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 day'
   + (interval '8 hours') + (random() * interval '11 hours'))
  AT TIME ZONE 'America/Sao_Paulo'
),
updated_at = now()
WHERE status IN ('active','pending_tag')
  AND (
    next_run_at < now()
    OR EXTRACT(HOUR FROM (next_run_at AT TIME ZONE 'America/Sao_Paulo')) NOT BETWEEN 8 AND 18
    OR EXTRACT(DOW  FROM (next_run_at AT TIME ZONE 'America/Sao_Paulo')) = 0
  );
```

## Não-mudanças

- Não mexo no `followup-dispatch` (já tem `isWithinWindow`).
- Não mexo no `whatsapp-ai-agent` — ele responde quando o cliente escreve, não dispara em massa.
- Não desativo cenários existentes; apenas atraso para a próxima janela válida.

## Verificação

1. Após o deploy, consultar `igreen_scenario_enrollments` dos dois números e confirmar que `next_run_at` está dentro de 08–19 BRT em dia útil.
2. Forçar uma chamada do dispatcher fora de janela e verificar nos logs que retorna `sent: 0, skipped: N>0`.
3. Acompanhar `igreen_scenario_events` por 24h para confirmar ausência de envios fora da janela.
