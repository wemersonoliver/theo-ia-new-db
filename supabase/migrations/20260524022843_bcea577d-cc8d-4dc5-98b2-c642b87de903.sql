DO $$
DECLARE
  v_phone text := '5547989118695';
BEGIN
  DELETE FROM public.crm_deal_products WHERE deal_id IN (
    SELECT d.id FROM public.crm_deals d JOIN public.contacts c ON c.id = d.contact_id WHERE c.phone = v_phone
  );
  DELETE FROM public.crm_deal_tasks WHERE deal_id IN (
    SELECT d.id FROM public.crm_deals d JOIN public.contacts c ON c.id = d.contact_id WHERE c.phone = v_phone
  );
  DELETE FROM public.crm_activities WHERE deal_id IN (
    SELECT d.id FROM public.crm_deals d JOIN public.contacts c ON c.id = d.contact_id WHERE c.phone = v_phone
  );
  DELETE FROM public.crm_deals WHERE contact_id IN (SELECT id FROM public.contacts WHERE phone = v_phone);

  DELETE FROM public.whatsapp_pending_responses WHERE phone = v_phone;
  DELETE FROM public.whatsapp_ai_sessions WHERE phone = v_phone;
  DELETE FROM public.whatsapp_conversations WHERE phone = v_phone;

  DELETE FROM public.igreen_product_video_followups WHERE phone = v_phone;
  DELETE FROM public.igreen_scenario_enrollments WHERE contact_phone = v_phone;
  DELETE FROM public.igreen_lead_data WHERE phone = v_phone;

  DELETE FROM public.followup_messages WHERE tracking_id IN (SELECT id FROM public.followup_tracking WHERE phone = v_phone);
  DELETE FROM public.followup_tracking WHERE phone = v_phone;
  DELETE FROM public.custom_followup_queue WHERE enrollment_id IN (SELECT id FROM public.custom_followup_enrollments WHERE phone = v_phone);
  DELETE FROM public.custom_followup_enrollments WHERE phone = v_phone;

  DELETE FROM public.roulette_assignments WHERE phone = v_phone;

  DELETE FROM public.appointments WHERE phone = v_phone;

  DELETE FROM public.contacts WHERE phone = v_phone;
END $$;