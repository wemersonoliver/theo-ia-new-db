

## Plano: Opção de Indicar Números Específicos para Análise de Conversas

### Objetivo

Antes de a IA analisar as conversas do WhatsApp para enriquecer o prompt, dar ao usuário a opção de:
1. **Indicar números específicos** (5 a 30 números com DDD, separados por vírgula) para a IA analisar apenas essas conversas.
2. **Deixar a IA buscar automaticamente** entre todas as conversas sincronizadas.

### Alterações

#### 1. System Prompt (`interview-ai-agent/index.ts`)

Atualizar o `SYSTEM_PROMPT` para que, após coletar os dados obrigatórios e antes de gerar o `[FINISH]`, a IA faça **duas perguntas sequenciais**:

1. "Posso analisar suas conversas do WhatsApp para identificar padrões reais e melhorar o prompt?"
2. Se sim: "Você gostaria de indicar números específicos de clientes (entre 5 e 30, com DDD, separados por vírgula) ou prefere que eu analise automaticamente suas conversas mais recentes?"

A edge function retornará uma flag `requestConversationAnalysis: true` quando detectar que o usuário autorizou, e `specificPhones: string[]` quando o usuário fornecer números.

#### 2. Edge Function `interview-ai-agent/index.ts`

- Aceitar novos parâmetros: `analyzeConversations: boolean` e `specificPhones?: string[]`.
- Quando `analyzeConversations = true`:
  - Criar client com **service role** para acessar `whatsapp_conversations` do usuário (RLS impede acesso via anon).
  - Se `specificPhones` fornecidos: filtrar conversas por `.in('phone', specificPhones)`.
  - Se não: buscar as 50 conversas mais recentes por `last_message_at`.
  - Limitar a 30 mensagens por conversa.
  - Enviar ao Gemini com prompt de análise em lote (classificar cliente vs pessoal, extrair padrões).
  - Injetar o resumo consolidado como contexto antes da geração do `[FINISH]`.

#### 3. Frontend `InterviewTab` em `AIAgent.tsx`

- Adicionar estado `awaitingConversationConsent` para detectar quando a IA pergunta sobre análise.
- Adicionar estado `awaitingPhoneChoice` para a segunda pergunta (indicar números ou automático).
- Quando o usuário optar por indicar números: mostrar um campo de input com placeholder "Ex: 11999998888, 21988887777..." e validar entre 5 e 30 números.
- Enviar `analyzeConversations: true` e opcionalmente `specificPhones: [...]` na próxima chamada.
- Adicionar loading texts específicos: "Analisando conversas reais...", "Identificando padrões de atendimento...", "Filtrando conversas com clientes...".

#### 4. Fluxo

```text
Entrevista (perguntas 1-8+)
        ↓
IA pergunta: "Posso analisar suas conversas do WhatsApp?"
        ↓
Usuário: SIM
        ↓
IA pergunta: "Quer indicar números específicos (5-30) ou deixar eu buscar automaticamente?"
        ↓
Opção A: Usuário digita números → frontend valida e envia specificPhones
Opção B: Usuário diz "automático" → frontend envia analyzeConversations: true sem phones
        ↓
Edge function busca conversas (filtradas ou todas)
        ↓
Gemini analisa, classifica e extrai padrões
        ↓
Resumo injetado → [FINISH] com prompt enriquecido
```

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/interview-ai-agent/index.ts` | Modificar: adicionar busca de conversas com filtro por phones, análise via Gemini |
| `src/pages/AIAgent.tsx` | Modificar: adicionar UI para escolha de números, validação, estados e loading texts |

### Sem alterações de banco de dados

As conversas já estão em `whatsapp_conversations`. Nenhuma nova tabela ou coluna necessária.

