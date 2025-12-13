-- Create table to track AI mentor usage
CREATE TABLE public.ai_mentor_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  questions_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.ai_mentor_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own AI mentor usage"
ON public.ai_mentor_usage
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI mentor usage"
ON public.ai_mentor_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI mentor usage"
ON public.ai_mentor_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_mentor_usage_updated_at
BEFORE UPDATE ON public.ai_mentor_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();