
-- Create public bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access (needed for <img>, <audio>, <video> tags via public URL)
CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Service role manages files (edge functions use service role; these block authenticated/anon writes)
CREATE POLICY "Service role inserts whatsapp media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Service role updates whatsapp media"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Service role deletes whatsapp media"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'whatsapp-media');
