
-- Create storage bucket for tutorial videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read tutorial videos
CREATE POLICY "Anyone can read tutorial videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutorial-videos');

-- Allow super admins to upload tutorial videos
CREATE POLICY "Super admins can upload tutorial videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tutorial-videos' 
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Allow super admins to delete tutorial videos
CREATE POLICY "Super admins can delete tutorial videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tutorial-videos' 
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Add file_path column to store uploaded video path
ALTER TABLE public.onboarding_tutorial_videos 
ADD COLUMN IF NOT EXISTS file_path text;
