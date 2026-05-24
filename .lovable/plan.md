## Problema observado

Pelo print:
1. A IA validou o documento, agradeceu ("Obrigado, Wemerson! Recebi seu documento.") e depois enviou um texto inventado ("Sua solicitação foi encaminhada para a equipe finalizar o cadastro…") — esse texto **não existe no código**, ou seja, a Gemini gerou livremente.
2. Como consequência, ela **não chamou `add_contact_tag("enviou documento")`** — então não rodou `notifyHandoff`, `applyRouletteOnHandoff` nem `moveCRMDealToHumanStage`. Nenhum atendente foi notificado pela roleta.
3. A mensagem final também está com a redação errada (fala em "equipe finalizar o cadastro"). Você quer que ela diga que a **IA vai iniciar as verificações e já retorna**.

A causa raiz é a mesma do bug da fatura: hoje, em `validate_green_identity` com `match=true`, o código apenas devolve uma `instruction` pedindo para a IA adicionar a tag. A Gemini frequentemente "esquece" e responde só com texto. Para a fatura nós já tornamos isso determinístico (`deterministicInvoiceReply` + tag automática) — falta fazer o mesmo para o documento.

## Solução

### 1. Tornar a validação de documento determinística (`whatsapp-ai-agent/index.ts`, bloco `validate_green_identity` com `match=true`)

Quando a tool valida o documento e os nomes batem, **executar imediatamente** dentro da própria tool todo o fluxo de encerramento, sem depender da IA:

- `upsertContactTag(accountId, phone, "enviou documento")`
- `moveCRMDealByTag(...)` para mover o card
- `claimHandoffNotification(...)` (idempotência)
- Se reivindicou:
  - Enviar a **mensagem de encerramento nova** via `sendAndSaveAIMessageParts`
  - `notifyHandoff(...)` (notifica contatos de notificação)
  - `applyRouletteOnHandoff(...)` (sorteia atendente e notifica pela roleta)
  - `moveCRMDealToHumanStage(...)`
  - `cancel_followup_sequence` RPC
- Retornar `instruction: "Handoff já disparado pelo sistema. NÃO escreva nada. Responda apenas com silêncio (string vazia)."` para evitar que a Gemini emita texto extra.

No loop principal de tools, tratar `handoff_triggered: true` retornado pela tool como sinal para **encerrar o turno** sem nova chamada à Gemini (já existe lógica parecida em volta da linha 1696 para `add_contact_tag` — basta replicar para `validate_green_identity`).

### 2. Nova mensagem de encerramento

Substituir o texto atual (linha 3177) e usar a mesma string nova no bloco novo de `validate_green_identity`. Proposta:

> "Perfeito! Recebi tudo certinho.
>
> Vou iniciar as verificações do seu cadastro e em instantes já retorno por aqui com a confirmação. 🙌"

(Dois blocos separados por linha em branco para virar duas mensagens curtas no WhatsApp, como o resto do fluxo.)

### 3. Reforço no prompt (`_igreen_flow.ts`, ETAPA 6)

Trocar a redação para deixar claro que, ao receber RG/CNH válido, a IA **só precisa chamar `validate_green_identity`** — o sistema cuida de tag, handoff, roleta e mensagem final. Ela **não deve** escrever nada depois da tool. Isso reduz a chance da Gemini gerar texto livre como o do print.

### 4. Verificação

- Conferir nos logs de `whatsapp-ai-agent` que após o próximo teste:
  - `validate_green_identity` retorna `handoff_triggered: true`
  - aparece log de `applyRouletteOnHandoff` com `assigned_user_id`
  - o atendente da roleta recebe a notificação pelo WhatsApp do sistema
  - o card vai para a etapa de humano

## Arquivos afetados

- `supabase/functions/whatsapp-ai-agent/index.ts` — bloco `validate_green_identity` + tratamento de `handoff_triggered` no loop de tools + atualização da string de encerramento (linha 3177).
- `supabase/functions/_igreen_flow.ts` — texto da ETAPA 6 reforçando que a IA não escreve nada após `validate_green_identity` com match=true.

Nenhuma migration de banco necessária.
