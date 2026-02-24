-- Add unique constraint on user_id to allow proper upsert
ALTER TABLE public.whatsapp_instances 
ADD CONSTRAINT whatsapp_instances_user_id_unique UNIQUE (user_id);