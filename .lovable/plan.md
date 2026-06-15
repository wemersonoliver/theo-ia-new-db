## Objetivo
Substituir o início atual do atendimento da Conexão Green. Hoje a IA começa perguntando o nome do cliente (`ask_name`), depois explica, depois manda vídeo, depois faz `engage_check`. Vamos remover essa abertura por nome e enviar, no primeiro contato qualificado para Green, uma sequência fixa de 5 mensagens que termina pedindo o **estado** do cliente — entrando direto no funil de simulação.

## Mensagens novas (texto fixo, sem LLM)
1. `Olá! 👋 Seja muito bem-vindo(a)! É um prazer falar com você.`
2. `A energia por assinatura é uma forma simples de economizar na conta de luz sem precisar instalar placas solares ou fazer qualquer obra no seu imóvel. ☀️`
3. `Você continua recebendo energia normalmente da distribuidora da sua região, mas passa a aproveitar créditos de energia gerados por usinas parceiras, reduzindo o valor da sua fatura.`
4. `E o melhor: posso fazer uma simulação personalizada para mostrar quanto você pode economizar de verdade. 💰`
5. `Para isso, me informe apenas em qual estado você mora. Assim, consigo calcular uma estimativa da sua economia mensal e anual de forma mais precisa.`

Enviadas como 5 bolhas separadas no mesmo turno (split por `\n\n` ou retorno de `messages: string[]`).

## Mudanças técnicas

### 1. `supabase/functions/_igreen_v2/agents/green/stages.ts` — `decideGreenStage`
Reescrever o ramo `etapa === "novo"` e o início de `qualificacao` para:
- **Remover** a checagem `if (!extras.client_name) return "ask_name"`.
- **Remover** o uso de `send_video` / `engage_check` como passos obrigatórios da abertura (ficam disponíveis só se forem chamados por outro caminho; na prática deixam de ser acionados aqui).
- Novo fluxo:
  - se `!extras.greeted` → `greet` (vai entregar as 5 mensagens novas e já marca `greeted`, `explained`, `intro_sent` e promove `etapa_funil` para `qualificacao`)
  - depois cai direto em `ask_estado` (já está no prompt da mensagem 5)
  - se já tiver `estado` mas faltar `valor_fatura` → `ask_valor_fatura`
  - segue o fluxo atual: `present_distributors` → `ask_distribuidora` → `simulate_discount_concreto` → `confirm_signup` → `request_invoice`.

### 2. `supabase/functions/_igreen_v2/agents/green/run.ts` — bloco `stage === "greet"`
Substituir a marcação simples por entrega determinística da sequência:
- `deterministicText` (ou `messages: string[]`) com as 5 mensagens acima, separadas — usar o mesmo padrão de múltiplas bolhas já existente em outros stages (ex.: `simulate_discount_concreto`).
- `patch.produto = "green"`.
- `patch.etapa_funil = "qualificacao"`.
- `patch.extras = { ...currentExtras, greeted: true, explained: true, intro_sent: true, intro_sent_at: <iso>, atendimento_started: true }`.
- `tool_calls.push({ name: "set_product", args: { produto: "green" } })`.
- `tool_calls.push({ name: "add_contact_tag", args: { tag: "em atendimento" } })` (mantém o card movendo no CRM como hoje fazia o `engage_check`).
- **Não** enfileirar `send_discovery_video` aqui — vídeo fica desativado nessa nova abertura (decisão registrada no plano; pode ser reintroduzido depois manualmente em outro stage se quiserem).

### 3. Bloco `stage === "ask_name"` e `stage === "explain_solution"`
- Manter os blocos existindo (para não quebrar imports/refs e o `fallbackTextForStage`), mas eles deixam de ser alcançáveis pelo `decideGreenStage` na abertura padrão.
- Se quiser, podemos remover o bloco `ask_name` por completo num passo posterior — neste plano só desconectamos.

### 4. `engage_check`
- Continua existindo no código, mas o `decideGreenStage` não vai mais agendar `engage_check` após vídeo (já que não mandamos vídeo). Sem mudança extra necessária.

### 5. Captura oportunista do nome
- Como não vamos mais perguntar o nome, manter a captura passiva: se o cliente disser o nome em qualquer momento, o parser `extractFirstName` já popula `client_name` via `green_opportunistic_capture` (já existe). Sem mudança.

### 6. Supervisor / roteamento (`supabase/functions/_igreen_v2/supervisor/prompt.ts`)
- Nenhuma mudança. A regra atual ("oi", "tenho interesse" etc. → `qualifier`) continua válida. Só entra direto no Green quando o cliente cita explicitamente algo do produto (energia por assinatura, conta de luz, economizar na luz…), que é exatamente o gatilho pedido.

### 7. Migração SQL — destravar conversas em aberto
Para conversas que **já** estão paradas no antigo `ask_name`/`explain_solution`/`send_video` no estado `novo`, rodar:

```sql
UPDATE igreen_conversation_state
SET extras = jsonb_set(
  jsonb_set(
    COALESCE(extras, '{}'::jsonb),
    '{greeted}', 'true'::jsonb, true
  ),
  '{explained}', 'true'::jsonb, true
),
    etapa_funil = 'qualificacao'
WHERE produto = 'green'
  AND (etapa_funil IS NULL OR etapa_funil IN ('novo','qualificacao'))
  AND (extras->>'intro_sent') IS DISTINCT FROM 'true'
  AND (extras->>'estado') IS NULL;
```

(Opcional — só roda se você confirmar; sem isso, os leads antigos seguem onde estão.)

## Validação
- Teste manual com número novo escrevendo "tenho interesse em energia por assinatura" → IA deve enviar as 5 mensagens em sequência e parar aguardando o estado.
- Cliente responde "Bahia" → cai em `present_distributors` (Coelba/Neoenergia).
- Cliente escolhe distribuidora → pergunta valor da fatura → simulação concreta.
- Teste de regressão: handoff humano, soft_decline ("não", "esquece"), objection_security continuam funcionando (regras de prioridade no `decideGreenStage` permanecem intocadas).

## Arquivos tocados
- `supabase/functions/_igreen_v2/agents/green/stages.ts`
- `supabase/functions/_igreen_v2/agents/green/run.ts`
- (opcional) 1 migração SQL para destravar conversas antigas.
