## O que aconteceu na conta marcioevandrocosta@hotmail.com

Verifiquei os números **5541985171405** (Regina) e **5546999147790** (Dulce). A mensagem repetida — *"O que acha de fazer seu cadastro? Só preciso da foto da sua fatura para iniciar o processo."* — foi enviada **a cada 1 minuto**, de 19/06 15:50 até 16:25 UTC, totalizando ~35 envios em cada conversa.

Não é só com essas duas. Levantei pela conta toda (`igreen_scenario_events`) e encontrei o mesmo padrão em pelo menos 6 contatos no mesmo dia, com até **320 envios duplicados em um único contato** (5588992540407):

| Contato | Envios em 19/06 |
|---|---|
| 5588992540407 | 320 |
| 5599992188592 | 316 |
| 5541985171405 (Regina) | 302 |
| 5571983459826 | 143 |
| 5551991962576 | 86 |
| 5546999147790 (Dulce) | 86 |

Todos os enrollments travaram no mesmo estado:
- `scenario = Cenário 1`
- `current_day = 7`
- `current_period = evening`
- `current_item_position = 0`
- `status = active`

## Causa raiz

A edge function `igreen-scenario-dispatcher` (rodada por `pg_cron` a cada 1 minuto) tem dois defeitos sérios:

### Bug 1 — Item de posição 0 é pulado e advanceToNext não conclui

Linha 233 do `index.ts`:
```ts
const nextItem = items.find((it) => it.position > (enrollment.current_item_position || 0))
                ?? (enrollment.current_item_position === 0 ? items[0] : null);
```

Quando `current_item_position = 0` (estado inicial de cada bloco), o `find(pos > 0)` **encontra direto a posição 1** e nunca usa o fallback. Resultado:

- O item da posição 0 ("Conseguiu ver o vídeo que te mandei…") **nunca é enviado**.
- Vai direto para a posição 1 ("O que acha de fazer seu cadastro…").
- Como não sobram itens após pos 1, o código chama `advanceToNext`. No dia 7 evening, como não existe `day_number > 7`, deveria marcar `status = pending_tag` ou `completed`.

Mas o estado atual dos enrollments mostra **`status = active`** e **`next_run_at` apontando para a manhã de amanhã** — sinal de que a transição final não persistiu corretamente em vários ciclos.

### Bug 2 — Cron sem lock + filtro por `next_run_at` permite reentrância

O cron dispara a função **a cada minuto**, mas a função não tem lock por enrollment. Quando uma execução demora (chamada para Evolution API lenta, instância recém-criada como a do consultoriafontoura, rate limit, etc.) e a próxima invocação roda em paralelo, ambas selecionam o mesmo enrollment pelo filtro `lte("next_run_at", nowIso)` **antes** do `UPDATE` da execução anterior ser confirmado. Cada invocação envia a mensagem e tenta atualizar, gerando duplicatas.

A presença de `MAX_ENROLLMENTS = 25` e ausência de `SELECT … FOR UPDATE SKIP LOCKED` torna isso possível em qualquer pico.

A combinação dos dois bugs explica perfeitamente o padrão observado: a mesma mensagem do dia 7 evening sendo enviada repetidamente a cada minuto até algo finalmente conseguir gravar o `next_run_at` de amanhã.

## Plano de correção

### 1. Corrigir `igreen-scenario-dispatcher/index.ts`

**a)** Trocar a lógica de seleção do próximo item por uma forma sem ambiguidade:
```ts
// Se o bloco ainda não enviou nada, manda position 0.
// Caso contrário, manda o próximo cuja position > current_item_position.
const nextItem = (enrollment.current_item_position == null
  || enrollment.last_sent_at == null
  || !items.some(it => it.position <= enrollment.current_item_position))
  ? items[0]
  : items.find(it => it.position > enrollment.current_item_position) ?? null;
```
Garante que a posição 0 seja enviada, e que o avanço por posição funcione corretamente.

**b)** Reservar o enrollment antes de enviar (lock otimista) para impedir reentrância:
```ts
// Empurra next_run_at para now + 5 min ANTES de enviar.
// Se a outra invocação chegar primeiro, o update afetará 0 linhas e nós pulamos.
const { data: claim } = await supabase
  .from("igreen_scenario_enrollments")
  .update({
    next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    updated_at: isoNow(),
  })
  .eq("id", enrollment.id)
  .eq("next_run_at", enrollment.next_run_at)   // CAS — só vence quem leu primeiro
  .select("id")
  .maybeSingle();
if (!claim) { skipped++; continue; }
```
Cada tick só processa enrollments que ele próprio conseguiu reservar; a outra invocação encontra `next_run_at` diferente do que leu e pula.

**c)** Garantir que toda saída de `advanceToNext` (inclusive os branches `completed` e `pending_tag`) atualize `last_sent_at` — hoje só dois branches atualizam, o que dificulta auditoria.

**d)** Garantir que, no branch `if (!nextDay)`, a query de `final_tag` use o `service_role` (já usa) e tenha `try/catch` próprio — se a leitura de `igreen_scenarios` falhar, hoje a exception sobe e o registro recai no catch externo que reagenda em +5 min, mantendo `status = active`. Em vez disso, reagendar em horário do dia útil seguinte.

### 2. Limpar enrollments hoje travados

Para os 6 enrollments listados acima (e qualquer outro do `Cenário 1` da conta com `current_day = 7`, `current_period = evening`, `status = active`), aplicar a finalização correta:

```sql
UPDATE igreen_scenario_enrollments
SET status = 'pending_tag',
    next_run_at = now() + interval '24 hours',
    current_item_position = 0,
    updated_at = now()
WHERE account_id = '3f304fb6-fd4e-46d0-9831-b23fabd37b7a'
  AND scenario_id = '829ad180-5e46-45e9-b26a-20d7d0ceaff7'
  AND status = 'active'
  AND current_day = 7
  AND current_period = 'evening';
```

Isso para imediatamente o ciclo, agenda a aplicação da tag final ("NAO PASSOU CENARIO 1") em 24h, e segue o caminho previsto pelo cenário.

### 3. Auditoria (opcional, recomendado)

Adicionar índice/checagem para flagar enrollments com mais de N envios no mesmo `(day_number, period)`:

```sql
SELECT enrollment_id, day_number, period, count(*) AS sends
FROM igreen_scenario_events
WHERE sent_at > now() - interval '1 day'
GROUP BY 1,2,3
HAVING count(*) > 3;
```
Pode virar uma query do painel admin ou um alerta diário.

## Resumo técnico

| # | Mudança | Arquivo |
|---|---------|---------|
| 1a | Lógica de seleção do próximo item (envia pos 0) | `supabase/functions/igreen-scenario-dispatcher/index.ts` |
| 1b | Lock otimista por CAS no `next_run_at` antes de enviar | mesmo |
| 1c | Padronizar `last_sent_at` em todos os branches de `advanceToNext` | mesmo |
| 1d | Try/catch interno em `advanceToNext` | mesmo |
| 2  | Migration de cleanup dos 6 enrollments travados | nova migration |
| 3  | Query de auditoria (opcional) | docs/admin |
