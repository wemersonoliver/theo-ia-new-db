-- Create the knowledge-base storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false);

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload their own knowledge docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own knowledge docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own knowledge docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);