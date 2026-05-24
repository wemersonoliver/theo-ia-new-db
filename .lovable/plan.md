## Diagnóstico

O problema não é só o texto do prompt. Encontrei três causas estruturais:

1. **A IA está parando depois de várias ações internas seguidas**
   - No caso da Thays, quando o cliente respondeu `SC / Celesc`, a IA chamou:
     - salvar estado
     - salvar distribuidora
     - buscar desconto oficial
   - O limite atual é de apenas 3 ações por resposta. Ao atingir esse limite, ela não chega a escrever a resposta final e cai no fallback genérico: “Perfeito, obrigado...” ou “Desculpe...”.

2. **O simulador não está seguindo exatamente o mesmo fluxo estável da produção**
   - No simulador, depois de `olá` e `thays`, ele pode depender demais do Gemini para decidir o próximo passo.
   - Quando o Gemini retorna só chamada de ferramenta ou resposta vazia, o simulador mostra “Desculpe, não consegui processar...”.

3. **O erro de handoff com `handed_off_at` ainda aparece nos logs**
   - A coluna existe no banco, mas a API do Supabase/PostgREST ainda retornou erro de cache em alguns momentos.
   - Isso afeta principalmente números já testados antes, porque eles já têm sessão antiga, tags, documentos ou handoff anterior.

## Plano de correção definitiva

### 1. Corrigir o limite de ações internas da IA
- Aumentar o limite de tools do fluxo principal e do simulador.
- Evitar que a IA finalize sem texto quando acabou de executar ferramentas.
- Quando o limite for atingido depois de ações bem-sucedidas, gerar uma resposta determinística em vez de fallback genérico.

### 2. Criar respostas determinísticas para os pontos críticos do Igreen
Para o plano Igreen, não deixar o Gemini decidir sozinho os passos principais:

- Nome informado após saudação: salvar nome e mostrar as 3 opções.
- Cliente escolheu opção 1: apresentar Conexão Green e seguir para vídeo ou, se não houver vídeo, pedir distribuidora/estado.
- Cliente informou distribuidora + UF: salvar dados, buscar desconto e pedir valor médio da fatura.
- Cliente informou valor da fatura: calcular economia e pedir fatura.
- Fatura validada: mover CRM e pedir RG/CNH.
- Documento validado: mover CRM, notificar equipe e encerrar corretamente.

Isso transforma o fluxo Igreen em uma máquina de etapas estável, e o prompt passa a atuar apenas nas conversas abertas, objeções e dúvidas.

### 3. Unificar simulador e atendimento real
- Extrair a lógica do fluxo Igreen para helpers compartilhados.
- O simulador deve usar as mesmas salvaguardas determinísticas do WhatsApp real.
- Remover o fallback “Desculpe, não consegui processar...” para casos normais do Igreen e substituir por uma recuperação contextual.

### 4. Resolver sessões antigas de números já testados
- Tratar números com histórico anterior sem travar por dados antigos.
- Se a conversa já tem nome, estado, distribuidora ou etapa salva, a IA deve continuar do ponto correto.
- Adicionar um caminho seguro para reiniciar/normalizar a sessão quando o histórico estiver inconsistente.

### 5. Corrigir definitivamente o cache do Supabase/PostgREST
- Criar uma migração pequena para recarregar o cache do PostgREST.
- Incluir também um comando seguro de refresh da fila de notificações, conforme documentação da Supabase.
- Isso resolve o erro recorrente em que a coluna `handed_off_at` existe no banco, mas a API ainda diz que não existe.

### 6. Validar com os casos reais da Thays
Depois da implementação, testar:

- Simulador: `olá` → `thays` → deve mostrar as 3 opções, sem erro.
- Simulador: `1` → deve apresentar Green e seguir corretamente.
- WhatsApp real: `SC / Celesc` → deve responder pedindo o valor médio da fatura, não cair no fallback.
- Número já usado antes: deve continuar do contexto correto ou recuperar a sessão sem travar.
- Documento final: deve enviar a mensagem de encerramento e mover para atendimento humano sem erro de `handed_off_at`.

## Resultado esperado

O atendimento Igreen deixa de depender apenas do prompt para etapas críticas. A movimentação do CRM, tags, validação de documentos e respostas de avanço passam a ser controladas por regras do sistema, reduzindo muito os erros recorrentes em números já testados.