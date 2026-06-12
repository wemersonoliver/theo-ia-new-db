
## Diagnóstico

Verifiquei a conversa do número `5594981030361` (conta `eng.rafaelamancio@gmail.com`). A IA escreveu "segunda-feira, dia 16 de junho", mas o cliente combinou para a próxima segunda — que é **15/06/2026**. O dia 16/06 é terça.

Esse erro não é exclusivo dessa conta; já apareceu em outras. A causa é estrutural, não de prompt do usuário.

### Por que isso acontece

No arquivo `supabase/functions/_ai_system_prompt.ts` (linha 86) o único contexto temporal que damos para o Gemini é:

```
Hoje é sexta-feira, 12 de junho de 2026 (2026-06-12).
Ao mencionar datas, converta para o formato YYYY-MM-DD para as funções.
Exemplos: "amanhã" = dia seguinte, "segunda" = próxima segunda-feira.
```

Ou seja, quando o cliente diz "segunda", o modelo precisa **fazer aritmética de calendário sozinho** (somar dias, virar mês, considerar bissexto, etc.). LLMs são comprovadamente ruins nisso e erram o número do dia com frequência — exatamente o que aconteceu aqui (somou +4 em vez de +3 a partir de sexta 12/06).

Além disso, mesmo quando a tool `create_appointment` é chamada com a data correta (`2026-06-15`), o **texto de confirmação** que vai para o cliente é gerado livremente pelo modelo a partir da memória dele, não do retorno da tool. Então o modelo pode salvar certo no banco e ainda assim escrever a data errada no WhatsApp.

## Plano de Correção

### 1. Injetar um calendário pré-computado no system prompt
Em `whatsapp-ai-agent/index.ts` (e nos outros pontos que chamam `buildAgentSystemPrompt`, como `test-ai-prompt` e `support-ai-agent`), gerar em código (BRT) uma tabela dos próximos 14 dias úteis e passar como novo campo `calendarBlock`:

```
CALENDÁRIO DE REFERÊNCIA (use SEMPRE estes valores, não calcule sozinho):
- hoje, sexta-feira: 2026-06-12
- amanhã, sábado: 2026-06-13
- domingo: 2026-06-14
- próxima segunda-feira: 2026-06-15
- próxima terça-feira: 2026-06-16
- próxima quarta-feira: 2026-06-17
- ... (14 dias)
```

Em `_ai_system_prompt.ts`, inserir esse bloco logo após "Hoje é..." e reforçar:

> "Ao mencionar uma data ao cliente, **copie literalmente** o dia/mês do CALENDÁRIO DE REFERÊNCIA. Nunca calcule de cabeça. Se a data desejada não estiver na lista, use `check_available_slots` antes."

### 2. Retornar texto de confirmação autoritativo na tool `create_appointment`
Em `executeFunction` (caso `create_appointment` e `reschedule_appointment`), além do `success: true`, retornar:

```json
{
  "success": true,
  "appointment_date": "2026-06-15",
  "appointment_time": "08:00",
  "weekday_pt": "segunda-feira",
  "date_pt": "15 de junho de 2026",
  "confirmation_hint": "Confirme ao cliente usando EXATAMENTE: 'segunda-feira, 15 de junho, às 08:00'."
}
```

E adicionar no prompt uma regra:
> "Ao confirmar um agendamento criado/reagendado, use EXATAMENTE o `confirmation_hint` retornado pela tool. Não reformule a data."

### 3. Mesma correção em `list_appointments` / `check_available_slots`
Já formatam data, mas garantir que o `weekday` venha do JS (`toLocaleDateString` com `timeZone: America/Sao_Paulo`), nunca do modelo.

### 4. Validação
- Rodar a `test-ai-prompt` simulando "quero agendar segunda" em datas variadas (sex, sáb, dom) e conferir o texto de confirmação.
- Conferir logs de `whatsapp-ai-agent` em 2-3 conversas reais após o deploy.

## Detalhes técnicos

Arquivos a alterar:
- `supabase/functions/_ai_system_prompt.ts` — novo campo `calendarBlock`, regra de "copiar literal".
- `supabase/functions/_igreen_flow.ts` (ou novo helper `_calendar.ts`) — função `buildCalendarBlock(today: Date): string` gerando 14 dias em BRT.
- `supabase/functions/whatsapp-ai-agent/index.ts` — montar `calendarBlock` e passar para `buildAgentSystemPrompt`; enriquecer o retorno de `create_appointment` / `reschedule_appointment` com `weekday_pt`, `date_pt`, `confirmation_hint`.
- `supabase/functions/test-ai-prompt/index.ts` e `supabase/functions/support-ai-agent/index.ts` — passar o mesmo `calendarBlock`.

Sem migrações de banco. Sem mudança de schema. Sem impacto em UI.
