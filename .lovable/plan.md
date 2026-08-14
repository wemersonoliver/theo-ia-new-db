# Bloqueio de horários na agenda

Permitir que o usuário bloqueie períodos da agenda (folga, almoço, feriado) para que nem a IA nem o painel criem agendamentos nesses horários.

## Como vai funcionar

- Na tela de Agendamentos, ao lado do botão "Novo", um botão **Bloquear horário**.
- No diálogo de bloqueio o usuário escolhe:
  - Motivo (ex: Almoço, Férias, Feriado)
  - Tipo: **Data específica** (uma data ou intervalo de datas) ou **Semanal fixo** (ex: toda segunda e quarta, 12:00–13:00)
  - Dia inteiro ou faixa de horário
- Bloqueios valem para toda a agenda da conta.
- No calendário os bloqueios aparecem como faixas cinza/hachuradas, distintas dos agendamentos, e podem ser removidos pelo drawer do dia.
- Ao tentar criar um agendamento em cima de um bloqueio, o sistema avisa e impede.
- A IA deixa de oferecer esses horários: os slots bloqueados somem da lista de horários disponíveis e a criação/remarcação é recusada com uma resposta natural ("nesse horário não temos disponibilidade, posso sugerir...").

## Detalhes técnicos

**Banco** — nova tabela `public.appointment_blocks`:
- `id`, `account_id`, `user_id` (criador), `reason` (text), `all_day` (bool)
- Pontual: `start_date`, `end_date` (date), `start_time`, `end_time` (time, nulos se dia inteiro)
- Recorrente: `recurrence` = `none` | `weekly`, `days_of_week` int[]
- `created_at`, `updated_at` + trigger de updated_at
- GRANTs para `authenticated` e `service_role`; RLS com `is_account_member(account_id)` para leitura e escrita (mesmo padrão de `appointments`).

**Frontend**
- `src/hooks/useAppointmentBlocks.ts`: listagem por range + criar/excluir.
- `src/components/appointments/BlockDialog.tsx`: formulário do bloqueio.
- `src/components/appointments/AppointmentCalendar.tsx` e `AppointmentDayDrawer.tsx`: renderizar e excluir bloqueios.
- `src/pages/Appointments.tsx`: botão e integração.
- `src/components/appointments/AppointmentDialog.tsx` / `useAppointments.createAppointment`: validação de conflito com bloqueio.

**Edge function `manage-appointment`**
- `check_available_slots`: carregar bloqueios da data (pontuais e semanais) e remover os horários cobertos, inclusive considerando a duração do serviço.
- `create_appointment` e remarcação: retornar erro de indisponibilidade se cair em bloqueio.
