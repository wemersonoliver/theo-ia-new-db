

# Plano: Super Agente de Suporte + Sistema de Notificações Admin

## Visão Geral

Criar a Edge Function `support-ai-agent` usando a chave `GOOGLE_GEMINI_API_KEY` já existente, com function calling para consultar o banco de dados. Quando o agente não souber responder, transfere para humano e notifica os contatos cadastrados pelos administradores com um resumo da conversa. Adicionar tela de gestão de contatos de notificação no painel admin.

## Arquitetura

```text
WhatsApp (instância sistema) → webhook → support-ai-agent
  → Gemini (GOOGLE_GEMINI_API_KEY) com tools de DB
  → Se não sabe: transfer_to_human
    → Busca contatos de notificação (admin_notification_contacts)
    → Envia resumo da conversa via WhatsApp para cada contato
```

## Etapa 1: Migração de Banco

Criar tabela `admin_notification_contacts` para contatos que recebem notificações de suporte (separada da `notification_contacts` que é por usuário):

- `id`, `phone`, `name`, `active`, `created_at`, `updated_at`
- RLS: apenas `super_admin` gerencia
- Sem `user_id` pois é global do sistema

## Etapa 2: Edge Function `support-ai-agent`

Nova função que:
- Usa `GOOGLE_GEMINI_API_KEY` (Gemini 2.5 Flash) com function calling
- Usa `SUPABASE_SERVICE_ROLE_KEY` para queries no banco
- Recebe `phone` e `messageContent` do webhook

**Tools disponíveis:**

| Tool | Descrição |
|------|-----------|
| `lookup_user` | Busca usuário por telefone (profiles, subscriptions) |
| `check_subscription` | Verifica assinatura e status de pagamento |
| `get_user_ai_config` | Lê configuração de IA do usuário |
| `update_user_ai_config` | Atualiza prompt, horários, nome do agente |
| `list_user_products` | Lista produtos cadastrados |
| `create_product` | Cria produto para o usuário |
| `update_product` | Atualiza produto existente |
| `get_whatsapp_status` | Verifica status da instância WhatsApp |
| `update_business_hours` | Altera horário de atendimento |
| `update_followup_config` | Configura follow-up automático |
| `list_appointments` | Lista agendamentos |
| `get_crm_summary` | Resume pipeline/deals do CRM |
| `transfer_to_human` | Marca conversa para atendimento humano, notifica contatos com resumo |

**Prompt do sistema:** Descrição completa do Theo IA (todas funcionalidades), tom profissional, regras de segurança (confirmar ações destrutivas), identificação do usuário por telefone.

**Lógica de transferência:**
1. Marca `ai_active = false` na `system_whatsapp_conversations`
2. Gera resumo da conversa com Gemini
3. Busca contatos em `admin_notification_contacts`
4. Envia mensagem com resumo via instância do sistema

## Etapa 3: Atualizar Webhook

Modificar `whatsapp-webhook/index.ts`:
- Quando recebe `messages.upsert` da instância do sistema:
  - Salvar mensagem em `system_whatsapp_conversations`
  - Verificar `system_ai_config.active`
  - Se ativo e `ai_active` da conversa = true: chamar `support-ai-agent`

## Etapa 4: UI Admin - Contatos de Notificação

Nova aba/seção na página `AdminAIConfig.tsx` ou nova página para gerenciar `admin_notification_contacts`:
- Formulário para adicionar telefone + nome
- Lista com toggle ativo/inativo
- Botão de remover

**Hook:** `useAdminNotificationContacts.ts`

## Etapa 5: Config.toml

Adicionar `support-ai-agent` com `verify_jwt = false`.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/support-ai-agent/index.ts` |
| Criar | `src/hooks/useAdminNotificationContacts.ts` |
| Criar | Migração para `admin_notification_contacts` |
| Editar | `supabase/functions/whatsapp-webhook/index.ts` (rotear msgs sistema) |
| Editar | `supabase/config.toml` |
| Editar | `src/pages/admin/AdminAIConfig.tsx` (adicionar seção contatos) |

