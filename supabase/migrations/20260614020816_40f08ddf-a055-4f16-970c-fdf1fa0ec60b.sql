UPDATE igreen_conversation_state
SET extras = extras - 'distribuidora' - 'discount_lookup_done'
                    - 'discount_min_percent' - 'discount_max_percent'
                    - 'signup_pitch_sent'
WHERE phone = '5571987620493';