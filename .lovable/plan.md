

O usuário quer um painel para ativar/desativar a sequência de boas-vindas automáticas (mensagem do Theo 3 min após cadastro). Vou incluir isso no plano principal.

Local ideal: aba/seção dentro de `/admin/ai-config` (que já é a página de config da IA do Suporte) — toggle "Sequência de boas-vindas automática" + edição das mensagens + delay configurável. Mantém tudo num lugar só.

## Plano: Boas-vindas automáticas + Agenda de suporte + Painel de controle

### Parte 1 — Sequência de boas-vindas (3 min após cadastro)

**Fluxo:**
```text
Register.tsx ──► notify-new-user (já existe)
              └► schedule-welcome-message (NOVA) — insere em system_welcome_queue
                    │
                    ▼ (cron pg_cron a cada 1min)
              send-welcome-sequence (NOVA)
                    │
                    ├─ checa flag welcome_sequence_enabled em system_ai_config
                    ├─ checa se já existe conversa em system_whatsapp_conversations p/ phone
                    │   → se sim, marca skipped_reason='existing_conversation'
                    ├─ envia mensagens (do array configurável) com delays ~3-5s
                    └─ grava em system_whatsapp_conversations (from_me:true) p/ contexto do agente
```

**Mensagens padrão (particionadas, persuasivas):**
1. "Oi {primeiro_nome}! 👋"
2. "Eu sou o **Theo**, seu assistente virtual aqui da plataforma 🤖✨"
3. "Vi que você acabou de criar sua conta — seja muito bem-vindo(a)! 🎉"
4. "Estou aqui pra te ajudar em qualquer dúvida ou dificuldade na configuração."
5. "Se preferir, posso até agendar uma **call rápida com nosso time** pra te ajudar na implementação 😉"
6. "Posso te ajudar com algo agora?"

**Tabela nova `system_welcome_queue`:** id, user_id, phone, full_name, scheduled_at, processed, skipped_reason, created_at.

---

### Parte 2 — Painel de controle (NOVO)

Adicionar nova aba **"Boas-vindas"** em `/admin/ai-config` (`AdminAIConfig.tsx`):

| Controle | Tipo |
|---|---|
| Switch "Ativar sequência de boas-vindas" | toggle |
| Delay após cadastro (minutos) | number, default 3 |
| Delay entre mensagens (segundos) | number, default 4 |
| Lista editável de mensagens (textarea por item, add/remove/reorder) | array |
| Botão "Testar agora" — envia para um phone informado | action |
| Histórico (últimos 20 envios da `system_welcome_queue` com status) | tabela |

**Campos novos em `system_ai_config`:**
- `welcome_sequence_enabled` boolean default true
- `welcome_delay_minutes` int default 3
- `welcome_message_delay_seconds` int default 4
- `welcome_messages` jsonb default `[...]` (array de strings com `{primeiro_nome}` placeholder)

---

### Parte 3 — Agenda de suporte

Espelha o padrão existente de `appointment_types` + `appointments`, mas para o suporte/admin.

**Tabelas novas:**
- `support_appointment_types` — id, name, description, duration_minutes, days_of_week[], start_time, end_time, max_per_slot, is_active, timestamps. RLS: super_admin manage.
- `support_appointments` — id, type_id, user_ref_id (opcional), phone, contact_name, date, time, duration, status, notes, reminder_sent, timestamps. RLS: super_admin manage; user lê os seus.

**Tela admin nova `/admin/support-calendar`:**
- Aba 1 "Tipos de reunião" — UI igual `AppointmentSettings.tsx`
- Aba 2 "Agendamentos" — lista com data/contato/status/ações
- Item novo no `AdminSidebar`: "Agenda de Suporte" (ícone Calendar)

---

### Parte 4 — Function calling de agenda no `support-ai-agent`

Adicionar tools:
- `support_list_appointment_types` — lista tipos ativos
- `support_check_available_slots` — slots livres por data/tipo
- `support_create_appointment` — cria + notifica admins via system WA
- `support_list_my_appointments` — por phone
- `support_cancel_appointment` — por id

Atualizar `SYSTEM_PROMPT` informando capacidade de agendar reuniões com o time de suporte.

---

### Arquivos a criar / modificar

**Backend:**
- Migration: `system_welcome_queue` + colunas em `system_ai_config` + `support_appointment_types` + `support_appointments` + cron job `pg_cron`
- `supabase/functions/schedule-welcome-message/index.ts` (nova)
- `supabase/functions/send-welcome-sequence/index.ts` (nova, chamada pelo cron)
- `supabase/functions/support-ai-agent/index.ts` (novas tools + prompt)
- `supabase/config.toml` (registrar novas funções `verify_jwt=false`)

**Frontend:**
- `src/pages/Register.tsx` — chamar `schedule-welcome-message` após `notify-new-user`
- `src/pages/admin/AdminAIConfig.tsx` — nova aba "Boas-vindas" com toggle + editor + teste + histórico
- `src/pages/admin/AdminSupportCalendar.tsx` (nova) — 2 abas
- `src/hooks/useSystemAIConfig.ts` — adicionar campos welcome_*
- `src/hooks/useWelcomeQueue.ts` (novo) — leitura do histórico + ação de teste
- `src/hooks/useSupportAppointmentTypes.ts` + `useSupportAppointments.ts` (novos)
- `src/components/admin/AdminSidebar.tsx` — item "Agenda de Suporte"
- `src/App.tsx` — rota `/admin/support-calendar`

---

### Detalhes técnicos
- Normalização de telefone: prefixar `55` p/ 10-11 dígitos (padrão das outras edge functions)
- Delay entre mensagens: `setTimeout` controlado pela edge
- Anti-duplicidade: `total_messages > 0` em `system_whatsapp_conversations` ⇒ aborta
- Mensagens enviadas gravadas como `from_me:true` p/ o agente ter contexto
- Notificações de novos agendamentos: reusam `admin_notification_contacts` via instância system
- Voz: sequência de boas-vindas vai como texto por padrão (pode ler `voice_enabled` depois)

