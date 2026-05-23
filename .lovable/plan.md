## Diagnóstico aprofundado

Reproduzi o caso do Wemerson (22/05/26, 23:03). A sequência foi:

1. Cliente: "Moro no Pará" + "Equatorial" (entram juntas no turno por debounce).
2. IA chama `save_green_lead_field` com distribuidora=Equatorial — função executa OK.
3. Loop volta a chamar o Gemini para o próximo passo (que deveria ser: salvar o estado e/ou chamar `get_distributor_discount`).
4. Gemini devolve resposta vazia → cai no `EMPTY-RESPONSE FALLBACK` → manda "Perfeito, obrigado! 😊 / Pode me mandar sua próxima dúvida...".

Confirmado nos logs da edge `whatsapp-ai-agent` (uma única chamada de função, depois fallback neutro).

## Causa raiz

A configuração atual é:

- Modelo: `gemini-2.5-flash`
- `maxOutputTokens: 2048`
- **Thinking habilitado por padrão** (não é desligado no payload inicial)

O Gemini 2.5 Flash, quando recebe um turno que continua após `functionResponse`, costuma gastar **todo o orçamento de tokens em "thinking parts"** (parts com `thought: true`) e **não sobra orçamento para produzir o texto final ou a próxima `functionCall`**. O `finishReason` vira `MAX_TOKENS`, `content.parts` só tem thoughts, e o nosso filtro `usableParts` (que descarta thoughts) deixa o array vazio → cai no fallback.

Por isso o sintoma é "a IA perde o contexto a cada passo": não é perda real de contexto (o histórico é montado corretamente em `conversationMessages` e o `systemInstruction` é mantido) — é o **modelo silenciando** porque o thinking estourou o limite de saída.

Isso explica por que o problema migra de passo em passo: cada turno novo que segue um function call cai no mesmo padrão. O retry que adicionei antes ajuda em mensagens curtas/ambíguas, mas **não cobre o caso pós-function-call**, porque:
- Empilhar uma mensagem `user` ("responda em texto natural...") logo depois de um `functionResponse` (que também tem `role: user`) gera dois turnos `user` seguidos, o que confunde o Gemini e não resolve o token estourado.
- O retry só desliga o thinking na segunda tentativa — desperdiça uma chamada cara antes.

## Correção

Edição cirúrgica em `supabase/functions/whatsapp-ai-agent/index.ts`:

1. **Desligar o thinking por padrão** no `geminiPayload.generationConfig`:
   ```ts
   generationConfig: {
     temperature: 0.7,
     maxOutputTokens: 4096,
     thinkingConfig: { thinkingBudget: 0 },
   }
   ```
   Este é um agente conversacional com tools — não precisa de reasoning estendido. Desligar o thinking elimina a causa raiz do silêncio.

2. **Subir `maxOutputTokens` para 4096** (margem confortável para function calls + texto da resposta).

3. **Logar explicitamente `finishReason`** quando vier `MAX_TOKENS` para monitoramento futuro.

4. **Ajustar o retry de resposta vazia** para:
   - Não empilhar um turno `user` extra quando o último turno já é um `functionResponse` (evita dois `user` seguidos).
   - Apenas re-chamar o Gemini com `thinkingConfig.thinkingBudget: 0` reforçado e `maxOutputTokens: 4096` — sem injetar mensagem fake.

5. **Deploy explícito da função** após o ajuste para garantir que entre em produção (a correção anterior pode não estar ativa no momento da captura — o log "Empty AI response" do retry não apareceu).

## Validação

- Reabrir conversa real do Wemerson e enviar nova mensagem teste no fluxo Conexão Green (estado + distribuidora) para confirmar que a IA segue ao próximo passo (cálculo do desconto via `get_distributor_discount`) sem cair no fallback.
- Conferir logs: deve aparecer chamada da função e texto natural na mesma resposta, sem `EMPTY-RESPONSE FALLBACK`.
- Acompanhar 24h os logs de `[EMPTY-RESPONSE FALLBACK]` — deve cair próximo de zero.

## Detalhes técnicos

Arquivo: `supabase/functions/whatsapp-ai-agent/index.ts`
- Linhas ~1332-1336: `generationConfig` inicial.
- Linhas ~1372-1399: bloco do retry de resposta vazia.

Sem mudanças no frontend, schema, ou outras funções.
