## Análise da conversa com 5547989118695

### Linha do tempo observada

- O atendimento começou corretamente:
  - IA: pediu o nome.
  - Cliente: informou “Wemerson”.
  - IA: apresentou o menu.
  - Cliente: escolheu `1` economia de energia.

- O vídeo desta vez aparece registrado como mídia real:
  - Mensagem salva como `type: video`.
  - `media_url` aponta para um arquivo `.mp4` no Storage.
  - `provider_message_id`: `3EB01077229B80F54A6B83`.

- Depois do vídeo, o fluxo seguiu corretamente por um tempo:
  - Cliente: “Já vi”.
  - IA: perguntou se queria calcular economia.
  - Cliente informou valor `500`, estado `SC`, distribuidora `Celesc`.
  - IA pediu a fatura.

- O erro principal aconteceu depois que o cliente enviou a fatura:
  - Cliente enviou `[Documento]` às `02:47:45`.
  - O OCR leu o PDF com sucesso e extraiu conteúdo da Celesc.
  - Mesmo assim, a IA respondeu: “Assim que puder, é só me enviar a fatura...”
  - Depois, quando o cliente disse “Já mandei acima”, a IA repetiu a mesma ideia.

## Erros encontrados

### 1. O vídeo foi registrado como enviado, mas não há rastro em `igreen_transport_events`

Na conversa existe uma mensagem de vídeo com `provider_message_id`, então o envio parece ter ocorrido pela Evolution API.

Mas a tabela de eventos de transporte só registrou mensagens de texto; não há evento `kind: video` para esse envio.

Impacto:
- Fica difícil auditar se o vídeo foi realmente enviado pelo canal correto.
- A interface/histórico pode mostrar o vídeo, mas os logs operacionais não confirmam o transporte como mídia.
- Se a Evolution aceitar a chamada mas o WhatsApp falhar depois, o sistema não teria visibilidade suficiente.

### 2. O sistema não reconheceu a fatura enviada

O webhook recebeu o documento e a função de OCR processou o PDF:

```text
OCR result: Celesc Distribuição S.A.
DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
...
```

Porém:
- `igreen_document_validations` ficou vazio.
- `igreen_lead_data.fatura_url` continuou vazio.
- `igreen_conversation_state.document_status` continuou vazio.
- O estado final ficou em `etapa_funil: fatura_enviada`, mas sem registrar a fatura de fato.

Impacto:
- A IA continuou achando que ainda estava aguardando a fatura.
- Por isso respondeu incorretamente “me envie a fatura”, mesmo depois do documento já ter sido enviado.

### 3. O estágio `fatura_enviada` está sendo usado como se fosse “aguardando fatura”

O log mostra o especialista decidindo `stage: waiting_invoice` depois do documento já ter chegado.

Isso indica uma confusão de estado:
- O sistema marcou `etapa_funil: fatura_enviada` quando pediu a fatura.
- Mas esse nome sugere que a fatura já foi enviada.
- Na prática, ele está usando esse estado como “fatura solicitada / aguardando envio”.

Impacto:
- O agente não consegue diferenciar bem:
  - “pedi a fatura e estou aguardando”
  - “o cliente já enviou a fatura”
  - “a fatura foi processada/validada”

### 4. Duas respostas foram geradas muito próximas uma da outra

Quando o cliente enviou “Ok” e “Já mando”, a IA gerou duas respostas parecidas:

- “Beleza, Wemerson! Assim que puder...”
- “Ok, Wemerson! Fico aguardando...”

Um dos logs mostra `transport.delivered: false` com `lock_acquired: false`, mas a mensagem aparece no histórico, indicando disputa/concorrência entre processamentos.

Impacto:
- Pode causar respostas duplicadas ou fora de ordem.
- Pode dar impressão de que o atendimento está “reiniciando” ou ignorando mensagens recentes.

### 5. A resposta “Já mandei acima” foi classificada como baixa confiança

Depois que o cliente disse que já havia mandado a fatura, o supervisor classificou como:

```text
intent: other
specialist: green
confidence: 0
source: low_confidence_sticky
```

Impacto:
- O sistema não entendeu que o cliente estava corrigindo a IA.
- Ele deveria consultar o histórico recente, detectar o documento anterior e avançar para análise, não pedir o documento novamente.

## Diagnóstico resumido

O problema atual não é mais a saudação inicial, nem o menu, nem necessariamente o upload do vídeo. O erro crítico agora está na etapa da fatura/documento:

```text
Documento recebido -> OCR processa -> estado do lead não é atualizado -> IA continua aguardando documento
```

Além disso, o envio de vídeo precisa ganhar auditoria completa em `igreen_transport_events` para não ficarmos dependentes apenas do histórico da conversa.

## Plano de correção

### 1. Corrigir o estado da etapa de fatura

Separar claramente os estados do funil:

```text
invoice_requested       = IA pediu a fatura e está aguardando
invoice_received        = cliente enviou documento/foto/PDF
invoice_ocr_processed   = OCR leu o documento
invoice_validated       = documento reconhecido como fatura válida
invoice_needs_review    = OCR leu, mas precisa confirmação humana/cliente
```

A correção deve evitar usar `fatura_enviada` como estado ambíguo.

### 2. Atualizar estado e lead quando chegar documento/foto

Quando o webhook receber mídia do tipo documento ou imagem desse contato, o fluxo iGreen deve:

- salvar a URL em `igreen_lead_data.fatura_url`;
- marcar `document_status` como recebido/processado;
- registrar evento em `igreen_state_events`;
- criar registro em `igreen_document_validations` quando houver OCR;
- avançar o funil para análise da fatura.

### 3. Fazer a IA reconhecer “já mandei”, “enviei acima”, “mandei a fatura”

Se o cliente disser algo como:

```text
já mandei
mande acima
enviei
já enviei a fatura
```

O agente deve checar se existe documento/imagem recente na conversa.

Se existir, responder seguindo a análise:

```text
Vi sim, Wemerson. Já recebi sua fatura e estou analisando as informações principais.
```

Em vez de pedir a fatura novamente.

### 4. Conectar o resultado do OCR ao fluxo iGreen

O OCR já está funcionando. A correção deve integrar o resultado dele ao estado iGreen:

- detectar distribuidora no texto extraído;
- detectar se é conta de energia;
- guardar trecho/resultado processado;
- marcar fatura como recebida;
- deixar o especialista `green` continuar com validação ou próxima pergunta.

### 5. Melhorar concorrência para evitar respostas duplicadas

Ajustar o processamento pendente para não responder duas vezes quando o cliente manda mensagens em sequência curta, como “Ok” + “Já mando”.

Critério esperado:
- considerar sempre a mensagem mais recente do cliente;
- não enviar resposta se outro processamento já respondeu aquele bloco de mensagens;
- respeitar o lock antes de persistir resposta no histórico.

### 6. Registrar envio de vídeo também em eventos de transporte

Quando o vídeo for enviado pela Evolution API, além de gravar em `whatsapp_conversations`, registrar também em `igreen_transport_events` com:

```text
kind: video
status: sent ou failed
provider_message_id
media_url
correlation_id
```

Assim conseguimos confirmar tecnicamente o envio da mídia.

### 7. Validar com novo teste no número 5547989118695

Após corrigir, resetar apenas o estado interno iGreen desse número e testar a sequência:

```text
Olá
Nome
1
Sim
vídeo enviado
Já vi
500
SC
Celesc
enviar PDF/foto da fatura
IA reconhece a fatura e avança
```

Resultado esperado:
- vídeo aparece como mídia e com evento de transporte;
- fatura enviada atualiza o estado do lead;
- OCR alimenta o fluxo;
- IA não pede novamente uma fatura já enviada;
- respostas duplicadas são evitadas.