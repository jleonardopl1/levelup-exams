-- Create questions table for the exam simulator
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enunciado TEXT NOT NULL,
  alternativas TEXT[] NOT NULL,
  correta INTEGER NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  dificuldade TEXT NOT NULL DEFAULT 'Médio',
  explicacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  total_quizzes INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Create quiz_results table for storing exam results
CREATE TABLE public.quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_spent_seconds INTEGER,
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_answers table for tracking individual answers
CREATE TABLE public.user_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  quiz_result_id UUID REFERENCES public.quiz_results(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

-- Questions are readable by everyone (public data)
CREATE POLICY "Questions are viewable by everyone" 
ON public.questions 
FOR SELECT 
USING (true);

-- Profile policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Quiz results policies
CREATE POLICY "Users can view their own quiz results" 
ON public.quiz_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results" 
ON public.quiz_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- User answers policies
CREATE POLICY "Users can view their own answers" 
ON public.user_answers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers" 
ON public.user_answers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for viewing public leaderboard (top scores only)
CREATE POLICY "Anyone can view quiz results for leaderboard" 
ON public.quiz_results 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can view profiles for leaderboard" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'display_name', new.email));
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update profile timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profile updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample questions for TJ exam
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao) VALUES
('De acordo com a Constituição Federal, qual é o prazo para impetração de mandado de segurança?', 
 ARRAY['30 dias', '60 dias', '90 dias', '120 dias'], 
 3, 'Direito Constitucional', 'Médio',
 'O prazo decadencial para impetração de mandado de segurança é de 120 dias, contado da ciência do ato impugnado.'),
 
('Qual princípio administrativo NÃO está expressamente previsto no caput do artigo 37 da CF/88?',
 ARRAY['Legalidade', 'Impessoalidade', 'Razoabilidade', 'Publicidade'],
 2, 'Direito Administrativo', 'Fácil',
 'O art. 37, caput, prevê expressamente: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência (LIMPE). A razoabilidade é princípio implícito.'),

('No processo civil, o prazo para contestação no procedimento comum é de:',
 ARRAY['5 dias', '10 dias', '15 dias', '30 dias'],
 2, 'Direito Processual Civil', 'Fácil',
 'Conforme o art. 335 do CPC, o réu poderá oferecer contestação, por petição, no prazo de 15 dias.'),

('A competência para processar e julgar os crimes contra a organização do trabalho é:',
 ARRAY['Justiça do Trabalho', 'Justiça Federal', 'Justiça Estadual', 'Justiça Militar'],
 1, 'Direito Penal', 'Médio',
 'De acordo com o art. 109, VI, da CF, compete à Justiça Federal processar e julgar os crimes contra a organização do trabalho.'),

('Sobre a Lei de Improbidade Administrativa, qual ato NÃO constitui improbidade?',
 ARRAY['Enriquecimento ilícito', 'Lesão ao erário', 'Erro administrativo de boa-fé', 'Atentar contra princípios da administração'],
 2, 'Direito Administrativo', 'Médio',
 'O erro administrativo praticado de boa-fé não configura improbidade administrativa, que exige dolo ou culpa grave.'),

('O habeas corpus é cabível quando:',
 ARRAY['Há violação de direito líquido e certo', 'Há coação ilegal à liberdade de locomoção', 'Há omissão de autoridade pública', 'Há negativa de informação pública'],
 1, 'Direito Constitucional', 'Fácil',
 'O habeas corpus é remédio constitucional cabível sempre que alguém sofrer ou se achar ameaçado de sofrer coação em sua liberdade de locomoção.'),

('No Direito Civil, a prescrição extintiva ordinária é de:',
 ARRAY['3 anos', '5 anos', '10 anos', '20 anos'],
 2, 'Direito Civil', 'Médio',
 'O art. 205 do Código Civil estabelece que a prescrição ocorre em 10 anos, quando a lei não lhe haja fixado prazo menor.'),

('Qual é o quórum para aprovação de emenda constitucional?',
 ARRAY['Maioria simples', 'Maioria absoluta', '2/3 dos membros', '3/5 dos membros em dois turnos'],
 3, 'Direito Constitucional', 'Médio',
 'A CF exige aprovação por 3/5 dos membros de cada Casa do Congresso Nacional, em dois turnos de votação.'),

('O princípio da insignificância exclui:',
 ARRAY['A culpabilidade', 'A ilicitude', 'A tipicidade', 'A punibilidade'],
 2, 'Direito Penal', 'Difícil',
 'O princípio da insignificância ou bagatela exclui a tipicidade material da conduta, afastando o crime.'),

('No processo administrativo federal, o prazo para interposição de recurso hierárquico é de:',
 ARRAY['5 dias', '10 dias', '15 dias', '30 dias'],
 1, 'Direito Administrativo', 'Médio',
 'Conforme a Lei 9.784/99, o prazo para interposição de recurso administrativo é de 10 dias, salvo disposição legal específica.');