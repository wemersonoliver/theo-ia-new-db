
# Módulo de Entrevista Inteligente — Theo IA Setup

## Objetivo

Criar um chat dinâmico dentro da aba "Agente IA" que usa a API do Gemini para conduzir uma consultoria guiada e gerar automaticamente um `system prompt` robusto. Ao finalizar, o prompt gerado é salvo diretamente no campo `custom_prompt` da tabela `whatsapp_ai_config`, que já é usado pelo agente para responder via WhatsApp.

---

## O que será construído

### 1. Banco de Dados (Migração)

Criar a tabela `entrevistas_config` para armazenar o histórico completo de cada sessão de entrevista:

```text
entrevistas_config
├── id (uuid, PK)
├── user_id (uuid)
├── company_name (text)
├── segment (text)
├── messages (jsonb) — histórico completo da conversa
├── generated_prompt (text) — prompt final gerado
├── status (text) — 'in_progress' | 'completed'
├── created_at
└── updated_at
```

RLS: usuário só acessa suas próprias entrevistas.

---

### 2. Edge Function: `interview-ai-agent`

Nova função backend responsável por:

- Receber o histórico de mensagens da conversa de entrevista + dados da empresa
- Montar o `system prompt` de consultoria para o Gemini, instruindo-o a:
  - Analisar o segmento e histórico de respostas
  - Identificar gargalos comuns do nicho
  - Fazer uma pergunta por vez
  - Detectar quando tem informações suficientes e encerrar com `[FINISH]`
  - Ao encerrar, retornar o prompt mestre completo após o sinal `[FINISH]`
- Chamar a API do Google Gemini (usando `GOOGLE_GEMINI_API_KEY` já configurada)
- Retornar a resposta da IA

**System Prompt de Consultoria enviado ao Gemini:**
```
Você é um especialista em atendimento digital e automação de WhatsApp com IA.

Sua missão: Conduzir uma entrevista consultiva para criar o melhor prompt de atendimento do mundo para a empresa informada.

Regras:
1. Faça UMA pergunta por vez, de forma conversacional
2. Analise o segmento e use seu conhecimento sobre dores e dúvidas frequentes desse nicho
3. Quando tiver informações suficientes (geralmente após 5-8 perguntas), encerre com [FINISH]
4. Após [FINISH], gere o PROMPT MESTRE completo com:
   - PERSONA: nome, tom de voz, personalidade
   - CONHECIMENTO DO NEGÓCIO: regras, produtos, serviços, preços, políticas
   - PROTOCOLO DE ATENDIMENTO: como lidar com objeções, dúvidas frequentes do setor
   - CALL TO ACTION: objetivo final de cada conversa
   - REGRAS CRÍTICAS: o que nunca fazer, limites do atendimento
```

---

### 3. Nova Aba na Página AIAgent.tsx

Adicionar uma nova aba **"Entrevista IA"** (com ícone de varinha mágica ✨) ao lado das abas existentes (Geral, Horário, Gatilhos, Lembretes).

**Estados da entrevista:**
- **Tela inicial**: Formulário com "Nome da Empresa" e "Segmento" + botão "Iniciar Entrevista"
- **Chat ativo**: Interface de chat com bolhas de mensagem, input e indicadores dinâmicos
- **Finalizado**: Exibe o prompt gerado com opção de copiar/editar e botão "Aplicar às Instruções"

**Indicadores dinâmicos enquanto a IA processa:**

Os textos de carregamento variam aleatoriamente entre:
- "Analisando gargalos do setor..."
- "Mapeando dúvidas frequentes..."
- "Consultando base de conhecimento do nicho..."
- "Elaborando próxima pergunta..."

---

### 4. Fluxo Completo de Funcionamento

```text
Usuário abre aba "Entrevista IA"
        ↓
Preenche Nome da Empresa + Segmento
        ↓
Clica "Iniciar" → Cria registro em entrevistas_config
        ↓
Gemini faz primeira pergunta sobre o negócio
        ↓
Usuário responde → histórico enviado ao backend
        ↓
Gemini analisa e faz próxima pergunta adaptada
        ↓ (5-8 perguntas)
Gemini detecta que tem info suficiente → resposta contém [FINISH]
        ↓
Frontend detecta [FINISH] → extrai o prompt gerado
        ↓
Exibe prompt para o usuário revisar/editar
        ↓
Usuário clica "Aplicar às Instruções"
        ↓
Salva em whatsapp_ai_config.custom_prompt (via saveConfig existente)
Salva prompt em entrevistas_config.generated_prompt
        ↓
Usuário é redirecionado para aba "Geral" onde vê o prompt aplicado
```

---

### 5. Lógica de Detecção do [FINISH]

No frontend, após cada resposta do Gemini:

```typescript
const hasFinished = response.includes('[FINISH]');
if (hasFinished) {
  // Extrai o texto após [FINISH] como o prompt gerado
  const generatedPrompt = response.split('[FINISH]')[1].trim();
  setInterviewState('completed');
  setGeneratedPrompt(generatedPrompt);
}
```

---

## Arquivos a criar/modificar

### Novos
- `supabase/migrations/[timestamp]_entrevistas_config.sql` — tabela + RLS
- `supabase/functions/interview-ai-agent/index.ts` — edge function da entrevista

### Modificados
- `src/pages/AIAgent.tsx` — adicionar aba "Entrevista IA" com todo o chat e lógica de UI
- `supabase/config.toml` — registrar nova edge function com `verify_jwt = false`

---

## Detalhes Técnicos

- A edge function usa diretamente a `GOOGLE_GEMINI_API_KEY` já configurada (mesma usada pelo agente de WhatsApp), com o modelo `gemini-2.0-flash`
- O histórico da entrevista é salvo em `entrevistas_config.messages` como JSONB após cada turno
- Ao aplicar o prompt, usa o `saveConfig` já existente no hook `useAIConfig` — sem duplicação de código
- A aba "Geral" já mostra o `custom_prompt` no campo "Instruções Personalizadas", então ao salvar via `saveConfig` o resultado fica visível imediatamente
- Não há necessidade de alterar o `whatsapp-ai-agent` — ele já consome `custom_prompt` automaticamente
