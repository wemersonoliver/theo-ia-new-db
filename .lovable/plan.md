## Problema

Quando o cliente entra dizendo "Quero saber mais sobre a conexão green", o supervisor roteia direto para o green specialist (pulando o qualifier) e o green executa o stage `greet`, que apenas devolve "Olá, em que posso ajudar?" — pergunta redundante. Resultado: a IA não engata o fluxo nem coleta o nome do cliente (o nome só era coletado no qualifier).

## Solução

Tornar o green specialist auto-suficiente para começar do zero: quando entrar com `etapa_funil=null` e sem `client_name`, pedir o nome primeiro (substituindo o greet genérico) e só depois seguir para `explain_solution` → `send_video` → `ask_valor_fatura`.

## Mudanças

### 1. `supabase/functions/_igreen_v2/agents/green/stages.ts`

Na função `decideGreenStage`, no bloco `etapa === "novo"`:

- Adicionar coleta de nome como primeiro passo:
  ```
  if (etapa === "novo") {
    if (!extras.client_name) return "ask_name";   // NOVO — antes de qualquer coisa
    if (!extras.explained) return "explain_solution";
    if (extras.video_sent) return "ask_valor_fatura";
    return "send_video";
  }
  ```
- Remover a checagem `if (!extras.greeted) return "greet"` (não usaremos mais o stage `greet` redundante). O stage `greet` permanece no enum por compatibilidade mas deixa de ser acionado.

### 2. `supabase/functions/_igreen_v2/agents/green/prompt.ts`

Reescrever o prompt do stage `ask_name` para a primeira interação reconhecer o interesse do cliente:

> "STAGE: ask_name. Cliente acabou de se interessar pelo produto. Em 1 frase calorosa: cumprimente, agradeça o interesse e pergunte apenas como pode chamá-lo (primeiro nome). NÃO peça nome completo. NÃO peça CPF. NÃO peça mais nenhum dado. Máx 1-2 frases curtas."

### 3. `supabase/functions/_igreen_v2/agents/green/run.ts`

No bloco que trata o stage `ask_name`, garantir que:
- Tenta extrair nome da mensagem atual (reaproveitando `extractFirstName` do qualifier) — se a mensagem da vez já contiver um nome, salvar em `extras.client_name` via `save_green_lead_field` e fazer redecide para já avançar ao próximo stage.
- Setar `extras.greeted = true` e `produto = "green"` no patch (mantém compatibilidade com o resto do código que olha `greeted`).

Se o stage `ask_name` ainda não tiver bloco no `run.ts`, criar um bloco simples seguindo o padrão dos outros (`if (stage === "ask_name") { ... }`) com a lógica acima.

### 4. Testes/cenários (opcional, mas recomendado)

- `supabase/functions/_igreen_v2/testing/scenarios/index.ts` e `testing/assertions.ts`: atualizar/remover qualquer asserção que exigia a sequência `greet → explain_solution`. Agora a sequência é `ask_name → explain_solution → send_video → ask_valor_fatura`.

## Fluxo esperado após a mudança

1. Cliente: "Quero saber mais sobre a conexão green"
2. IA: "Que bom que você se interessou pela Conexão Green! Como posso te chamar?"
3. Cliente: "Thays"
4. IA: "Prazer, Thays! Com a Igreen você economiza na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Quer entender melhor?"
5. Cliente: "sim"
6. IA: envia vídeo + "te mandei um vídeo curtinho, me avisa quando assistir."
7. Cliente: "assisti"
8. IA: "Qual o valor médio da sua fatura mensal? Assim posso te mostrar quanto seria sua economia."

## Arquivos a alterar

- `supabase/functions/_igreen_v2/agents/green/stages.ts`
- `supabase/functions/_igreen_v2/agents/green/prompt.ts`
- `supabase/functions/_igreen_v2/agents/green/run.ts`
- (opcional) `supabase/functions/_igreen_v2/testing/scenarios/index.ts` e `testing/assertions.ts`

Nenhuma mudança de schema/migration necessária.