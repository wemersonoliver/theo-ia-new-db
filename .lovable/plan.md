
## 🎯 Objetivo

Tornar o agente de follow-up do **suporte** mais inteligente: que ele **detecte automaticamente em qual cenário o lead está** e gere mensagens persuasivas falando diretamente das **dores reais de quem tem WhatsApp como canal de venda** e das **soluções concretas que o Theo IA entrega**.

---

## 🧠 O que vai mudar (apenas em `supabase/functions/system-followup-ai/index.ts`)

### 1. Análise da conversa — detectar o **cenário**

Hoje a IA classifica só "temperatura" (frio/morno/quente). Vou adicionar um novo campo obrigatório `scenario` na análise, com 3 valores:

| Cenário | Quando se aplica |
|---|---|
| `curiosidade_inicial` | Lead mandou 1-3 mensagens curtas demonstrando interesse ("quero saber mais", "como funciona", "tem teste grátis?") e sumiu antes de a IA aprofundar |
| `conversa_interrompida` | Lead já trocou várias mensagens, falou de problemas/contexto/objeções específicos, mas parou em algum ponto sem fechar |
| `nunca_respondeu` | Lead nunca respondeu nada (ex: chegou via anúncio e não abriu) |

### 2. Nova **biblioteca de ganchos específicos do Theo IA** (dores + soluções)

Vou adicionar 5 novos hooks focados nas **dores reais** do público-alvo (dono de negócio que atende no WhatsApp), usados especialmente no cenário `curiosidade_inicial`:

| Hook | Dor que ataca | Exemplo de mensagem |
|---|---|---|
| `dor_lead_perdido` | Lead que para de responder e some pra sempre | *"Imagina seu WhatsApp recuperando sozinho aquele cliente que sumiu — exatamente como eu estou fazendo com você agora. 90% dos negócios não fazem isso e perdem faturamento todo mês."* |
| `dor_atendimento_24_7` | Perder venda fora do horário comercial | *"Quantas vendas você acha que perde de noite ou no fim de semana porque não tem ninguém respondendo? O Theo responde em segundos, 24h."* |
| `dor_resposta_demorada` | Cliente quente que esfria por demora | *"Cliente quente espera 2 minutos. Depois disso, ele já tá no concorrente. Quer ver o Theo respondendo no seu WhatsApp em segundos?"* |
| `solucao_agendamento` | Tempo perdido com agenda manual | *"E se o próprio WhatsApp já agendasse a reunião com o cliente, sem você abrir a agenda? É exatamente o que o Theo faz."* |
| `solucao_qualificacao` | Atender lead frio enquanto o quente espera | *"O Theo qualifica os leads sozinho e te chama só quando tá pronto pra fechar. Você só entra na conversa que importa."* |

Os 8 hooks atuais (Cialdini/Voss) continuam disponíveis e ganham reforço.

### 3. **Lógica de seleção do hook por cenário**

A IA da etapa de análise vai recomendar o hook, mas com **regras automáticas de override**:

- `curiosidade_inicial` → prioriza `dor_lead_perdido`, `dor_atendimento_24_7`, `dor_resposta_demorada`, `solucao_agendamento`, `solucao_qualificacao` (rotaciona pra não repetir)
- `conversa_interrompida` → prioriza `coerencia_cialdini` (relembrar o que ele JÁ disse), `rotulo_voss` (nomear a objeção), `pergunta_calibrada`
- `nunca_respondeu` → prioriza `dor_lead_perdido` ou `reciprocidade` (oferecer dica)
- Dias 5-6 continuam podendo usar `escassez` com as armas de negociação

Para evitar repetição: vou registrar o último hook usado por lead (em `engagement_data` no `system_followup_tracking`, que já existe) e a IA evita repetir o mesmo hook em sequência.

### 4. **Prompt de geração reescrito**

O prompt vai receber explicitamente:
- O **cenário detectado** com instruções específicas de tom
- **Para `curiosidade_inicial`**: ordem de "ataque a dor → mostrar solução concreta do Theo → CTA pra teste grátis"
- **Para `conversa_interrompida`**: ordem de "referenciar EXATAMENTE o último ponto que ele falou → resolver a objeção → próximo passo"
- Lista de **funcionalidades concretas do Theo IA** que podem ser citadas: atendimento 24/7, recuperação de leads inativos, agendamento automático, qualificação de leads, transferência inteligente para humano, base de conhecimento personalizada
- CTA padrão para curiosidade inicial: convidar pro **teste grátis de 15 dias** (já é o que existe no plano)

### 5. **Variação de mensagem por tentativa**

Pra mensagens não ficarem repetitivas ao longo dos 12 disparos, vou passar pra IA a contagem de tentativa e os hooks já usados, instruindo a variar dor/solução a cada disparo.

---

## 📁 Arquivos modificados

1. **`supabase/functions/system-followup-ai/index.ts`** — única alteração relevante
   - Adicionar `scenario` no tool call de análise
   - Adicionar 5 hooks novos no `HOOK_LIBRARY`
   - Adicionar lógica de seleção/anti-repetição de hook por cenário
   - Reescrever o `generationPrompt` com blocos condicionais por cenário e lista de funcionalidades do Theo
   - Persistir `last_hook_used` em `engagement_data` ao enviar

**Sem alterações de banco, UI ou outras edge functions.**

---

## ✅ Resultado esperado

- Lead que falou "quero saber mais e sumiu" → recebe mensagem batendo na dor de perder leads + mostrando que o Theo faz exatamente isso + CTA pro teste grátis
- Lead que conversou bastante e parou → recebe mensagem retomando o ponto exato onde ele parou, sem repetir argumentos genéricos
- Mensagens ao longo dos 6 dias variam de ângulo (dor diferente, funcionalidade diferente) sem soar robotizadas

---

## ❓ Pontos pra confirmar antes de executar

1. Posso aprovar os **5 hooks novos** acima ou você quer ajustar/adicionar algum?
2. As **funcionalidades do Theo** que listei (24/7, recuperação, agendamento, qualificação, handoff, base de conhecimento) cobrem bem? Quer adicionar/remover alguma?
3. CTA padrão do cenário `curiosidade_inicial` deve ser **"teste grátis 15 dias"** ou prefere outro (ex: agendar uma demo)?
4. Os erros de build atuais (em `elevenlabs-tts`, `manage-system-whatsapp`, `whatsapp-webhook`, etc.) **não têm relação com este trabalho** — quer que eu corrija junto ou deixo pra outra rodada?
