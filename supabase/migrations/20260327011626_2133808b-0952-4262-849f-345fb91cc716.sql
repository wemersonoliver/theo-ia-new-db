
CREATE TABLE public.onboarding_tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL UNIQUE,
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage tutorial videos"
  ON public.onboarding_tutorial_videos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can read tutorial videos"
  ON public.onboarding_tutorial_videos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_onboarding_tutorial_videos_updated_at
  BEFORE UPDATE ON public.onboarding_tutorial_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
