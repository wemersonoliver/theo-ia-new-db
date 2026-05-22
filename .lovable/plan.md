## Diagnóstico do atendimento 5547991293662

Conversa de 22/05 03:49–03:55:

1. **Tempo pós-vídeo muito longo:** vídeo enviado às 03:50:01, próxima mensagem ("O que achou…") só às 03:53:03 — 3 min. Hoje `igreen_account_products.followup_after_video_seconds = 120` (padrão) e nessa account está em 120s+atrasos. Você quer **50s**.

2. **Cliente perguntou "o que precisa?" e a IA respondeu com outra pergunta** ("Posso te mostrar quanto você economizaria?"). O prompt manda perguntar antes da simulação. Falta regra: quando o cliente faz uma pergunta direta ("o que precisa", "como funciona", "como faço"), responder diretamente o próximo passo (qualificação curta) sem devolver outra pergunta retórica.

3. **"Equatorial / Pará / Residencial / R$ 500" → IA respondeu "vou verificar com a equipe".** Causa raiz: o helper determinístico `buildGreenSimulationReply` (`_igreen_flow.ts`) busca o desconto fazendo regex em cima do texto bruto da base de conhecimento (`findDiscountPercentage`). Se o documento da KB não tem o cabeçalho "Equatorial (PA)" no formato esperado, retorna `null` e o modelo cai no fallback "confirmar com a equipe". É frágil por design — depende do PDF estar formatado certo e do RAG por palavra-chave devolver o trecho.

## Solução definitiva: tabela estruturada de descontos

Parar de depender de regex sobre PDF. Criar fonte de verdade estruturada.

### 1. Tempo do follow-up pós-vídeo → 50s

- Migração: `UPDATE igreen_account_products SET followup_after_video_seconds = 50 WHERE key = 'green' AND followup_after_video_seconds = 120;`
- Mudar o default da coluna para 50.
- (Opcional) Mostrar campo já existente na UI de produtos Igreen.

### 2. Nova tabela `igreen_distributor_discounts` (global, sem account_id)

Colunas:
- `state` (UF, ex: "PA")
- `state_name` (ex: "Pará")
- `distributor` (ex: "Equatorial")
- `distributor_aliases` (text[], ex: `{equatorial pa, equatorial para}`)
- `discount_residencial_percent` numeric
- `discount_comercial_percent` numeric
- `min_bill_brl` numeric (faixa mínima atendida, ex: 200)
- `notes` text (prazos, observações)
- `enabled` bool

RLS: leitura pública autenticada (todos accounts usam a mesma tabela), escrita só super_admin. Painel `/admin/igreen-discounts` para super_admin manter (CRUD simples).

Seed inicial com todas as distribuidoras hoje cobertas pela iGreen (Celesc, CPFL, Enel SP/RJ/CE, Equatorial PA/MA/PI/AL, Energisa MT/MS/TO, Coelba, Cemig, Light, Neoenergia, Copel, etc).

### 3. Substituir `findDiscountPercentage` por consulta à tabela

- Em `_igreen_flow.ts`, `buildGreenSimulationReply` passa a receber uma função `lookupDiscount(state, distributor, accountType)` injetada pelo edge function (que faz `select` na tabela com `ilike` em distributor + aliases).
- Determinístico, instantâneo, sem dependência de KB.
- Mantém o fallback de prompt: se a tabela não cobrir a distribuidora, IA admite que vai confirmar com a equipe (aí faz sentido).

### 4. Nova tool `get_distributor_discount(state, distributor, account_type)` no `whatsapp-ai-agent` e `test-ai-prompt`

- Antes de responder qualquer coisa sobre desconto/simulação, o prompt obriga a IA a chamar essa tool.
- Retorna `{ found, discount_percent, min_bill, notes }`.
- Se `found=false` → resposta padrão honesta ("essa distribuidora não está na minha lista, vou pedir confirmação ao time").
- Se `found=true` → IA pode fazer a simulação de economia direto, sem "verificar com a equipe".

### 5. Injeção compacta no prompt (defensivo)

Quando o `_igreen_flow.ts` detectar que a conversa já tem `estado` e/ou `distribuidora` salvos em `igreen_lead_data`, injeta no system prompt um bloco curto tipo:

```
DESCONTO CONFIRMADO DA DISTRIBUIDORA DO CLIENTE:
- Equatorial / PA / Residencial: 15%
- Faixa mínima: R$ 200
```

Assim, mesmo se a IA não chamar a tool, o número correto já está no contexto e o fallback "vou verificar com a equipe" some.

### 6. Regra de fluxo: não responder pergunta com pergunta

Adicionar no bloco de regras do `_igreen_flow.ts` (etapa pós-vídeo):

> Se o cliente fizer pergunta direta ("o que precisa?", "como funciona?", "como faço?"), NÃO devolva outra pergunta. Responda em 1 frase curta o próximo passo objetivo (ex.: "Só preciso da sua distribuidora de energia e do estado pra te mostrar quanto você economiza.") e só então peça a informação.

## Arquivos/mudanças técnicas

- **Migração SQL:**
  - Criar `igreen_distributor_discounts` + RLS + seed inicial.
  - `UPDATE` em `igreen_account_products` zerando 120→50s e alterando default.
- **`supabase/functions/_igreen_flow.ts`:**
  - Remover/depreciar `findDiscountPercentage`.
  - `buildGreenSimulationReply` passa a aceitar `lookupDiscount` injetado.
  - Bloco de prompt ganha:
    - regra "não responda pergunta com pergunta",
    - instrução para chamar `get_distributor_discount` antes de simular,
    - placeholder de injeção do desconto confirmado quando lead_data já tem estado+distribuidora.
- **`supabase/functions/whatsapp-ai-agent/index.ts` e `test-ai-prompt/index.ts`:**
  - Registrar tool `get_distributor_discount` (handler faz SELECT na nova tabela).
  - Antes de montar o prompt, fazer lookup com `igreen_lead_data.estado/distribuidora` e injetar bloco "DESCONTO CONFIRMADO".
  - Passar `lookupDiscount` para `buildGreenSimulationReply`.
- **Frontend (opcional, sem bloquear):**
  - Tela super_admin `/admin/igreen-discounts` (lista + edição inline). Pode ficar para um próximo passo se você preferir só popular via seed agora.

## Resultado esperado

- Pós-vídeo: 50s exatos.
- Pergunta direta do cliente → resposta direta + próximo passo, sem pergunta retórica no meio.
- Desconto por distribuidora/estado vem de tabela estruturada, não de PDF. Acaba o "vou verificar com a equipe" para distribuidoras já mapeadas.
- Atualizar desconto = editar 1 linha na tabela, sem mexer em KB nem em prompt.

## Posso seguir com essa implementação?
