-- Criar bucket para base de conhecimento
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', false);

-- Políticas de storage
CREATE POLICY "Users can upload to their folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their files" ON storage.objects FOR SELECT USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their files" ON storage.objects FOR DELETE USING (bucket_id = 'knowledge-base' AND auth.uid()::text = (storage.foldername(name))[1]);