

# Plano: Sistema de Follow-Up Automático com IA

## Resumo

Criar um sistema de cadência inteligente de 6 dias (12 etapas, 2 por dia) que reativa leads inativos no WhatsApp usando técnicas de persuasão, integrado ao agente Theo IA.

## 1. Banco de Dados (2 migrações)

**Tabela `followup_config`:**
- `id`, `user_id` (uuid, RLS), `enabled` (bool, default false)
- `inactivity_hours` (int, default 24), `max_days` (int, default 6)
- `morning_window_start` (text, "08:00"), `morning_window_end` (text, "12:00")
- `evening_window_start` (text, "13:00"), `evening_window_end` (text, "19:00")
- `bargaining_tools` (text - descontos/brindes para dias 5-6)
- `exclude_handoff` (bool, default true - não fazer follow-up em conversas transferidas)
- `created_at`, `updated_at`
- RLS: `auth.uid() = user_id`

**Tabela `followup_tracking`:**
- `id`, `user_id` (uuid, RLS), `phone` (text)
- `current_step` (int, 1-12), `status` (text: pending/engaged/declined/exhausted)
- `last_sent_at` (timestamptz), `next_scheduled_at` (timestamptz)
- `context_summary` (text - resumo gerado pela IA)
- `engagement_data` (jsonb - registra qual step/turno gerou resposta para analytics)
- `created_at`, `updated_at`
- UNIQUE constraint em `(user_id, phone)`
- RLS: `auth.uid() = user_id`

## 2. Edge Function: `followup-ai`

Função principal invocada pelo pg_cron a cada 15 minutos:

1. Busca todos os registros de `followup_tracking` com `status = 'pending'` e `next_scheduled_at <= now()`
2. Para cada registro:
   - Carrega as últimas mensagens da conversa (`whatsapp_conversations`)
   - Carrega `followup_config` do usuário
   - Calcula o dia atual (step 1-2 = dia 1, step 3-4 = dia 2, etc.)
   - Verifica intervalo mínimo de 3h desde `last_sent_at`
   - Chama Gemini com prompt especializado baseado no dia:
     - **Dias 1-4**: Gatilhos de Coerência, Prova Social, Reciprocidade
     - **Dias 5-6**: Escassez, Urgência + `bargaining_tools`
   - Simula "composing" na Evolution API (2-4s)
   - Envia mensagem via Evolution API
   - Atualiza `current_step`, `last_sent_at`
   - Agenda `next_scheduled_at` com horário aleatório na próxima janela
   - Se `current_step > 12`, marca `status = 'exhausted'`

## 3. Detecção de Inatividade e Engajamento

**Inicialização (no webhook `whatsapp-webhook`):**
- Quando uma mensagem de entrada é recebida, verificar se há tracking ativo → marcar `status = 'engaged'` (interrompe ciclo)
- Adicionar lógica no pg_cron existente ou criar novo: verificar conversas sem resposta há `inactivity_hours` e criar registro em `followup_tracking` com `next_scheduled_at` aleatório

**Nova Edge Function: `followup-check-inactive`:**
- Rodada pelo mesmo pg_cron
- Busca conversas cuja última mensagem do cliente foi há mais de `inactivity_hours`
- Filtra: não ter tracking ativo, `ai_active = true`, não estar em handoff (se `exclude_handoff`)
- Cria registro em `followup_tracking` com step 1

## 4. Integração no Webhook

No `whatsapp-webhook/index.ts`, adicionar após salvar mensagem de entrada:
- Query `followup_tracking` para o `(user_id, phone)`
- Se existir com `status = 'pending'` → update para `status = 'engaged'`, registrar `engagement_data` (step e turno)

## 5. Interface - Aba "Follow-Up" no AIAgent.tsx

**Seção Configurações:**
- Switch enabled/disabled
- Inputs: horas de inatividade, max dias
- Janelas de manhã/tarde (4 inputs de horário)
- Switch excluir handoffs
- Textarea para "Armas de Negociação" (bargaining_tools)

**Seção Analytics (dashboard):**
- Taxa de reativação por dia (gráfico de barras, dias 1-6)
- Mapa de calor manhã vs tarde (qual turno gera mais respostas)
- Cards com métricas: total em follow-up, reativados, exauridos
- Dados calculados via query na `followup_tracking`

## 6. Hook `useFollowupConfig`

Hook React para CRUD da `followup_config` e queries de analytics na `followup_tracking`.

## 7. pg_cron Setup

SQL (via insert tool, não migration):
```sql
SELECT cron.schedule(
  'followup-check-every-15min',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url:='https://gljsifkjwkubxaqgxxul.supabase.co/functions/v1/followup-ai',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <service_key>"}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

## 8. config.toml

Adicionar:
```toml
[functions.followup-ai]
verify_jwt = false

[functions.followup-check-inactive]
verify_jwt = false
```

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL (2 tabelas) | Criar |
| `supabase/functions/followup-ai/index.ts` | Criar |
| `supabase/functions/followup-check-inactive/index.ts` | Criar |
| `supabase/functions/whatsapp-webhook/index.ts` | Editar (interromper follow-up ao receber msg) |
| `src/hooks/useFollowupConfig.ts` | Criar |
| `src/pages/AIAgent.tsx` | Editar (nova aba Follow-Up) |
| `src/hooks/useAIConfig.ts` | Sem alteração |
| `supabase/config.toml` | Editar |
| `src/integrations/supabase/types.ts` | Auto-atualizado |

