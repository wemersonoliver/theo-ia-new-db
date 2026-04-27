CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');