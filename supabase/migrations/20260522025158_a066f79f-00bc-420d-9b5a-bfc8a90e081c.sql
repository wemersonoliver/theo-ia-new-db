
DELETE FROM crm_deal_products WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE phone='5547999491328'));
DELETE FROM crm_deal_tasks WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE phone='5547999491328'));
DELETE FROM crm_activities WHERE deal_id IN (SELECT id FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE phone='5547999491328'));
DELETE FROM crm_deals WHERE contact_id IN (SELECT id FROM contacts WHERE phone='5547999491328');

DELETE FROM igreen_lead_data WHERE phone='5547999491328';
DELETE FROM igreen_scenario_enrollments WHERE contact_phone='5547999491328';

DELETE FROM custom_followup_events WHERE phone='5547999491328';
DELETE FROM custom_followup_queue WHERE phone='5547999491328';
DELETE FROM custom_followup_enrollments WHERE phone='5547999491328';

DELETE FROM followup_tracking WHERE phone='5547999491328';

DELETE FROM whatsapp_pending_responses WHERE phone='5547999491328';
DELETE FROM whatsapp_ai_sessions WHERE phone='5547999491328';
DELETE FROM whatsapp_conversations WHERE phone='5547999491328';
DELETE FROM contacts WHERE phone='5547999491328';
