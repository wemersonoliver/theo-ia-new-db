
ALTER TABLE public.igreen_account_products
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS followup_after_video_seconds integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS followup_after_video_message text NOT NULL DEFAULT 'Conseguiu ver, {nome}?';

CREATE TABLE IF NOT EXISTS public.igreen_product_video_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  product_id uuid REFERENCES public.igreen_account_products(id) ON DELETE SET NULL,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_igreen_product_video_followups_pending
  ON public.igreen_product_video_followups (scheduled_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_igreen_product_video_followups_phone
  ON public.igreen_product_video_followups (account_id, phone)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE public.igreen_product_video_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their video followups"
  ON public.igreen_product_video_followups
  FOR SELECT
  USING (public.is_account_member(account_id));

CREATE TRIGGER trg_igreen_product_video_followups_updated_at
  BEFORE UPDATE ON public.igreen_product_video_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
