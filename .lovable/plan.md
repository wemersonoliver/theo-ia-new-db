## Objetivo
Quando o usuário **criar uma nova instância** de WhatsApp (primeira conexão ou após excluir e recriar), importar automaticamente os números com conversas ativas nos **últimos 7 dias** e cadastrá-los no sistema com a **IA desativada**, evitando conflito com atendimentos em andamento.

Reconexões normais (cair e voltar a conectar a mesma instância) **NÃO** devem reimportar nem desligar IA novamente.

## Situação atual
- `whatsapp-webhook` dispara `sync-whatsapp-conversations` **toda vez** que a instância passa para `connected` — incluindo reconexões. Precisa virar disparo apenas na primeira conexão da instância.
- `sync-whatsapp-conversations` hoje usa janela de **5 dias** e grava novas conversas com `ai_active = false` (mantém o valor se já existir).
- Só processa o **primeiro lote de 40 chats** por chamada.

## Mudanças propostas

### 1. Marcar instância como "já sincronizada"
Adicionar coluna `initial_sync_completed_at timestamptz` em `whatsapp_instances` (default `NULL`).
- Ao criar/recriar a instância (`create-whatsapp-instance`): garantir que essa coluna fica `NULL`.
- Ao concluir a sincronização inicial com sucesso: gravar `now()`.

### 2. Disparar sync inicial apenas uma vez por instância
No `whatsapp-webhook`, no bloco `connection.update → connected`:
- Ler `initial_sync_completed_at` da instância.
- Se for `NULL` → disparar `sync-whatsapp-conversations` com `daysBack: 7`, `forceDisableAI: true` e paginação completa (loop em `hasMore`, com teto de segurança de ~10 páginas / 400 chats).
- Se já tiver valor → **não disparar nada** (reconexão comum).

### 3. Forçar IA desativada na importação inicial
Em `sync-whatsapp-conversations`:
- Aceitar parâmetro `forceDisableAI: boolean`.
- Quando `true`, o upsert grava `ai_active: false` mesmo para conversas que já existiam.
- Demais chamadas (botão manual "Sincronizar conversas") continuam preservando o estado atual.

### 4. Paginação automática na importação inicial
Após o primeiro lote retornar `hasMore: true`, o webhook chama novamente a função com o `nextOffset` recebido, até `hasMore = false` ou atingir o teto. Apenas no fim do loop a instância é marcada com `initial_sync_completed_at = now()`.

### 5. Garantir reset ao recriar instância
Como o fluxo do app já é "excluir → criar nova", a nova linha em `whatsapp_instances` nasce sem `initial_sync_completed_at`, então a próxima conexão será tratada como primeira automaticamente. Só precisamos garantir que a função `create-whatsapp-instance` não copie o valor antigo nem o defina manualmente.

## Arquivos afetados
- **Migration nova** — adicionar coluna `initial_sync_completed_at` em `whatsapp_instances`.
- `supabase/functions/whatsapp-webhook/index.ts` — checar `initial_sync_completed_at`, disparar sync apenas quando `NULL`, loop de paginação, marcar coluna ao final.
- `supabase/functions/sync-whatsapp-conversations/index.ts` — aceitar `forceDisableAI`, aplicar `daysBack: 7` quando vindo da conexão inicial.
- `supabase/functions/create-whatsapp-instance/index.ts` — apenas garantir que a coluna nasce `NULL` (sem mudança de lógica se for o caso).

## Pontos de atenção
- Conversas dos últimos 7 dias já existentes no banco terão `ai_active` forçado para `false` na importação inicial — comportamento desejado.
- Reconexões posteriores **não** mexem mais em IA nem reimportam histórico.
- O usuário sempre pode reativar a IA manualmente em qualquer conversa pela tela `/conversations`.
