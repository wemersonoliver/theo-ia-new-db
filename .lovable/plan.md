# Personalização dos prompts por nicho de negócio

## Problema

Hoje todos os agentes de IA dos usuários (atendimento WhatsApp + follow-up) usam prompts **genéricos** — só sabem o `agent_name`. Não importa se o cliente é uma clínica de estética, uma loja de roupas ou um escritório de advocacia: a IA fala do mesmo jeito.

Quero que cada agente seja **especializado no negócio do usuário**, com a frase modelo:

> *"Você é ${agentName}, um vendedor humano experiente **no nicho ${businessNiche}** reativando um lead..."*

## Solução

### 1. Banco — adicionar 2 campos novos em `whatsapp_ai_config`

| Campo | Tipo | Para quê |
|---|---|---|
| `business_niche` | `text` | Segmento curto, ex: "Clínica de estética", "Loja de calçados", "Imobiliária" |
| `business_description` | `text` (opcional) | 1-3 frases livres sobre o que o negócio vende/oferece (diferencial, ticket médio, perfil de cliente). Dá mais contexto sem o usuário precisar reescrever o prompt inteiro. |

Migração simples (`ALTER TABLE … ADD COLUMN`), nullable, sem default — usuários antigos continuam funcionando (com fallback genérico).

### 2. UI — campo seletor + textarea no AI Agent

Na aba de configuração do agente (`/ai-agent`), adicionar logo abaixo do "Nome do agente":

- **Nicho do negócio** — `<Input>` simples com placeholder *"Ex: Clínica odontológica, Loja de roupas femininas, Imobiliária…"* + um botão de sugestões rápidas (chips) com os nichos mais comuns: Estética, Saúde, Educação, Imobiliária, E-commerce, Restaurante, Consultoria, Advocacia, Outros.
- **Descrição rápida do negócio** — `<Textarea>` com 2-3 linhas, placeholder *"O que vocês vendem, ticket médio, perfil do cliente ideal…"*. Opcional.

Hook `useAIConfig` já existe — só adicionar os 2 campos no save.

### 3. Edge Functions — injetar nos prompts

**3 arquivos editados** (todos buscam `whatsapp_ai_config` e montam prompt):

#### a) `whatsapp-ai-agent/index.ts` (atendimento principal do usuário)
Trocar:
```ts
`Você é ${aiConfig.agent_name} de atendimento via WhatsApp.`
```
Por:
```ts
`Você é ${aiConfig.agent_name}, atendente especializado em ${aiConfig.business_niche || "atendimento"} via WhatsApp.
${aiConfig.business_description ? `SOBRE O NEGÓCIO: ${aiConfig.business_description}` : ""}
Use linguagem, exemplos e objeções típicas desse segmento.`
```

#### b) `followup-ai/index.ts` (follow-up dos usuários — Etapa B de geração)
Trocar a primeira linha do `generationPrompt`:
```ts
`Você é ${agentName}, um vendedor humano experiente no nicho de ${businessNiche} reativando um lead por WhatsApp.
${businessDescription ? `CONTEXTO DO NEGÓCIO: ${businessDescription}` : ""}
Use técnicas dos livros …`
```
E na **Etapa A (análise)** passar o nicho como pista para a IA escolher melhor o gancho (ex: nicho "estética" pesa mais em `prova_social`, nicho "imobiliária" em `pergunta_calibrada`).

Buscar os 2 campos novos no mesmo SELECT que já roda:
```ts
.select("agent_name, custom_prompt, business_niche, business_description")
```

#### c) `system-followup-ai/index.ts` — **NÃO mexer**
Esse é o follow-up do **suporte do Theo IA** falando com leads do Theo. O nicho ali é fixo ("SaaS de IA pra WhatsApp"), já é tratado com a estratégia do plano em `.lovable/plan.md`. Sem alteração.

### 4. Fallback / retrocompatibilidade

Se `business_niche` for `null` (usuário antigo que ainda não preencheu):
- Atendimento: cai no texto atual genérico
- Follow-up: usa "vendedor experiente" sem o "no nicho de X"
- Banner não-bloqueante na tela `/ai-agent`: *"Adicione o nicho do seu negócio para deixar a IA mais inteligente"* — sem forçar, sem quebrar nada.

## Arquivos modificados

1. **Migração SQL** — `ALTER TABLE whatsapp_ai_config ADD COLUMN business_niche text, ADD COLUMN business_description text`
2. **`src/pages/AIAgent.tsx`** — adicionar os 2 campos no formulário + chips de sugestão
3. **`src/hooks/useAIConfig.ts`** — incluir os 2 campos nos tipos/save
4. **`supabase/functions/whatsapp-ai-agent/index.ts`** — injetar nicho no `systemPrompt`
5. **`supabase/functions/followup-ai/index.ts`** — injetar nicho no SELECT, na análise (Etapa A) e na geração (Etapa B)

**Sem alterações** em UI de admin, nem em `system-followup-ai`, nem em outras edge functions.

## Resultado esperado

- Usuário dono de **clínica de estética** preenche nicho → IA passa a falar de "procedimentos", "agendamento de avaliação", "antes e depois", e o follow-up diz *"Você é Marina, vendedora experiente no nicho de estética…"* gerando objeções/ganchos do segmento.
- Usuário **imobiliário** preenche → IA fala de "visita ao imóvel", "documentação", "financiamento", e o follow-up usa o tom certo.
- Sem nenhum nicho preenchido → tudo continua funcionando como hoje (fallback).

## Pontos pra confirmar antes de executar

1. **Lista de chips sugeridos** — concorda com Estética / Saúde / Educação / Imobiliária / E-commerce / Restaurante / Consultoria / Advocacia / Outros, ou quer adicionar/remover algum?
2. Quer também aplicar o nicho no **`prompt-generator-ai`** (a IA que ajuda o usuário a escrever o prompt) pra que ela já gere prompts personalizados pro segmento? Recomendo **sim**, mas só se você quiser nesta rodada.
3. Os campos novos devem ser **obrigatórios no onboarding** dos novos usuários ou só opcionais por enquanto?
