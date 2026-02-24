-- Add response delay configuration
ALTER TABLE public.whatsapp_ai_config 
ADD COLUMN IF NOT EXISTS response_delay_seconds integer DEFAULT 5;

-- Create table to track pending AI responses
CREATE TABLE public.whatsapp_pending_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Enable RLS
ALTER TABLE public.whatsapp_pending_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own pending responses" 
ON public.whatsapp_pending_responses 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON COLUMN public.whatsapp_ai_config.response_delay_seconds IS 'Seconds to wait after last message before AI responds';