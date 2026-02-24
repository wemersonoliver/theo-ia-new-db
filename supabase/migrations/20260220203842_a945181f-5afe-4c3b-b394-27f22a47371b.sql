
-- Criar tabela entrevistas_config para armazenar sessões de entrevista consultiva
CREATE TABLE public.entrevistas_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  segment TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.entrevistas_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage their own interviews"
  ON public.entrevistas_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger de updated_at
CREATE TRIGGER update_entrevistas_config_updated_at
  BEFORE UPDATE ON public.entrevistas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
