## Diagnóstico da última conversa — 5547989118695

Na conversa de 31/05, encontrei estes pontos principais:

1. **O vídeo foi enviado duas vezes**
   - Primeiro envio: `04:20:15`.
   - Segundo envio: `04:20:23`.
   - Causa: existem dois caminhos enviando o mesmo vídeo:
     - a tool `send_discovery_video` envia o vídeo;
     - depois o evento `discovery_video_sent` aciona a automação `media-dispatch`, que envia o mesmo vídeo novamente.

2. **O vídeo saiu antes do texto explicativo**
   - A função executa tools antes de enviar as mensagens de texto.
   - Como `send_discovery_video` é uma tool, o vídeo foi disparado antes do texto:
     - vídeo;
     - vídeo duplicado;
     - texto “Que ótimo seu interesse...”;
     - texto “Vou te enviar um vídeo...”.

3. **A IA repetiu perguntas**
   - O cliente informou “Média de 500 reais”.
   - O sistema salvou isso como `consumo_medio`, mas não aproveitou como `valor_fatura`.
   - Depois perguntou novamente o valor da conta.
   - Quando o cliente respondeu “Média de 500”, o fluxo avançou internamente, mas o texto gerado voltou a perguntar a distribuidora, mesmo ela já estando salva como `Celesc`.
   - Causa técnica: o avanço automático após capturar `valor_fatura` não está preparado para gerar a simulação determinística no mesmo turno.

4. **O card não saiu de “Novo Lead”**
   - O card está na etapa `Novo Lead` do pipeline `Vendas`.
   - A V2 não move o card quando adiciona tag.
   - A tool `add_contact_tag` apenas marca a tag nos extras do estado.
   - A automação `tagging` hoje só atualiza tags do contato, mas não move o card para a etapa correspondente.
   - Além disso, no stage `engage_check`, quando o cliente responde depois do vídeo, a V2 ainda não chama a tag `em atendimento`.

---

## Plano de correção

### 1. Fazer o texto sair antes do vídeo

Ajustar o pipeline da função `whatsapp-igreen-agent-v2` para que o envio do vídeo de descoberta aconteça **depois** do texto do turno.

Fluxo esperado após escolher opção 1:

```text
IA: Que ótimo seu interesse na Conexão Green, Wemerson! 😊
IA: É a nossa solução de energia por assinatura...
IA: Vou te enviar um vídeo rápido explicando como funciona. Me avisa quando assistir, tá? 😉
IA envia o vídeo
```

Implementação:
- Separar `send_discovery_video` das tools executadas antes do texto.
- Executar essa tool somente depois que o transporte de texto terminar.
- Manter `set_product` e `set_stage` antes do texto, pois são apenas estado interno.

Arquivos envolvidos:
- `supabase/functions/whatsapp-igreen-agent-v2/index.ts`
- `supabase/functions/_igreen_v2/agents/qualifier/run.ts`

---

### 2. Eliminar a duplicidade do vídeo

Remover o segundo caminho de envio.

Implementação:
- A tool `send_discovery_video` será o único caminho autorizado para enviar o vídeo de descoberta.
- A automação `media-dispatch` não deve mais ser acionada por `discovery_video_sent`.
- O evento `discovery_video_sent` continuará existindo apenas como registro/log, não como gatilho para reenviar mídia.

Também vou reforçar a proteção anti-duplicidade:
- Antes de enviar, verificar vídeos recentes no histórico da conversa e/ou eventos de transporte.
- Corrigir o registro de `igreen_transport_events` para vídeo, porque hoje ele pode falhar silenciosamente por conflito de `correlation_id + chunk_index` com os textos do mesmo turno.
- Registrar vídeo com chave própria, por exemplo `correlation_id:video`, evitando colisão com os chunks de texto.

Arquivos envolvidos:
- `supabase/functions/_igreen_v2/automation-router/dispatch.ts`
- `supabase/functions/_igreen_v2/tools/send-discovery-video.ts`

---

### 3. Corrigir repetição de perguntas e aproveitar respostas já dadas

Ajustar a captura de dados no fluxo Green.

Regras novas:
- Se o cliente responder algo como `500 reais`, `média de 500`, `R$ 500`, isso deve preencher `valor_fatura`.
- Se a resposta estiver em reais, não tratar apenas como `consumo_medio`.
- Se `valor_fatura` já existe, não perguntar o valor de novo.
- Se `estado`, `distribuidora` e `valor_fatura` já existem, gerar imediatamente a simulação concreta.
- Nunca voltar a perguntar a distribuidora se ela já foi confirmada.

Fluxo esperado neste teste:

```text
Cliente: Bem legal
IA: Que bom, Wemerson. Para eu calcular melhor, em qual estado você está?
Cliente: SC
IA: No seu estado trabalhamos com a Celesc. Essa é a sua distribuidora atual?
Cliente: Sim
IA: Olha só, Wemerson! Pra Celesc a média de desconto fica entre X% e Y%...
IA: Bora fazer seu cadastro agora? Pra iniciar, só preciso de uma foto ou PDF da sua fatura.
```

Se o valor já tiver sido informado antes, a IA pula a pergunta de valor.

Arquivos envolvidos:
- `supabase/functions/_igreen_v2/agents/green/stages.ts`
- `supabase/functions/_igreen_v2/agents/green/run.ts`
- `supabase/functions/_igreen_v2/agents/green/prompt.ts`

---

### 4. Mover o card para “Iniciou atendimento” após resposta pós-vídeo

Criar o comportamento solicitado:

> Depois de uma resposta do cliente após receber o vídeo, o card deve sair de “Novo Lead” e ir para “Iniciou atendimento”.

Implementação:
- No stage `engage_check`, quando o cliente responder depois do vídeo, chamar `add_contact_tag` com tag `em atendimento`.
- Fazer a automação de tagging mover o card no CRM.
- Usar primeiro a configuração já existente em `crm_tag_automations`.
- Se não encontrar configuração, usar fallback pelo nome da etapa:
  - `em atendimento` → `Iniciou atendimento`
  - `enviou fatura` → `Enviou fatura de energia`
  - `enviou documento` → `Enviou documento do titular`

Arquivos envolvidos:
- `supabase/functions/_igreen_v2/agents/green/run.ts`
- `supabase/functions/_igreen_v2/automation-router/dispatch.ts`
- `supabase/functions/_igreen_v2/automations/tagging.ts`

---

### 5. Corrigir a automação que fica travada como `running`

Foi encontrado registro em `igreen_automation_executions` com status `running` para `media-dispatch`.

Isso acontece porque o helper de idempotência reserva a execução, mas não atualiza o resultado final depois que termina.

Implementação:
- Atualizar `withIdempotency` para gravar o resultado final:
  - `success`
  - `skipped`
  - `error`
  - horário final
- Isso melhora a depuração e evita automações aparentemente presas.

Arquivo envolvido:
- `supabase/functions/_igreen_v2/automations/_idempotency.ts`

---

### 6. Resetar o teste do número 5547989118695 após aplicar os ajustes

Depois dos ajustes, limpar o estado de teste do número para validar do zero:

- estado da conversa Green;
- eventos/locks de automação desse telefone;
- dados temporários do lead;
- manter a conversa visível, mas remover bloqueios que poderiam impedir novo teste.

Também posso mover manualmente o card atual para a etapa correta depois da correção, se você quiser validar esse atendimento já existente.

---

## Resultado esperado após implementar

No próximo teste:

1. Cliente escolhe `1`.
2. IA envia primeiro o texto correto.
3. Depois envia apenas **um** vídeo.
4. Quando o cliente responder depois do vídeo, o card move para `Iniciou atendimento`.
5. A IA não repete valor/distribuidora se já tiver os dados.
6. Ao ter estado + distribuidora + valor, ela envia a simulação concreta e pede a fatura.
7. Os logs deixam claro quem enviou o vídeo, quando enviou e por que não reenviou.