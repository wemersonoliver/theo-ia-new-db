## Objetivo

Reduzir bloqueios no WhatsApp simplificando o follow-up para **1 mensagem por dia** entre **08:00 e 19:00**, e adicionar **proteções inteligentes** que impedem envio quando o lead já tem agendamento ou demonstrou desinteresse — tudo via **tags automáticas no contato**.

---

## 1. Follow-up: 1 mensagem por dia (08:00–19:00)

### Mudanças
- **Janela única** das 08:00 às 19:00 (deixar de usar janelas separadas manhã/tarde).
- **1 mensagem por dia** durante 6 dias → sequência total passa de **12 para 6 steps**.
- Domingo continua bloqueado.
- A dedupe que já existe no `followup-dispatch` (1 msg por tracking/par por ciclo + gap mínimo) permanece.

### Onde mexer
- `supabase/functions/_followup-window.ts` — `generateScheduleSequence` passa a gerar 1 slot por dia (horário aleatório dentro de 08:00–19:00), e `isWithinWindow` valida janela única.
- `supabase/functions/followup-generate-sequence/index.ts` — `TOTAL_STEPS = 6`, e ajustar o prompt do Gemini para 6 mensagens (Dia 1: reabertura leve · Dia 2: rótulo + coerência · Dia 3: dor + prova social · Dia 4: solução + reciprocidade · Dia 5: escassez real · Dia 6: pergunta de saída).
- `src/components/followup/FollowupTab.tsx` (e/ou settings UI) — mostrar apenas a janela única 08:00–19:00 e remover controles de manhã/tarde.
- Defaults novos em `followup_config` na UI: `morning_window_start=08:00`, `evening_window_end=19:00`, demais campos ignorados.

> Não é necessária migration de schema — as colunas existentes continuam servindo, só passamos a usar `morning_window_start` como início e `evening_window_end` como fim do dia inteiro.

---

## 2. Tag automática "agendamento" → pausa follow-up

### Comportamento
- Sempre que um agendamento for **criado** ou **confirmado** para um contato, o sistema:
  1. Adiciona a tag **`agendamento`** ao `contacts.tags`.
  2. Cancela qualquer follow-up ativo daquele telefone (`cancel_followup_sequence`).
- Enquanto o contato tiver a tag `agendamento`, o `followup-check-inactive` **não cria** novo tracking.
- Quando o agendamento for finalizado/cancelado (ou marcado como concluído), a tag é removida automaticamente, liberando follow-up futuro.

### Onde mexer
- **Migration** (nova): função `public.tag_contact_appointment(_account_id, _phone, _add boolean)` que adiciona/remove a tag de forma segura no `contacts.tags` (e dispara `cancel_followup_sequence` quando adiciona).
- `supabase/functions/manage-appointment/index.ts` — após `create_appointment` e `confirm_appointment`, chamar a RPC para adicionar tag + cancelar follow-up. Após `cancel_appointment` / status concluído, chamar para remover.
- `supabase/functions/followup-check-inactive/index.ts` — antes de inserir tracking, ler `contacts.tags` do telefone e pular se contiver `agendamento` ou `sem-interesse` (ver item 3).

---

## 3. Tag "sem-interesse" / "encerrado" → impede follow-up permanentemente

### Comportamento
- Nova tool da IA: **`mark_lead_uninterested`** que adiciona a tag **`sem-interesse`** ao contato e cancela qualquer follow-up.
- A IA é instruída a chamá-la quando o cliente disser explicitamente que **não tem interesse**, **não quer mais**, **pediu para parar**, ou **encerrou o contato**.
- `followup-check-inactive` também pula qualquer contato com a tag `sem-interesse` (verificação adicionada no item 2).
- Tag pode ser removida manualmente no CRM se o cliente voltar.

### Onde mexer
- `supabase/functions/whatsapp-ai-agent/index.ts`:
  - Adicionar declaração da tool `mark_lead_uninterested` (parâmetro opcional `reason`).
  - Implementar handler que adiciona a tag via mesma RPC e chama `cancel_followup_sequence`.
  - Atualizar a parte do prompt de sistema com a regra "se o cliente pedir para parar / disser que não tem interesse, chame `mark_lead_uninterested`".
- (Opcional, fora deste plano se você preferir manter mínimo) detector simples por keywords no `followup-check-inactive` como fallback — **não incluído**, deixamos a decisão para a IA.

---

## 4. UI — visibilidade das tags

- Na página **CRM / Contatos** as tags já são exibidas. Apenas garantimos que `agendamento` e `sem-interesse` apareçam com cor diferenciada (badge verde / cinza) — alteração visual menor em `src/components/crm/DealCard.tsx` ou no chip de tags do contato.

---

## Detalhes técnicos (para referência)

### Diagrama do fluxo

```text
Agendamento criado/confirmado
        │
        ▼
manage-appointment ─► RPC tag_contact_appointment(add=true)
        │                    │
        │                    ├─ contacts.tags += 'agendamento'
        │                    └─ cancel_followup_sequence(phone)
        │
Lead diz "não quero mais"
        │
        ▼
whatsapp-ai-agent ─► tool mark_lead_uninterested
        │                    │
        │                    ├─ contacts.tags += 'sem-interesse'
        │                    └─ cancel_followup_sequence(phone)
        │
followup-check-inactive (cron)
        │
        └─► SKIP se contato tem 'agendamento' OU 'sem-interesse'
```

### Arquivos a editar
- `supabase/functions/_followup-window.ts`
- `supabase/functions/followup-generate-sequence/index.ts`
- `supabase/functions/followup-check-inactive/index.ts`
- `supabase/functions/manage-appointment/index.ts`
- `supabase/functions/whatsapp-ai-agent/index.ts`
- `src/components/followup/FollowupTab.tsx` (UI da janela única)
- Migration nova: função `tag_contact_appointment` + comentário documentando as tags reservadas (`agendamento`, `sem-interesse`).

### Backfill / impacto
- Trackings já em andamento continuam o ciclo antigo de 12 passos até esgotarem. Novos trackings já nascem com 6 passos.
- Nenhuma exclusão de dado — apenas mudanças de comportamento e novas tags.