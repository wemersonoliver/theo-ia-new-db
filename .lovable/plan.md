## Diagnóstico — conversa do Wemerson (5547989118695)

Reconstituí a conversa pelo banco. As falhas reais foram:

1. **Nome do cliente capturado errado no início.** O cliente abriu por áudio: *"Bom dia, me chamo Emerson."* A IA salvou o nome dele como **"Áudio"** / **"Atlas IA"** (o push name do WhatsApp), não como "Emerson". Daí para frente todo o atendimento ficou contaminado.
2. **IA alucinou o valor da fatura.** A conta era R$ 553,98, mas a IA disse "na sua conta de R$ 160 você pode economizar…".
3. **IA chamou o cliente de "Atlas"** porque o `contacts.name` ficou com o push name "Atlas IA" e nunca foi sobrescrito pelo nome real ("Emerson"/"Wemerson").
4. **Confusão "Emerson" vs "Wemerson".** O `namesMatch` exige 2 tokens em comum OU primeiro nome idêntico — "Emerson" e "Wemerson" não batem por causa da primeira letra. A IA entrou em loop de desculpas ("Me desculpe…", "Mil desculpas… falha na comunicação").
5. **Card parado em "Enviou fatura de energia".** Quando o cliente mandou a CNH, a IA **não chamou `validate_green_identity` nem `add_contact_tag('enviou documento')`**. Resultado: o deal não foi para "Enviou documento do titular", o handoff automático não rodou, a equipe não foi notificada, o follow-up não foi cancelado e a IA continuou ativa, apesar de ter dito "vou encaminhar para a equipe".

O motor de movimentação do CRM (`moveCRMDealByTag` + handoff em `enviou documento`) **funciona** — o que faltou foi a IA disparar a tool correta no momento certo, e o contato começar com o nome certo.

## O que vamos corrigir (sem mexer em UI nem em schema)

### 1. Extrair o nome real de frases tipo "Bom dia, me chamo Emerson"
Hoje qualquer texto vira candidato a nome. Vamos adicionar um **extrator de nome humano** que roda **antes** de salvar o nome em `contacts.name` ou em `igreen_lead_data.nome_cliente`:

- Remove saudações no começo: "bom dia", "boa tarde", "boa noite", "olá", "oi", "e aí", "tudo bem", "tudo bom".
- Remove introduções: "me chamo", "meu nome é", "sou o(a)", "aqui é o(a)", "pode me chamar de", "é o(a)".
- Remove pontuação/emoji do entorno.
- Aceita só se o restante tiver 1-3 palavras alfabéticas, sem números, e não estiver na blacklist (`audio`, `documento`, `atlas`, `ia`, `bot`, `cliente`, `whatsapp`, `teste`, etc.).
- Em transcrições de áudio (`[Áudio transcrito] ...`), aplica o extrator no texto transcrito, nunca na palavra "Áudio".

Esse extrator vai ser usado em todos os pontos onde hoje gravamos o nome do cliente (tanto no `whatsapp-ai-agent` quanto no fluxo Green via `save_green_lead_field`).

### 2. Sobrescrever push name genérico
Quando o `contacts.name` for um push name genérico (contém "IA"/"Bot"/"Atendimento", é igual ao display name da instância conectada, ou é literalmente "Áudio"/"Documento"/"Imagem"), o sistema substitui pelo nome extraído pelo extrator acima assim que ele aparecer pela primeira vez na conversa.

### 3. Forçar `validate_green_identity` quando chega documento depois da fatura validada
- Reforçar no prompt: se `igreen_lead_data.nome_titular_fatura` já existe e chega um anexo novo de documento (imagem/PDF que não é outra fatura), a IA é **obrigada** a chamar `validate_green_identity` antes de qualquer texto.
- Guarda no servidor: se a IA gerar resposta sem chamar a tool nesse cenário, o backend chama `validate_green_identity` automaticamente usando o OCR já extraído, e dispara `add_contact_tag('enviou documento')` se houver match — isso aciona o handoff, a notificação da equipe e o movimento do card.

### 4. Bloquear textos de "encaminhamento" sem handoff real
Pós-processamento da resposta da IA: se o texto contiver "vou encaminhar", "passar para a equipe", "consultor entrará em contato", "finalizar seu cadastro" e a tag `enviou documento` ainda não está presente, descartamos esse trecho e mantemos só a pergunta correta (pedido do documento certo OU o fluxo de validação).

### 5. Eliminar alucinação de valor da fatura
No prompt: proibir mencionar valores em reais que não tenham sido retornados por `validate_green_invoice` (`extracted_value`) ou `get_distributor_discount`. Se o valor não foi confirmado pela tool, falar de forma genérica ("posso simular sua economia depois").

### 6. Aceitar variações fonéticas "Emerson"/"Wemerson"
Relaxar `namesMatch`: além das regras atuais, considerar match quando um nome contém o outro como substring de pelo menos 5 caracteres. Isso evita rejeitar o cliente por apelido/aférese.

### 7. Anti-loop de desculpas
Detectar padrão "desculpa + desculpa" em dois turnos seguidos e suprimir a segunda — manter só uma frase curta de retomada.

## Detalhes técnicos

Arquivos afetados:

- `supabase/functions/whatsapp-ai-agent/index.ts`
  - `namesMatch`: relaxar para aceitar substring ≥ 5 chars.
  - `executeGreenFlowTool > validate_green_invoice` e `save_green_lead_field('nome_cliente')`: usar o extrator de nome e atualizar `contacts.name` quando o atual for push name genérico.
  - Após geração da resposta da IA e antes de enviar: guarda que (a) força `validate_green_identity` quando há OCR de documento + fatura já validada + tag ausente; (b) remove frases de encaminhamento órfãs; (c) suprime desculpas duplicadas.
  - System prompt: regras de proibição de valor não retornado por tool, obrigação da tool de identidade.

- `supabase/functions/_ai_system_prompt.ts`
  - Bloco novo de "captura de nome do cliente" com a regra de ignorar saudações/introdução.

- `supabase/functions/_person-name.ts`
  - Expandir `extractPersonName` para receber frases inteiras ("Bom dia, me chamo Emerson") e retornar só "Emerson". Adicionar "audio", "documento", "imagem", "atlas" à blacklist.

Nenhuma migração nova, nenhuma alteração de UI, nenhum schema novo.

## Validação

Após o deploy peço para você refazer o teste com o mesmo contato (já limpo). Confirmo no banco:
- `contacts.name` = "Emerson" (ou "Wemerson") logo após o primeiro áudio — nunca "Atlas IA", "Áudio" ou "Documento".
- `igreen_lead_data.nome_cliente` = "Emerson".
- `contacts.tags` contém `enviou fatura` e `enviou documento`.
- `crm_deals.stage_id` avança até "Atendimento Humano".
- `whatsapp_conversations.ai_active = false` após o handoff.
- Nenhuma mensagem da IA com "Mil desculpas… falha na comunicação" nem valor em reais inventado.
