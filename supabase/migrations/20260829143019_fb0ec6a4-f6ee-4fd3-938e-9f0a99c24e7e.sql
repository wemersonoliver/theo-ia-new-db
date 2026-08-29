CREATE INDEX IF NOT EXISTS idx_wa_conv_user_last_msg ON public.whatsapp_conversations (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_account_last_msg ON public.whatsapp_conversations (account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_ai_active ON public.whatsapp_conversations (ai_active) WHERE ai_active = true;
CREATE INDEX IF NOT EXISTS idx_igreen_sc_events_dedupe ON public.igreen_scenario_events (enrollment_id, day_number, period, message_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_ai_config_reminder ON public.whatsapp_ai_config (reminder_enabled) WHERE reminder_enabled = true;
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON public.contacts USING GIN (tags);