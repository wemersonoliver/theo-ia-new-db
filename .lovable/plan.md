Reduzir o onboarding para 3 passos pós boas-vindas: Entrevista IA → Conectar WhatsApp → Testar Prompt. A entrevista passa a coletar tudo que era passo separado (agendamentos, endereço, contato de notificação) e o backend aplica automaticamente as configurações no final.

## Novo fluxo

```text
Boas-vindas → 1. Entrevista IA → 2. Conectar WhatsApp → 3. Testar Prompt → Concluído
```

## Mudanças

### `src/pages/Onboarding.tsx`
- Reduzir `OnboardingStep` para `welcome | interview | whatsapp | test_prompt | completed` e remover toda a lógica de skippedSteps/usesAppointments/hasPublicLocation.
- Remover os componentes `AppointmentsQuestionStep`, `AppointmentsConfigStep`, `LocationQuestionStep`, `LocationStep` (e imports não usados).
- `WelcomeStep` aponta direto para `interview`.
- `handleFinish` aplica como fallback: `max_messages_without_human=50`, `response_delay_seconds=15`, agente ativo 24h, followup habilitado — caso o usuário pule a entrevista.
- Remover botão "Pular este passo" do `InterviewStep`.

### `supabase/functions/interview-ai-agent/index.ts`
Expandir o `SYSTEM_PROMPT` com itens obrigatórios adicionais antes do `[FINISH]`:
- **Agendamentos**: pergunta se trabalha com agendamentos. Se sim, coletar tipos (nome, duração em minutos, dias da semana, horário início/fim).
- **Notificações**: número de WhatsApp para receber alertas (novos agendamentos, transferências para humano).
- **Endereço**: endereço completo do atendimento (ou "100% online").

No `[FINISH]`, junto com `extractAndSaveBusinessData`, rodar nova chamada Gemini com function call `registrar_configuracao_negocio` que extrai estruturadamente:
- `agent_name`, `business_niche`, `business_description`
- `uses_appointments`, `appointment_types[]`
- `notification_phone`
- `business_address`, `business_location_name`

Com service role:
- **upsert em `whatsapp_ai_config`** (por `account_id` resolvido por `accounts.owner_user_id`):
  - `agent_name`, `business_niche`, `business_description`, `custom_prompt`
  - `business_address`, `business_location_name`
  - `active=true`, `business_hours_start='00:00'`, `business_hours_end='23:59'`, `business_days=[0..6]`
  - `max_messages_without_human=50`, `response_delay_seconds=15`
- **insert em `appointment_types`** para cada tipo coletado (com `user_id` + `account_id`).
- **insert em `notification_contacts`** (com `notify_appointments=true`, `notify_handoffs=true`) se número fornecido.
- **upsert em `followup_config`** com `enabled=true` + defaults da tabela.

### `src/components/ai/InterviewTab.tsx`
- `handleApply`: o backend já configurou tudo no `[FINISH]`. Manter apenas a confirmação visual e o `onPromptApplied?.()`.
- Funciona igual quando acessada via menu Configurações (refazer entrevista reaplica configs).

### `InterviewStep` (Onboarding.tsx)
- Após `state === "completed"`, mostrar um pequeno resumo do que foi configurado automaticamente (X tipos de agendamento, contato de notificação, endereço) antes de avançar para o passo WhatsApp.

## Detalhes técnicos

- **Resolução de `account_id`**: edge function busca `accounts` por `owner_user_id = userId`.
- **Defaults aplicados sempre** em `whatsapp_ai_config`: 50 mensagens sem humano, 15s de espera, 24h ativo.
- **Followup**: usa defaults da própria coluna + `enabled=true`.
- **Itens antigos do onboarding** (Agendamentos, Endereço, Notificações) continuam acessíveis pelo menu Configurações para ajustes futuros.

## Riscos
- A IA precisará fazer 2-3 perguntas a mais (notificações, agendamento estruturado). Reforço claro no `SYSTEM_PROMPT`.
- Se o usuário pular a entrevista, fallback no `handleFinish` garante os defaults solicitados (50 msgs, 15s).
