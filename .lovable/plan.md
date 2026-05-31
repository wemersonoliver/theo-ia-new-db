## O que encontrei no número de teste

No número `5547989118695`, o atendimento **não ficou parado por IA desativada**. A IA respondeu, mas o **roteiro do atendimento iGreen ainda está errado**:

- A saudação inicial foi genérica: `Olá! Como posso te ajudar hoje?`
- O atendimento pulou a coleta de nome.
- Quando chegou na etapa de vídeo, o sistema registrou internamente `video_sent=true` e `media_dispatched=discovery_video`, mas **não enviou um arquivo de vídeo real no WhatsApp**.
- Depois do `Ok`, o fluxo caiu em uma mensagem solta de engajamento, em vez de continuar uma sequência comercial clara.

Ou seja: a correção anterior ligou a IA, mas **não corrigiu o roteiro/automação do atendimento**.

## Causa principal

O fluxo atual está dividido em dois lugares:

1. `qualifier`: faz a primeira saudação e mostra menu.
2. `green`: continua o fluxo de economia de energia.

Hoje o `qualifier` está configurado para:

- saudar de forma aberta demais;
- não pedir o nome no início;
- apresentar menu antes de qualificar corretamente;
- apenas marcar o vídeo como enviado, sem mandar a mídia real.

Além disso, a automação `media-dispatch` hoje só registra no estado que o vídeo foi disparado. Ela **não chama a Evolution API para enviar o vídeo**.

## Plano de correção

### 1. Corrigir a saudação inicial

Alterar o primeiro atendimento para iniciar assim:

```text
Bom dia! Aqui é a Assistente Virtual da iGreen Energy. Com quem eu tenho o prazer de falar?
```

Ou com `Boa tarde` / `Boa noite`, conforme horário.

### 2. Pedir o nome antes de apresentar opções

Depois que o cliente informar o nome, o fluxo deve responder algo como:

```text
Prazer em falar com você, [nome]. Para eu te ajudar da melhor forma, me conta: você está buscando?

1 - Economia na conta de luz sem instalar nada
2 - Planos de telefonia e internet para seu telefone
3 - Como se tornar um Licenciado da iGreen
```

### 3. Ajustar o `qualifier` para não pular etapas

Modificar a decisão do `qualifier` para seguir esta ordem:

```text
1. Saudação + pedir nome
2. Capturar nome
3. Mostrar menu
4. Cliente escolhe opção
5. Direcionar para o especialista correto
```

### 4. Corrigir o envio do vídeo real

Atualizar a automação `media-dispatch` para, quando receber `discovery_video`, chamar a Evolution API e enviar uma mídia de vídeo de verdade.

Se o projeto ainda não tiver um arquivo/URL de vídeo configurado, vou deixar o envio dependente de uma variável/configuração segura, sem inventar mídia:

```text
IGREEN_DISCOVERY_VIDEO_URL
```

Se essa URL não existir, o sistema deve registrar erro claro nos logs em vez de fingir que enviou.

### 5. Ajustar o fluxo após o vídeo

Depois de enviar o vídeo, quando o cliente responder `Ok`, `Sim`, `assisti` ou similar, o atendimento deve avançar para a próxima etapa comercial, por exemplo:

```text
Perfeito, [nome]. Faz sentido pra você eu calcular uma estimativa de economia na sua conta de luz?
```

E depois seguir para consumo, estado, distribuidora e fatura.

### 6. Resetar apenas o número de teste

Para validar do zero, limpar o estado iGreen desse número de teste:

```text
5547989118695
```

Sem apagar o histórico visual da conversa, apenas o estado interno do fluxo iGreen, para que um novo teste comece corretamente.

## Resultado esperado

No próximo teste com esse número, a sequência deve ficar assim:

```text
Cliente: Olá
IA: Bom dia! Aqui é a Assistente Virtual da iGreen Energy. Com quem eu tenho o prazer de falar?

Cliente: Atlas
IA: Prazer em falar com você, Atlas. Para eu te ajudar da melhor forma, me conta: você está buscando? ...

Cliente: 1
IA: explicação curta sobre economia de energia

Cliente: Sim
IA: manda mensagem dizendo que vai enviar o vídeo
Sistema: envia o vídeo real

Cliente: Ok / assisti
IA: continua o fluxo de qualificação, sem voltar para saudação ou menu antigo
```

## Observação importante

A imagem que você enviou confirma exatamente isso: a IA está ativa, mas o atendimento ainda está usando o roteiro antigo/parcial e o “envio de vídeo” não está chegando como mídia no WhatsApp.