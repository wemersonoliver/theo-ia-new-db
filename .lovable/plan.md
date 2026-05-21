
## Objetivo
Adicionar um fluxo guiado quando o cliente perguntar sobre **Conexão Green**, com saudação por horário de Brasília, envio automático do vídeo da reportagem da Globo, follow-up de 2 minutos e qualificação progressiva (distribuidora/estado → tipo/valor da conta → simulação baseada na base de conhecimento → pedido da fatura).

## Mudanças

### 1. Banco (`igreen_account_products`)
Adicionar 3 colunas:
- `video_url` (text) — URL pública do vídeo do produto
- `followup_after_video_seconds` (int, default 120)
- `followup_after_video_message` (text, default "Conseguiu ver, {nome}?")

Já preencho o produto **Conexão Green** com a URL do vídeo enviado.

### 2. Upload do vídeo
`reportagem_Globo.mp4` → bucket público `whatsapp-media` em `igreen-products/conexao-green-reportagem.mp4`.

### 3. Nova tool no agente: `send_product_video`
Parâmetros: `product_key` ("green", "telecom", "expansao").
Faz:
- Envia o vídeo via Evolution API (mediaMessage)
- Agenda uma mensagem de follow-up em `igreen_product_video_followups` (nova tabela: `account_id`, `phone`, `message`, `scheduled_at`, `sent_at`)

### 4. Worker de follow-up
Edge function `process-igreen-video-followups` rodando via **pg_cron a cada 1 minuto**:
- Lê follow-ups com `scheduled_at <= now()` e `sent_at IS NULL`
- Se o cliente já respondeu desde o envio do vídeo → marca como cancelado
- Caso contrário, envia a mensagem ("Conseguiu ver, {nome}?")

### 5. Prompt compartilhado (`_ai_system_prompt.ts`)
Acrescentar bloco específico quando o cliente mencionar Conexão Green:

```
SAUDAÇÃO (horário de Brasília passado em "Hoje é..."):
- 00–11h59 → "Bom dia"
- 12–17h59 → "Boa tarde"
- 18–23h59 → "Boa noite"

FLUXO CONEXÃO GREEN (siga em ordem, 1 turno por etapa):
1. "Bom dia, tudo bem? Me chamo {agent_name} da Conexão Green. Como posso te chamar?"
2. Após o nome → "Prazer em te conhecer, {nome}! A Conexão Green é nosso serviço de
   energia por assinatura que te dá desconto na conta de luz. Vou te mandar uma
   reportagem que explica como funciona." → CHAMAR send_product_video(product_key="green")
   (NÃO pergunte nada depois — o sistema agenda o follow-up de 2min)
3. Quando o cliente responder após o vídeo → perguntar distribuidora e estado.
4. Em seguida → "Sua conta é residencial ou comercial e qual o valor médio mensal?"
5. Calcule a economia usando APENAS o maior desconto válido para aquela
   distribuidora/estado na base [PRODUTO: Conexão Green]. Nunca invente percentuais.
6. Apresente a simulação + benefício do app de descontos + indicação que zera a conta
   + CTA: "Bora fazer seu cadastro? Só preciso da sua fatura de energia para iniciar."
```

Também passar a hora atual BRT (não só a data) no prompt para a IA escolher a saudação.

### 6. Simulador (`test-ai-prompt`)
- A tool `send_product_video` no simulador apenas retorna `{ success: true, simulated: true }` (não envia nada). A IA continua o fluxo normalmente.
- O follow-up de 2min **não roda** no simulador (é só atendimento real).

## Notas técnicas
- O vídeo será buscado pelo agente direto da coluna `video_url` do produto correspondente.
- Se o produto não tiver `video_url`, a tool retorna erro e a IA segue só com texto.
- O cancelamento do follow-up acontece quando chega QUALQUER mensagem do cliente em `whatsapp-webhook` após o envio do vídeo.
