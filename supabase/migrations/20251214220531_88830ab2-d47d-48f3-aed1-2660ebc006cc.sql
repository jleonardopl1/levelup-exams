-- Create career_categories table
CREATE TABLE public.career_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'briefcase',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table (matérias)
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  career_category_id UUID NOT NULL REFERENCES public.career_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'book',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add subject_id to questions table
ALTER TABLE public.questions 
ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Enable RLS on both tables
ALTER TABLE public.career_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for career_categories (public read)
CREATE POLICY "Anyone can view active career categories" 
ON public.career_categories 
FOR SELECT 
USING (is_active = true);

-- Create RLS policies for subjects (public read)
CREATE POLICY "Anyone can view active subjects" 
ON public.subjects 
FOR SELECT 
USING (is_active = true);

-- Create indexes for better performance
CREATE INDEX idx_subjects_career_category ON public.subjects(career_category_id);
CREATE INDEX idx_questions_subject ON public.questions(subject_id);

-- Insert career categories
INSERT INTO public.career_categories (name, description, icon, display_order) VALUES
('Carreiras Policiais', 'Polícia Civil, Polícia Federal, PRF, PM e Bombeiros', 'shield', 1),
('Carreiras Jurídicas', 'Magistratura, MP, Defensoria, Procuradorias, Advocacia Pública', 'scale', 2),
('Área Fiscal e Controle', 'Receitas, SEFAZ, ISS, TCE/TCU, CGU, Auditoria', 'calculator', 3),
('Bancária e Financeira', 'Banco do Brasil, Caixa, bancos públicos/privados', 'landmark', 4),
('Administração Pública', 'Prefeituras, secretarias, autarquias, cargos administrativos', 'building-2', 5),
('Educação', 'Professores, pedagogos, técnicos educacionais', 'graduation-cap', 6),
('Saúde', 'Enfermagem, medicina, fisioterapia, odontologia', 'heart-pulse', 7),
('Tecnologia da Informação', 'Analista, desenvolvedor, infraestrutura, dados, segurança', 'laptop', 8);

-- Insert subjects for Carreiras Policiais
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Língua Portuguesa', 'book-open', 1 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Direito Penal e Processo Penal', 'gavel', 2 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Legislação Penal Especial', 'file-text', 3 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Direito Constitucional e Administrativo', 'scroll', 4 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Criminologia e Direitos Humanos', 'users', 5 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Raciocínio Lógico e Matemática', 'brain', 6 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Informática', 'monitor', 7 FROM public.career_categories WHERE name = 'Carreiras Policiais'
UNION ALL
SELECT id, 'Legislação Institucional', 'landmark', 8 FROM public.career_categories WHERE name = 'Carreiras Policiais';

-- Insert subjects for Carreiras Jurídicas
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Constitucional', 'scroll', 2 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Administrativo', 'building', 3 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Civil e Processo Civil', 'file-text', 4 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Penal e Processo Penal', 'gavel', 5 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito do Trabalho e Processo do Trabalho', 'briefcase', 6 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Tributário e Financeiro', 'receipt', 7 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Empresarial', 'building-2', 8 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Direito Ambiental, ECA, CDC e Direitos Humanos', 'leaf', 9 FROM public.career_categories WHERE name = 'Carreiras Jurídicas'
UNION ALL
SELECT id, 'Peças e Prática Jurídica', 'pen-tool', 10 FROM public.career_categories WHERE name = 'Carreiras Jurídicas';

-- Insert subjects for Área Fiscal e Controle
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Raciocínio Lógico e Estatística', 'brain', 2 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Contabilidade Geral e Pública', 'calculator', 3 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Administração Financeira e Orçamentária', 'wallet', 4 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Direito Tributário e Legislação Tributária', 'receipt', 5 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Direito Constitucional e Administrativo', 'scroll', 6 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Auditoria', 'search', 7 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Economia e Finanças Públicas', 'trending-up', 8 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'TI, Sistemas e Governança de TI', 'laptop', 9 FROM public.career_categories WHERE name = 'Área Fiscal e Controle'
UNION ALL
SELECT id, 'Administração e Gestão Pública', 'building-2', 10 FROM public.career_categories WHERE name = 'Área Fiscal e Controle';

-- Insert subjects for Bancária e Financeira
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Matemática e Raciocínio Lógico', 'brain', 2 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Informática', 'monitor', 3 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Conhecimentos Bancários', 'landmark', 4 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Atualidades do Mercado Financeiro', 'trending-up', 5 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Vendas, Negociação e Atendimento', 'handshake', 6 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Noções de Direito do Consumidor', 'shield', 7 FROM public.career_categories WHERE name = 'Bancária e Financeira'
UNION ALL
SELECT id, 'Ética, Compliance e PLD-FT', 'check-circle', 8 FROM public.career_categories WHERE name = 'Bancária e Financeira';

-- Insert subjects for Administração Pública
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Raciocínio Lógico e Matemática', 'brain', 2 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Informática', 'monitor', 3 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Direito Constitucional e Administrativo', 'scroll', 4 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Administração Geral e Pública', 'building-2', 5 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Gestão de Pessoas', 'users', 6 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Administração de Materiais e Logística', 'package', 7 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Licitações e Contratos', 'file-text', 8 FROM public.career_categories WHERE name = 'Administração Pública'
UNION ALL
SELECT id, 'Arquivologia e Redação Oficial', 'archive', 9 FROM public.career_categories WHERE name = 'Administração Pública';

-- Insert subjects for Educação
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Legislação Educacional', 'scroll', 2 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Didática e Metodologias de Ensino', 'presentation', 3 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Psicologia da Educação', 'brain', 4 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Avaliação da Aprendizagem', 'clipboard-check', 5 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Políticas Públicas de Educação', 'landmark', 6 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Conhecimentos Específicos da Disciplina', 'book', 7 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'Inclusão e Educação Especial', 'heart', 8 FROM public.career_categories WHERE name = 'Educação'
UNION ALL
SELECT id, 'ECA e Direitos Humanos', 'shield', 9 FROM public.career_categories WHERE name = 'Educação';

-- Insert subjects for Saúde
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Saúde Pública e SUS', 'heart-pulse', 2 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Epidemiologia e Vigilância em Saúde', 'activity', 3 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Biossegurança, Ética e Legislação', 'shield', 4 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Noções de Administração Pública', 'building-2', 5 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Conhecimentos Específicos da Profissão', 'stethoscope', 6 FROM public.career_categories WHERE name = 'Saúde'
UNION ALL
SELECT id, 'Farmacologia e Procedimentos', 'pill', 7 FROM public.career_categories WHERE name = 'Saúde';

-- Insert subjects for Tecnologia da Informação
INSERT INTO public.subjects (career_category_id, name, icon, display_order)
SELECT id, 'Português', 'book-open', 1 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Raciocínio Lógico, Matemática e Estatística', 'brain', 2 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Algoritmos e Estruturas de Dados', 'code', 3 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Programação e Engenharia de Software', 'terminal', 4 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Banco de Dados', 'database', 5 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Redes, Sistemas Operacionais e Cloud', 'cloud', 6 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Segurança da Informação', 'lock', 7 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Arquitetura, DevOps e CI/CD', 'git-branch', 8 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Governança e Gestão de TI', 'settings', 9 FROM public.career_categories WHERE name = 'Tecnologia da Informação'
UNION ALL
SELECT id, 'Dados, BI e Analytics', 'bar-chart-2', 10 FROM public.career_categories WHERE name = 'Tecnologia da Informação';