## Limpeza do número 5547991293662

Encontrei dados deste número nas seguintes tabelas (account `1aae0245...`, contato "Thays"):

- `contacts` — 1 registro (Thays)
- `whatsapp_conversations` — 1 conversa (nome "Theo")
- `whatsapp_ai_sessions` — 1 sessão
- `whatsapp_pending_responses` — 1 pendência
- `igreen_lead_data` — 1 registro

## Ação

Executar migration que apaga, para `phone = '5547991293662'`:

1. `whatsapp_pending_responses`
2. `whatsapp_ai_sessions`
3. `whatsapp_conversations`
4. `igreen_lead_data`
5. `igreen_scenario_enrollments` (por `contact_phone`)
6. `igreen_product_video_followups`
7. `custom_followup_enrollments` / `events` / `queue`
8. `followup_tracking`
9. `roulette_assignments`
10. `appointments`
11. `attendance_flow_runs`
12. `ai_voice_usage`
13. `crm_deals` ligados ao `contact_id` da Thays (cascateia activities/products)
14. `contacts` (Thays)

Resultado: número 100% limpo, pronto para iniciar novo fluxo do zero quando voltar a mandar mensagem.

Confirma para eu aplicar?