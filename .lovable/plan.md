# Correção dos lembretes de agendamento

## Diagnóstico (confirmado nos dados)

Agendamento do Rafael Batista (usuária Débora Colombo):
- `appointment_date = 2026-07-20` (segunda), `appointment_time = 10:00`
- `reminder_sent_at = 2026-07-19 20:00:01 UTC` → **17:00 BRT de domingo**

Config da Débora:
- `reminder_hours_before = 6`
- `business_hours = 00:00–23:59` (piso global do código força 08:00–19:00)
- Template personalizado com a palavra **"hoje" escrita fixa**, sem usar `{dia_referencia}`:
  > "Só passando pra lembrar da nossa sessão **hoje**, as {hora}…"

Causa real: o disparo em si estava correto (véspera, dentro da janela), mas o texto ficou errado porque o template escreve "hoje" hardcoded.

Fuso: `send-appointment-reminders` já converte para America/Sao_Paulo corretamente. `manage-appointment` grava data/hora como o usuário/IA informa (BRT wall-clock). Sem bug de fuso no dado gravado.

## Correções (valem para TODOS os usuários)

### 1. `supabase/functions/send-appointment-reminders/index.ts`

**a) Teto de 18:00 BRT para envios da véspera**
Introduzir constante `DAY_BEFORE_CEIL_MIN = 18 * 60`. No ramo `isTomorrow`, a `sendWindowStart` continua sendo `max(businessEndMinutes - 120, businessStartMinutes)` **mas** o `sendWindowEnd` passa a ser `min(businessEndMinutes, DAY_BEFORE_CEIL_MIN)`. Ou seja: lembretes enviados no dia anterior nunca saem depois das 18:00 BRT — inclusive aos domingos. No ramo `isToday`, o teto continua sendo o horário do agendamento (sem alteração).

**b) Domingo permanece habilitado**
Nenhum bloqueio por dia da semana. Domingo dispara normalmente, respeitando o teto das 18:00 quando for véspera.

**c) Normalizar palavras "hoje/amanhã" no texto final**
Antes de aplicar os placeholders, no template bruto:
- Se `isTomorrow`: substituir `\b(hoje)\b` (case-insensitive) por `amanhã`.
- Se `isToday`: substituir `\b(amanhã|amanha)\b` por `hoje`.
Assim, mesmo quem escreveu "hoje" fixo recebe o texto certo.

**d) Anexar linha de data real ao final da mensagem**
Sempre acrescentar `\n\n📅 {dia_semana}, DD/MM às HH:MM` com base em `apt.appointment_date` + `apt.appointment_time` formatados em BRT (`toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ })`). Elimina ambiguidade mesmo com template mal escrito.

**e) Novas variáveis no template**
`{dia_semana}`, `{data_br}` (DD/MM/AAAA), `{data_curta}` (DD/MM). Manter `{dia_referencia}`, `{data}`, `{hora}`, `{nome}`, `{titulo}` retrocompatíveis. Trocar `replace` por `replaceAll` para pegar múltiplas ocorrências.

**f) Log de contexto**
`[reminder] apt=… isToday=… isTomorrow=… weekday=… nowBRT=…` para auditoria.

### 2. `src/components/settings/RemindersTab.tsx`

- Atualizar o texto de ajuda listando as novas variáveis (`{dia_semana}`, `{data_br}`, `{data_curta}`).
- Mostrar **aviso amarelo** abaixo do textarea quando o template contiver `hoje`/`amanhã`/`amanha` soltas: *"Prefira usar {dia_referencia} — o sistema envia lembretes tanto no dia quanto na véspera; palavras fixas podem sair erradas."*
- Adicionar nota: *"Lembretes enviados no dia anterior ao agendamento são disparados no máximo até 18:00 (BRT)."*
- Atualizar o template default para incluir a linha de data ao final.

### 3. Migração pontual dos templates atuais (data fix)
UPDATE único em `whatsapp_ai_config`: apenas quando o template ainda **não** contém `{dia_referencia}`, substituir a palavra "hoje" solta pelo placeholder `{dia_referencia}`. Conserta silenciosamente os templates existentes (Débora incluída).

### 4. Fuso BRT — reforço defensivo
Nenhuma mudança de lógica em `manage-appointment` (dados gravados como wall-clock BRT). Adicionar comentário `// stored as BRT wall-clock` e centralizar helpers `fmtBrtDate` / `fmtBrtWeekday` no arquivo de lembretes para uso consistente.

## Detalhes técnicos

```text
Constantes de janela (BRT, minutos desde 00:00):
- GLOBAL_FLOOR_MIN     = 480   // 08:00 — piso já existente
- GLOBAL_CEIL_MIN      = 1140  // 19:00 — teto do dia do agendamento
- DAY_BEFORE_CEIL_MIN  = 1080  // 18:00 — NOVO teto quando enviado na véspera

Ordem de processamento por appointment:
1. Decidir shouldSendNow:
   - isToday    → janela [max(idealStart, businessStart), min(aptMinutes, businessEnd)]
   - isTomorrow → janela [max(businessEnd - 120, businessStart), min(businessEnd, DAY_BEFORE_CEIL_MIN)]
2. Normalizar hoje/amanhã no template bruto (regex \b + gi).
3. Substituir placeholders ({nome}, {hora}, {dia_referencia},
   {data}, {data_br}, {data_curta}, {dia_semana}, {titulo}).
4. Anexar linha final: "\n\n📅 {dia_semana}, DD/MM às HH:MM" (BRT).
```

## Como validar
- Débora recebe o próximo lembrete com o texto certo (migration corrige templates atuais).
- Todo lembrete traz a data real formatada no final.
- Envios da véspera (inclusive domingo) nunca ocorrem após 18:00 BRT.
- Fuso permanece BRT em todos os cálculos e formatações.
