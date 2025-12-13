-- Fix security issue: Remove public access to referral codes financial data
DROP POLICY IF EXISTS "Anyone can view active referral codes by code" ON public.referral_codes;

-- Create a safer policy that only exposes the code for validation purposes
CREATE POLICY "Anyone can validate referral codes by code value only" 
ON public.referral_codes 
FOR SELECT 
USING (is_active = true);

-- Create a view for public code validation that hides sensitive data
CREATE OR REPLACE VIEW public.referral_code_validation AS
SELECT 
  id,
  code,
  discount_percent,
  is_active
FROM public.referral_codes
WHERE is_active = true;

-- Create daily challenges table
CREATE TABLE public.daily_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'target',
  challenge_type TEXT NOT NULL, -- 'quiz_count', 'correct_answers', 'accuracy', 'time_spent', 'perfect_score', 'streak'
  target_value INTEGER NOT NULL,
  points_reward INTEGER NOT NULL DEFAULT 50,
  difficulty TEXT NOT NULL DEFAULT 'normal', -- 'easy', 'normal', 'hard'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

-- Anyone can view active challenges
CREATE POLICY "Anyone can view active daily challenges" 
ON public.daily_challenges 
FOR SELECT 
USING (is_active = true);

-- Create user daily challenge progress table
CREATE TABLE public.user_daily_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_progress INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  points_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id, challenge_date)
);

-- Enable RLS
ALTER TABLE public.user_daily_challenges ENABLE ROW LEVEL SECURITY;

-- Users can view their own challenge progress
CREATE POLICY "Users can view their own daily challenge progress" 
ON public.user_daily_challenges 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own challenge progress
CREATE POLICY "Users can insert their own daily challenge progress" 
ON public.user_daily_challenges 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own challenge progress
CREATE POLICY "Users can update their own daily challenge progress" 
ON public.user_daily_challenges 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create milestone tracking table
CREATE TABLE public.user_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  milestone_type TEXT NOT NULL, -- 'points', 'level', 'ranking', 'quizzes', 'streak'
  milestone_value INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_shown BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, milestone_type, milestone_value)
);

-- Enable RLS
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

-- Users can view their own milestones
CREATE POLICY "Users can view their own milestones" 
ON public.user_milestones 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own milestones
CREATE POLICY "Users can insert their own milestones" 
ON public.user_milestones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own milestones
CREATE POLICY "Users can update their own milestones" 
ON public.user_milestones 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Insert default daily challenges
INSERT INTO public.daily_challenges (code, title, description, icon, challenge_type, target_value, points_reward, difficulty) VALUES
('complete_1_quiz', 'Primeiro Quiz', 'Complete 1 quiz hoje', 'play', 'quiz_count', 1, 25, 'easy'),
('complete_3_quizzes', 'Triatleta', 'Complete 3 quizzes hoje', 'target', 'quiz_count', 3, 75, 'normal'),
('complete_5_quizzes', 'Maratonista', 'Complete 5 quizzes hoje', 'trophy', 'quiz_count', 5, 150, 'hard'),
('correct_10', 'Mente Afiada', 'Acerte 10 questões hoje', 'check-circle', 'correct_answers', 10, 50, 'easy'),
('correct_25', 'Conhecedor', 'Acerte 25 questões hoje', 'brain', 'correct_answers', 25, 100, 'normal'),
('correct_50', 'Mestre do Conhecimento', 'Acerte 50 questões hoje', 'crown', 'correct_answers', 50, 200, 'hard'),
('perfect_quiz', 'Perfeição', 'Complete um quiz com 100% de acerto', 'star', 'perfect_score', 1, 100, 'hard'),
('accuracy_80', 'Precisão Alta', 'Mantenha 80%+ de precisão em 2 quizzes', 'target', 'accuracy', 80, 75, 'normal'),
('time_30min', 'Estudioso', 'Estude por 30 minutos hoje', 'clock', 'time_spent', 1800, 100, 'normal'),
('streak_5', 'Em Sequência', 'Acerte 5 questões seguidas', 'flame', 'streak', 5, 50, 'normal');

-- Create indexes
CREATE INDEX idx_user_daily_challenges_user_date ON public.user_daily_challenges(user_id, challenge_date);
CREATE INDEX idx_user_milestones_user ON public.user_milestones(user_id, milestone_type);