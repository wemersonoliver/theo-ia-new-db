
-- Remove FK constraint that references auth.users
ALTER TABLE public.admin_crm_deals DROP CONSTRAINT IF EXISTS admin_crm_deals_user_ref_id_fkey;

-- Insert deals for existing users
INSERT INTO public.admin_crm_deals (stage_id, user_ref_id, title, position, onboarding_completed, subscription_status, subscription_plan)
SELECT 
  (SELECT s.id FROM public.admin_crm_stages s JOIN public.admin_crm_pipelines p ON p.id = s.pipeline_id ORDER BY p.created_at ASC, s.position ASC LIMIT 1),
  p.user_id,
  COALESCE(p.full_name, split_part(p.email, '@', 1)),
  ROW_NUMBER() OVER (ORDER BY p.created_at ASC) - 1,
  p.onboarding_completed,
  sub.status,
  sub.plan_type
FROM public.profiles p
LEFT JOIN public.subscriptions sub ON sub.user_id = p.user_id
WHERE NOT EXISTS (SELECT 1 FROM public.admin_crm_deals d WHERE d.user_ref_id = p.user_id);
