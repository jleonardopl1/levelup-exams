-- Create rewards/points system tables
CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  consecutive_correct integer NOT NULL DEFAULT 0,
  max_consecutive_correct integer NOT NULL DEFAULT 0,
  total_time_seconds integer NOT NULL DEFAULT 0,
  last_session_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Achievements/badges table
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'star',
  points_reward integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User unlocked achievements
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Redeemable rewards catalog
CREATE TABLE public.reward_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  points_cost integer NOT NULL,
  reward_type text NOT NULL,
  reward_value jsonb NOT NULL,
  available_for_tier text NOT NULL DEFAULT 'free',
  is_active boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User redeemed rewards history
CREATE TABLE public.user_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.reward_catalog(id),
  points_spent integer NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz
);

-- Referral codes for Top Players
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  discount_percent integer NOT NULL DEFAULT 10,
  commission_percent numeric(4,2) NOT NULL DEFAULT 3.00,
  is_active boolean NOT NULL DEFAULT true,
  total_uses integer NOT NULL DEFAULT 0,
  total_earnings numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Referral usage tracking
CREATE TABLE public.referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  referred_user_id uuid NOT NULL REFERENCES auth.users(id),
  subscription_amount numeric(10,2),
  commission_earned numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

-- Enable RLS
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_rewards
CREATE POLICY "Users can view their own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own rewards" ON public.user_rewards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rewards" ON public.user_rewards FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for achievements (public read)
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);

-- RLS Policies for user_achievements
CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for reward_catalog (public read)
CREATE POLICY "Anyone can view active rewards" ON public.reward_catalog FOR SELECT USING (is_active = true);

-- RLS Policies for user_redemptions
CREATE POLICY "Users can view their own redemptions" ON public.user_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own redemptions" ON public.user_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for referral_codes
CREATE POLICY "Users can view their own referral code" ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own referral code" ON public.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active referral codes by code" ON public.referral_codes FOR SELECT USING (is_active = true);

-- RLS Policies for referral_uses
CREATE POLICY "Referral owners can view their uses" ON public.referral_uses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.referral_codes rc WHERE rc.id = referral_code_id AND rc.user_id = auth.uid())
);

-- Insert default achievements
INSERT INTO public.achievements (code, name, description, icon, points_reward, tier, requirement_type, requirement_value) VALUES
('first_quiz', 'Primeiro Passo', 'Complete seu primeiro quiz', 'trophy', 50, 'bronze', 'total_quizzes', 1),
('streak_3', 'Dedicação', '3 dias seguidos de estudo', 'flame', 100, 'bronze', 'streak_days', 3),
('streak_7', 'Semana Perfeita', '7 dias seguidos de estudo', 'flame', 250, 'silver', 'streak_days', 7),
('streak_30', 'Mestre da Consistência', '30 dias seguidos de estudo', 'flame', 1000, 'gold', 'streak_days', 30),
('correct_50', 'Estudante Aplicado', '50 respostas corretas', 'check-circle', 100, 'bronze', 'total_correct', 50),
('correct_200', 'Conhecedor', '200 respostas corretas', 'check-circle', 300, 'silver', 'total_correct', 200),
('correct_500', 'Especialista', '500 respostas corretas', 'check-circle', 750, 'gold', 'total_correct', 500),
('correct_1000', 'Mestre do Conhecimento', '1000 respostas corretas', 'check-circle', 2000, 'platinum', 'total_correct', 1000),
('combo_5', 'Em Série', '5 acertos consecutivos', 'zap', 75, 'bronze', 'consecutive_correct', 5),
('combo_10', 'Imparável', '10 acertos consecutivos', 'zap', 200, 'silver', 'consecutive_correct', 10),
('combo_20', 'Lenda', '20 acertos consecutivos', 'zap', 500, 'gold', 'consecutive_correct', 20),
('quizzes_10', 'Praticante', 'Complete 10 quizzes', 'book-open', 150, 'bronze', 'total_quizzes', 10),
('quizzes_50', 'Veterano', 'Complete 50 quizzes', 'book-open', 500, 'silver', 'total_quizzes', 50),
('quizzes_100', 'Elite', 'Complete 100 quizzes', 'book-open', 1500, 'gold', 'total_quizzes', 100),
('time_60', 'Hora de Estudo', '60 minutos de estudo', 'clock', 100, 'bronze', 'total_time_minutes', 60),
('time_300', 'Maratonista', '5 horas de estudo', 'clock', 400, 'silver', 'total_time_minutes', 300),
('time_1000', 'Dedicação Total', '16+ horas de estudo', 'clock', 1000, 'gold', 'total_time_minutes', 1000);

-- Insert default reward catalog
INSERT INTO public.reward_catalog (code, name, description, points_cost, reward_type, reward_value, available_for_tier) VALUES
('extra_5', '+5 Questões Extras', 'Ganhe 5 questões adicionais por hoje', 100, 'extra_questions', '{"amount": 5}', 'free'),
('extra_10', '+10 Questões Extras', 'Ganhe 10 questões adicionais por hoje', 180, 'extra_questions', '{"amount": 10}', 'free'),
('discount_10', '10% de Desconto', 'Cupom de 10% na assinatura Plus', 500, 'discount_coupon', '{"percent": 10}', 'free'),
('discount_20', '20% de Desconto', 'Cupom de 20% na assinatura Plus', 900, 'discount_coupon', '{"percent": 20}', 'free'),
('free_week', 'Semana Grátis', '7 dias de acesso Plus grátis', 1500, 'free_trial', '{"days": 7}', 'free'),
('free_month', 'Mês Grátis', '30 dias de acesso Plus grátis', 5000, 'free_trial', '{"days": 30}', 'free'),
('top_player', 'Top Player Status', 'Torne-se um Top Player com código de indicação', 10000, 'top_player', '{"commission_percent": 3}', 'plus');

-- Create trigger for updated_at
CREATE TRIGGER update_user_rewards_updated_at
  BEFORE UPDATE ON public.user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();