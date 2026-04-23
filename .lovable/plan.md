

# Plano: Follow-up com Inteligência Real de Conversão

## Diagnóstico do caso Marcio

A mensagem enviada foi `"Olá, anp! Tudo bem?"` — um desastre por 3 motivos:

1. **Nome quebrado**: o `contact_name` no banco é literalmente `"anp"` (push name ruim do WhatsApp). O prompt usou cegamente.
2. **Ignorou o contexto**: o cliente tinha perguntado "me fale mais sobre seu anúncio", a IA mandou um pitch longo com link de calculadora — e o follow-up não referenciou NADA disso.
3. **Sem técnica de persuasão real**: virou saudação genérica em vez de "Você conseguiu dar uma olhadinha no que mandei?".

A causa raiz: o prompt atual instrui muita coisa de uma vez, com `temperature 0.9` (muito alto) e sem **forçar análise estruturada da conversa antes de escrever**.

---

## Solução: 4 melhorias integradas em `followup-ai/index.ts`

### 1. Análise de contexto em duas etapas (Chain-of-Thought obrigatório)

Em vez de pedir a mensagem direto, fazer **2 chamadas ao Gemini**:

**Etapa A — Análise (modelo barato, JSON estruturado):**
- Identificar o que foi oferecido na última msg da IA (link, proposta, calculadora, agendamento, material...)
- Identificar o último ponto em aberto pelo cliente
- Identificar o "objeto pendente" (o que o cliente precisa fazer/avaliar)
- Estimar a temperatura do lead (frio/morno/quente) baseado no histórico
- Detectar se o nome do contato é válido (não é placeholder como "anp", "user", número puro)

**Etapa B — Geração da mensagem (com base na análise):**
- Recebe o JSON da análise como contexto rico
- Gera mensagem direcionada ao "objeto pendente" identificado
- Temperature reduzida para 0.7 (menos alucinação, mais aderência)

### 2. Sanitização inteligente do nome

Antes de usar `contact_name`, validar:
- Se tem menos de 3 letras → não usar
- Se é só número → não usar
- Se contém caracteres estranhos → não usar
- Se inválido → usar saudação sem nome ("Oi, tudo bem?" em vez de "Oi, anp")

### 3. Biblioteca de técnicas de persuasão expandida (Cialdini + Voss + SPIN)

Adicionar ao prompt da Etapa B um **catálogo de 8 ganchos comprovados** com exemplos concretos, e instruir a IA a escolher 1 baseado no padrão detectado:

| Gancho | Quando usar | Exemplo |
|---|---|---|
| Confirmação de leitura | Cliente recebeu material/link e sumiu | "Conseguiu dar uma olhada no que te mandei?" |
| Rótulo (Voss) | Silêncio prolongado | "Parece que algo te fez pausar a decisão..." |
| Pergunta calibrada (Voss) | Lead morno | "Como seria pra você se conseguíssemos resolver X?" |
| Coerência (Cialdini) | Lead já demonstrou interesse | "Você comentou que precisava de Y — ainda faz sentido?" |
| Prova social | Lead com objeção implícita | "Outros clientes seus do mesmo segmento conseguiram Z..." |
| Reciprocidade | Lead em dúvida | "Separei um material/dica que pode te ajudar..." |
| Escassez real (só dias 5-6) | Cartada final | "Essa condição vai até [data], depois muda" |
| Pergunta de saída (último dia) | Encerramento elegante | "Faz sentido a gente parar por aqui ou ainda quer continuar?" |

### 4. Regras anti-genérico (validação estrutural)

Adicionar regras explícitas no prompt que **rejeitam saudações vazias**:

- ❌ Proibido começar com "Olá, tudo bem?" sozinho
- ❌ Proibido perguntar "Como você está?" como pergunta principal
- ✅ A pergunta final OBRIGATORIAMENTE precisa referenciar algo concreto da conversa anterior
- ✅ Se a última msg da IA tinha link/material/oferta, a mensagem DEVE perguntar sobre isso
- ✅ Máximo 2-3 linhas, mas com substância

---

## Detalhes técnicos

**Arquivo único alterado:** `supabase/functions/followup-ai/index.ts`

**Estrutura nova do loop por item:**

```text
1. [igual] Carregar config, conversa, AI config
2. [novo] Sanitizar contact_name
3. [novo] Chamada A: análise estruturada (JSON via tool_call)
   → retorna: { offered_item, pending_object, lead_temperature, 
                last_open_point, name_is_valid, recommended_hook }
4. [refeito] Chamada B: gerar mensagem usando análise
   → temperature 0.7, prompt focado, hook escolhido
5. [novo] Validação pós-geração: rejeita se mensagem 
   começar com saudação vazia → retry 1x
6. [igual] Enviar via Evolution + atualizar tracking
```

**Modelo:** continua `gemini-2.5-flash` (já contratado).

**Custo extra:** 1 chamada adicional por follow-up (análise é curta, ~200 tokens). Aceitável.

**Resultado esperado para o caso Marcio na próxima execução:**
> "Oi! Vi que te mandei o link da calculadora da Igreen pra simular o desconto na conta de luz — conseguiu dar uma olhada? Se preferir, posso fazer a simulação aqui com você, é rapidinho."

Em vez de "Olá, anp! Tudo bem?".

---

## O que NÃO muda
- Cadência (6 dias / 12 etapas)
- Janela horária e jitter
- Lógica de skip humano (Frente 1 já feita)
- Detecção NEVER_REPLIED vs DROPPED_OFF (continua, mas agora alimenta a análise estruturada)

