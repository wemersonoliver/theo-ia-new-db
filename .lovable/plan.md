

## Plano: Finalizar e Excluir Conversas no Painel do Usuário

### Conceito

Duas ações distintas para o usuário na tela de Conversas:

- **Finalizar**: Limpa as mensagens da conversa e reseta a sessão de IA, mas mantém um resumo do contexto anterior. Quando o lead entrar em contato novamente, a IA o cumprimentará pelo nome reconhecendo que é um retorno.
- **Excluir**: Remove a conversa completamente do banco. Se o lead entrar em contato novamente, será tratado como um atendimento totalmente novo, sem contexto anterior.

### Alterações

**1. Hook `useConversations.ts`** — Adicionar duas mutations:
- `finishConversation`: Salva um resumo das últimas mensagens no campo `messages` (como uma mensagem especial de tipo "context_summary"), limpa o histórico principal, reseta `ai_active` para `true`, `total_messages` para 0, e deleta a sessão correspondente em `whatsapp_ai_sessions`
- `deleteConversation`: Deleta o registro da `whatsapp_conversations` e da `whatsapp_ai_sessions`

**2. Página `Conversations.tsx`** — Adicionar botões no header do chat (desktop e mobile):
- Botão "Finalizar" (ícone CheckCircle) com confirmação via AlertDialog
- Botão "Excluir" (ícone Trash2) com confirmação via AlertDialog
- Após ação, deseleciona o phone atual

**3. Edge Function `whatsapp-ai-agent/index.ts`** — Ajustar o prompt da IA:
- Ao montar o contexto, verificar se existe uma mensagem do tipo `context_summary` no array de mensagens da conversa
- Se existir, adicionar ao system prompt: "Este cliente já foi atendido anteriormente. Resumo do último atendimento: [resumo]. Cumprimente-o pelo nome e demonstre que se lembra dele."
- Se não existir resumo (conversa excluída ou primeiro contato), manter comportamento atual

**4. Modelo de dados** — Nenhuma migração necessária. Usaremos o campo `messages` existente (jsonb) para armazenar o resumo como uma mensagem especial com `type: "context_summary"`.

### Detalhes Técnicos

**Formato do resumo salvo na finalização:**
```json
{
  "id": "summary-<timestamp>",
  "type": "context_summary",
  "content": "Resumo: Cliente [nome] conversou sobre [tópicos]. Último atendimento em [data].",
  "timestamp": "<ISO>",
  "from_me": true,
  "sent_by": "ai"
}
```

A mutation `finishConversation` irá:
1. Pegar as últimas 5 mensagens e gerar um resumo textual simples (concatenação dos conteúdos principais)
2. Atualizar `whatsapp_conversations` com `messages = [summary_message]`, `total_messages = 0`, `ai_active = true`
3. Deletar o registro em `whatsapp_ai_sessions` para esse user_id+phone

No `whatsapp-ai-agent`, ao construir o prompt, buscar mensagens do tipo `context_summary` e injetar instrução para cumprimentar o cliente pelo nome.

