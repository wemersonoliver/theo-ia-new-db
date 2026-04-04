

## Plano: Sistema de Notificação Admin para Novos Usuários

### Objetivo
Criar um sistema que notifica via WhatsApp (instância do sistema) quando um novo usuário se cadastra na plataforma. Inclui uma página admin dedicada para gerenciar os contatos de notificação.

### Como funciona

1. **Nova página Admin: Notificações** (`/admin/notifications`)
   - Exibe lista de contatos cadastrados na tabela `admin_notification_contacts` (já existente)
   - Formulário para adicionar/remover números
   - Toggle ativo/inativo por contato

2. **Trigger de banco de dados** que dispara quando um novo usuário é criado
   - Cria uma function `notify_new_user_registration()` que chama uma Edge Function via `pg_net` (HTTP request)
   - Trigger `AFTER INSERT ON auth.users` que invoca essa function

3. **Nova Edge Function: `notify-new-user`**
   - Recebida pelo trigger via webhook interno
   - Busca os contatos ativos em `admin_notification_contacts`
   - Busca a instância do sistema (`system_whatsapp_instance`)
   - Envia mensagem via Evolution API para cada contato ativo com dados do novo usuário (nome, email, data)

### Alterações técnicas

**Migração SQL:**
- Criar function + trigger em `auth.users` que faz HTTP POST para a Edge Function `notify-new-user` usando `pg_net` ou `net.http_post`

**Nota:** Como não podemos usar `pg_net` diretamente (extensão pode não estar habilitada), a abordagem alternativa será:
- Modificar a function `handle_new_user()` existente (que já é trigger em `auth.users`) para, além de criar o perfil, inserir um registro em uma nova tabela `admin_notifications_queue`
- Uma Edge Function periódica ou a própria lógica no webhook processaria a fila

**Abordagem mais simples e confiável:**
- Modificar a Edge Function `admin-users` para incluir a ação de notificação, OU
- Alterar o trigger `handle_new_user()` para também chamar a notificação via `pg_net`

**Abordagem recomendada (sem depender de pg_net):**
- Adicionar lógica de notificação diretamente na Edge Function `whatsapp-webhook` ou criar uma edge function `notify-new-user` chamada pelo frontend no momento do registro

**Melhor abordagem:** Modificar o fluxo de registro no frontend (`Register.tsx`) para, após signup bem-sucedido, invocar uma nova Edge Function `notify-new-user` que envia as notificações.

### Arquivos a criar/modificar

1. **`src/pages/admin/AdminNotifications.tsx`** — Nova página com gestão de contatos (reutilizando `useAdminNotificationContacts`)

2. **`src/components/admin/AdminSidebar.tsx`** — Adicionar item "Notificações" no menu com ícone `Bell`

3. **`src/App.tsx`** — Adicionar rota `/admin/notifications`

4. **`supabase/functions/notify-new-user/index.ts`** — Nova Edge Function:
   - Recebe dados do novo usuário
   - Busca contatos ativos em `admin_notification_contacts`
   - Busca instância sistema em `system_whatsapp_instance`
   - Envia mensagem via Evolution API

5. **`supabase/config.toml`** — Adicionar `verify_jwt = false` para `notify-new-user`

6. **`src/pages/Register.tsx`** — Após registro bem-sucedido, invocar `notify-new-user` em background (fire-and-forget)

### Mensagem de notificação
```
🆕 Novo usuário cadastrado!
📋 Nome: {full_name}
📧 Email: {email}
📅 Data: {data_formatada}
```

