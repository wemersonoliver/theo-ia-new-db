## Diagnóstico (conversa 5571987620493 / Ilma)

State atual no banco:
```
estado: BA
distribuidora: "Bahia"     ← BUG: nome do estado salvo como distribuidora
distributors_options: ["Coelba","Neoenergia"]
distributors_presented: true
discount_min_percent: null
discount_max_percent: null  ← lookup falhou
signup_pitch_sent: true
valor_fatura: 500
```

O que aconteceu, em ordem:
1. Cliente disse "Bahia" respondendo ao stage `ask_estado`.
2. O parser salvou corretamente `estado: BA`, mas em paralelo o `ask_distribuidora` (executado no mesmo turno via burstLines / fallback de texto livre) aceitou a palavra "Bahia" como nome da distribuidora.
3. Como já tinha `distribuidora` preenchida, o fluxo pulou `present_distributors` (Coelba/Neoenergia) e foi direto pra `simulate_discount_concreto`.
4. O lookup em `igreen_distributor_discounts` não achou "Bahia" → caiu no fallback qualitativo: *"com a Bahia a iGreen tem uma faixa oficial de economia. Quer que eu já comece seu cadastro?"* — exatamente a mensagem que o cliente recebeu.
5. Cliente respondeu "nao" e depois "esquece". Nenhum dos dois bate no `SOFT_DECLINE_RX` (que só pega "não quero", "depois", "deixa pra lá", "obrigado"…). O fluxo voltou a `confirm_signup` e repetiu *"quer que eu já comece seu cadastro agora?"* duas vezes seguidas.

Ou seja: a IA não fez a simulação real porque salvou a distribuidora errada, e ficou forçando porque "não" puro e "esquece" não são reconhecidos como recusa.

## Correções propostas

### 1. Não confundir estado com distribuidora (`agents/green/run.ts`)
No bloco `ask_distribuidora`:
- Antes de chamar o fallback `extractDistribuidora`, rejeitar a mensagem se ela for um nome/UF de estado válido (reusar `extractEstado`).
- Rejeitar valores que coincidam com o `extras.estado` já salvo.
- Só salvar `distribuidora` no fallback livre se a string tiver pelo menos uma das palavras-chave conhecidas (lista de distribuidoras do estado, ou termos como "energia", "luz", "elétrica", "ceee", "cemig", etc.).

### 2. Garantir um único stage de coleta por turno (`agents/green/run.ts`)
Hoje os blocos `if (stage === "ask_estado")`, `if (stage === "ask_distribuidora")`, `if (stage === "ask_valor_fatura")` rodam em sequência sem checar qual é o stage selecionado. Trocar para `else if` (ou um único `switch (stage)`) para que a mesma mensagem nunca seja parseada como dois campos diferentes.

### 3. Forçar escolha real quando há lista de distribuidoras
Em `simulate_discount_concreto` (linhas 298 e 785): antes de usar `extras.distribuidora`, validar que o valor está presente em `extras.distributors_options` (case-insensitive). Se não estiver, **não** marcar `discount_lookup_done: true` — voltar para `ask_distribuidora` com a lista numerada novamente.

### 4. Reconhecer recusa curta (`agents/green/stages.ts`)
Ampliar `SOFT_DECLINE_RX` para também capturar:
- `nao`/`não` puro (mensagem inteira igual a "não", "n", "nope").
- `esquece`, `esquece isso`, `deixa pra lá`, `não precisa`, `chega`, `para`, `parar`, `desisto`.

Disparar `soft_close` no mesmo turno e marcar `extras.soft_closed = true` para travar novas tentativas de pitch.

### 5. Bloquear repetição literal do pitch de cadastro
No bloco `confirm_signup` do `run.ts`: se `extras.signup_pitch_sent === true` e o cliente respondeu negativamente (ou só silêncio/objeção), não repetir "quer que eu comece seu cadastro?". Pivotar para `soft_close` ou `objection_reply` conforme o caso, e marcar `extras.signup_declined_at`.

### 6. Limpar o estado quebrado do contato atual
SQL único para destravar a Ilma e permitir o reenvio da simulação correta:
```sql
UPDATE igreen_conversation_state
SET extras = extras - 'distribuidora' - 'discount_lookup_done'
                    - 'discount_min_percent' - 'discount_max_percent'
                    - 'signup_pitch_sent'
WHERE phone = '5571987620493';
```

## Validação
- Reexecutar manualmente o caso "Bahia / R$500": esperar a mensagem com Coelba/Neoenergia, depois a simulação concreta com percentual e R$ economizado.
- Mandar "não" e "esquece" em conversa de teste → IA deve agradecer e parar.
- Rodar o teste unitário de `decideGreenStage` adicionando casos: "Bahia" não vira distribuidora; "nao"/"esquece" disparam `soft_close`.

## Observações técnicas
Arquivos tocados: `supabase/functions/_igreen_v2/agents/green/run.ts` e `supabase/functions/_igreen_v2/agents/green/stages.ts`. Migração SQL apenas para limpar o state da conversa afetada (não altera schema).