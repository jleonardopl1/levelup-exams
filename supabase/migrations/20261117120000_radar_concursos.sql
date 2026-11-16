-- =============================================================================
-- RADAR DE CONCURSOS — grupo multiagente de pesquisa, monitoramento de editais e
-- criação de novas trilhas (docs/RADAR_CONCURSOS.md).
--
-- Hierarquia (Edge Function radar-concursos):
--   Gerente master (orquestrador em código: orçamento, prioridade, consolidação)
--     └─ Coordenador de cada ÁREA (radar_areas: uma linha = um coordenador)
--          └─ Especialistas: Batedor (triagem), Analista de edital (extração com
--             evidência), Verificador (independente), Analista de banca e
--             Arquiteto de trilha (rascunho de trilha a partir do edital).
--
-- Princípios: só fatos com EVIDÊNCIA literal na fonte oficial; na dúvida a
-- atualização vai para revisão humana (falha fechada); o aluno é avisado pelas
-- notificações do app quando um concurso ou área que ele acompanha muda.
--
-- Idempotente e tolerante à ordem de publicação (a função funciona antes desta
-- migration só para responder 503; nada quebra).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Áreas de estudo (cada área tem um agente coordenador)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL,
  description text,
  -- Orientação do coordenador da área: carreiras, órgãos típicos, o que priorizar.
  focus text NOT NULL DEFAULT '',
  career_category_name text,
  icon text NOT NULL DEFAULT 'radar',
  -- Peso da área na fila do gerente master (1 = normal; maior = verificada antes).
  priority integer NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- 2. Fontes monitoradas (páginas oficiais de bancas, órgãos e diários)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE CHECK (url ~ '^https://[^[:space:]]+$' AND length(url) BETWEEN 12 AND 500),
  kind text NOT NULL DEFAULT 'banca' CHECK (kind IN ('banca', 'orgao', 'diario_oficial', 'agregador', 'outro')),
  -- NULL = fonte geral: o Batedor classifica cada concurso na área certa.
  area_id uuid REFERENCES public.radar_areas(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  check_interval_hours integer NOT NULL DEFAULT 12 CHECK (check_interval_hours BETWEEN 1 AND 168),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  -- Hash do TEXTO normalizado (não do HTML: evita "mudanças" de carimbo de hora).
  last_hash text,
  -- Último texto visto (até ~200 mil caracteres): base do diff que vai para a triagem.
  last_text text,
  last_status text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_sources_due ON public.radar_sources (is_active, last_checked_at NULLS FIRST);

-- -----------------------------------------------------------------------------
-- 3. Concursos acompanhados pelo radar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_concursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  area_id uuid REFERENCES public.radar_areas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  orgao text NOT NULL,
  banca text,
  esfera text CHECK (esfera IS NULL OR esfera IN ('federal', 'estadual', 'distrital', 'municipal')),
  uf text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  municipio text,
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN (
    'previsto', 'autorizado', 'banca_definida', 'edital_publicado', 'inscricoes_abertas',
    'inscricoes_encerradas', 'prova_aplicada', 'resultado_final', 'homologado', 'suspenso', 'cancelado'
  )),
  cargos text[] NOT NULL DEFAULT '{}',
  vagas integer CHECK (vagas IS NULL OR vagas BETWEEN 0 AND 500000),
  salario_max numeric(10, 2) CHECK (salario_max IS NULL OR salario_max BETWEEN 0 AND 500000),
  escolaridade text[] NOT NULL DEFAULT '{}',
  inscricoes_inicio date,
  inscricoes_fim date,
  data_prova date,
  link_oficial text CHECK (link_oficial IS NULL OR link_oficial ~ '^https?://'),
  -- Relevância 0–100 (abrangência, vagas, salário, fase, interesse dos alunos): scoring.ts.
  relevance integer NOT NULL DEFAULT 0 CHECK (relevance BETWEEN 0 AND 100),
  track_id uuid REFERENCES public.study_tracks(id) ON DELETE SET NULL,
  -- Sugerido para virar trilha (edital publicado + relevância alta + sem trilha).
  track_suggested boolean NOT NULL DEFAULT false,
  -- Só aparece para alunos depois de verificado (automático) ou aprovado por um admin.
  is_published boolean NOT NULL DEFAULT false,
  source_id uuid REFERENCES public.radar_sources(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_update_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_concursos_area ON public.radar_concursos (area_id, relevance DESC);
CREATE INDEX IF NOT EXISTS idx_radar_concursos_status ON public.radar_concursos (status) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_radar_concursos_track ON public.radar_concursos (track_id) WHERE track_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Linha do tempo de atualizações (o que mudou, com evidência)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id uuid NOT NULL REFERENCES public.radar_concursos(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.radar_sources(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'outro' CHECK (kind IN ('novo', 'status', 'datas', 'vagas', 'retificacao', 'documento', 'outro')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critica', 'info')),
  title text NOT NULL,
  summary text,
  -- [{campo, antes, depois, evidencia}] — só campos com evidência literal na fonte.
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Campos a aplicar no concurso quando a atualização for aprovada (revisão humana).
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_url text,
  review_status text NOT NULL DEFAULT 'pendente' CHECK (review_status IN ('publicada', 'pendente', 'rejeitada')),
  review_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_updates_concurso ON public.radar_updates (concurso_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_updates_pending ON public.radar_updates (created_at DESC) WHERE review_status = 'pendente';

-- -----------------------------------------------------------------------------
-- 5. Quem acompanha o quê (concurso ou área/carreira)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concurso_id uuid REFERENCES public.radar_concursos(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.radar_areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_follows_one_target CHECK (num_nonnulls(concurso_id, area_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_follows_concurso ON public.radar_follows (user_id, concurso_id) WHERE concurso_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_follows_area ON public.radar_follows (user_id, area_id) WHERE area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_follows_concurso ON public.radar_follows (concurso_id) WHERE concurso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_follows_area ON public.radar_follows (area_id) WHERE area_id IS NOT NULL;

-- Limite por aluno (consumo ilimitado é risco; 100 alvos cobre qualquer estudo real).
CREATE OR REPLACE FUNCTION public.radar_follows_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.radar_follows WHERE user_id = NEW.user_id) >= 100 THEN
    RAISE EXCEPTION 'Limite de 100 concursos/áreas acompanhados atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radar_follows_limit ON public.radar_follows;
CREATE TRIGGER trg_radar_follows_limit BEFORE INSERT ON public.radar_follows
  FOR EACH ROW EXECUTE FUNCTION public.radar_follows_limit();

-- -----------------------------------------------------------------------------
-- 6. Rascunhos de trilha (Analista de banca + Arquiteto de trilha)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_track_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id uuid NOT NULL REFERENCES public.radar_concursos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente_revisao' CHECK (status IN ('pendente_revisao', 'publicada', 'rejeitada', 'falhou')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  banca_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings text[] NOT NULL DEFAULT '{}',
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  track_id uuid REFERENCES public.study_tracks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_radar_drafts_concurso ON public.radar_track_drafts (concurso_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Execuções do radar (painel admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger text NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'admin')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  sources_checked integer NOT NULL DEFAULT 0,
  sources_changed integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0,
  updates_published integer NOT NULL DEFAULT 0,
  updates_pending integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_radar_runs_started ON public.radar_runs (started_at DESC);

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.radar_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_concursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_track_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.radar_areas, public.radar_sources, public.radar_concursos, public.radar_updates,
  public.radar_follows, public.radar_track_drafts, public.radar_runs FROM anon, authenticated;

-- Áreas: leitura pública das ativas; admins veem todas.
DROP POLICY IF EXISTS "Radar areas are public" ON public.radar_areas;
CREATE POLICY "Radar areas are public" ON public.radar_areas
  FOR SELECT TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.radar_areas TO anon, authenticated;

-- Concursos: alunos veem os publicados; admins veem e editam todos.
DROP POLICY IF EXISTS "Published radar concursos are public" ON public.radar_concursos;
CREATE POLICY "Published radar concursos are public" ON public.radar_concursos
  FOR SELECT TO anon, authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update radar concursos" ON public.radar_concursos;
CREATE POLICY "Admins update radar concursos" ON public.radar_concursos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.radar_concursos TO anon, authenticated;
GRANT UPDATE (is_published, track_id, track_suggested, area_id) ON public.radar_concursos TO authenticated;

-- Atualizações: alunos veem as publicadas de concursos publicados; admins veem todas.
-- A revisão (aprovar/rejeitar) é só pela RPC radar_review_update.
DROP POLICY IF EXISTS "Published radar updates are public" ON public.radar_updates;
CREATE POLICY "Published radar updates are public" ON public.radar_updates
  FOR SELECT TO anon, authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (review_status = 'publicada'
        AND EXISTS (SELECT 1 FROM public.radar_concursos c WHERE c.id = concurso_id AND c.is_published))
  );
GRANT SELECT ON public.radar_updates TO anon, authenticated;

-- Fontes e execuções: só admins (as URLs e o texto de snapshot são operacionais).
DROP POLICY IF EXISTS "Admins manage radar sources" ON public.radar_sources;
CREATE POLICY "Admins manage radar sources" ON public.radar_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT (id, name, url, kind, area_id, is_active, check_interval_hours, last_checked_at,
              last_changed_at, last_status, consecutive_failures, created_at) ON public.radar_sources TO authenticated;
GRANT INSERT (name, url, kind, area_id, is_active, check_interval_hours) ON public.radar_sources TO authenticated;
GRANT UPDATE (name, kind, area_id, is_active, check_interval_hours) ON public.radar_sources TO authenticated;
GRANT DELETE ON public.radar_sources TO authenticated;

DROP POLICY IF EXISTS "Admins read radar runs" ON public.radar_runs;
CREATE POLICY "Admins read radar runs" ON public.radar_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.radar_runs TO authenticated;

-- Rascunhos de trilha: só admins (publicação pela RPC radar_publish_track_draft).
DROP POLICY IF EXISTS "Admins read radar drafts" ON public.radar_track_drafts;
CREATE POLICY "Admins read radar drafts" ON public.radar_track_drafts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins reject radar drafts" ON public.radar_track_drafts;
CREATE POLICY "Admins reject radar drafts" ON public.radar_track_drafts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND status IN ('pendente_revisao', 'rejeitada'));
GRANT SELECT ON public.radar_track_drafts TO authenticated;
GRANT UPDATE (status) ON public.radar_track_drafts TO authenticated;

-- Acompanhamentos: cada aluno só vê e mexe nos próprios.
DROP POLICY IF EXISTS "Users read own radar follows" ON public.radar_follows;
CREATE POLICY "Users read own radar follows" ON public.radar_follows
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users create own radar follows" ON public.radar_follows;
CREATE POLICY "Users create own radar follows" ON public.radar_follows
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own radar follows" ON public.radar_follows;
CREATE POLICY "Users delete own radar follows" ON public.radar_follows
  FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, DELETE ON public.radar_follows TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. RPCs
-- -----------------------------------------------------------------------------

-- Número de alunos acompanhando cada concurso (sem expor quem): entra na relevância.
CREATE OR REPLACE FUNCTION public.radar_follower_counts()
RETURNS TABLE (concurso_id uuid, followers bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.concurso_id, count(*)::bigint
  FROM public.radar_follows f
  WHERE f.concurso_id IS NOT NULL
  GROUP BY f.concurso_id
$$;

REVOKE ALL ON FUNCTION public.radar_follower_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_follower_counts() TO service_role;

-- Avisa quem acompanha: seguidores do concurso e, se for concurso NOVO, também quem
-- acompanha a área. Idempotente (notified_at). Só o servidor (service_role) chama.
CREATE OR REPLACE FUNCTION public.radar_fanout_update(p_update_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u record;
  v_count integer := 0;
BEGIN
  SELECT ru.id, ru.kind, ru.severity, ru.title, ru.summary, ru.notified_at, ru.review_status,
         c.id AS concurso_id, c.slug, c.area_id, c.is_published
    INTO u
  FROM public.radar_updates ru
  JOIN public.radar_concursos c ON c.id = ru.concurso_id
  WHERE ru.id = p_update_id
  FOR UPDATE OF ru;

  IF NOT FOUND OR u.notified_at IS NOT NULL OR u.review_status <> 'publicada' OR NOT u.is_published THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, icon, data)
  SELECT DISTINCT ON (f.user_id)
    f.user_id, 'radar', left(u.title, 140), left(coalesce(u.summary, ''), 400),
    CASE WHEN u.severity = 'critica' THEN 'zap' ELSE 'radar' END,
    jsonb_build_object('link', '/radar/' || u.slug, 'update_id', u.id, 'concurso_id', u.concurso_id)
  FROM public.radar_follows f
  WHERE f.concurso_id = u.concurso_id
     OR (u.kind = 'novo' AND u.area_id IS NOT NULL AND f.area_id = u.area_id)
  ORDER BY f.user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.radar_updates SET notified_at = now() WHERE id = p_update_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_fanout_update(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_fanout_update(uuid) TO service_role;

-- Aplica um patch (lista branca de colunas) num concurso. Interna.
CREATE OR REPLACE FUNCTION public.radar_apply_patch(p_concurso_id uuid, p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.radar_concursos c SET
    nome              = CASE WHEN p ? 'nome' THEN p->>'nome' ELSE c.nome END,
    banca             = CASE WHEN p ? 'banca' THEN p->>'banca' ELSE c.banca END,
    esfera            = CASE WHEN p ? 'esfera' THEN p->>'esfera' ELSE c.esfera END,
    uf                = CASE WHEN p ? 'uf' THEN p->>'uf' ELSE c.uf END,
    municipio         = CASE WHEN p ? 'municipio' THEN p->>'municipio' ELSE c.municipio END,
    status            = CASE WHEN p ? 'status' THEN p->>'status' ELSE c.status END,
    cargos            = CASE WHEN p ? 'cargos' THEN ARRAY(SELECT jsonb_array_elements_text(p->'cargos')) ELSE c.cargos END,
    vagas             = CASE WHEN p ? 'vagas' THEN (p->>'vagas')::integer ELSE c.vagas END,
    salario_max       = CASE WHEN p ? 'salario_max' THEN (p->>'salario_max')::numeric ELSE c.salario_max END,
    escolaridade      = CASE WHEN p ? 'escolaridade' THEN ARRAY(SELECT jsonb_array_elements_text(p->'escolaridade')) ELSE c.escolaridade END,
    inscricoes_inicio = CASE WHEN p ? 'inscricoes_inicio' THEN (p->>'inscricoes_inicio')::date ELSE c.inscricoes_inicio END,
    inscricoes_fim    = CASE WHEN p ? 'inscricoes_fim' THEN (p->>'inscricoes_fim')::date ELSE c.inscricoes_fim END,
    data_prova        = CASE WHEN p ? 'data_prova' THEN (p->>'data_prova')::date ELSE c.data_prova END,
    link_oficial      = CASE WHEN p ? 'link_oficial' THEN p->>'link_oficial' ELSE c.link_oficial END,
    last_update_at    = now()
  WHERE c.id = p_concurso_id;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_apply_patch(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_apply_patch(uuid, jsonb) TO service_role;

-- Revisão humana de uma atualização pendente (admin). Aprovar aplica o patch,
-- publica o concurso (se ainda não estava) e avisa quem acompanha.
CREATE OR REPLACE FUNCTION public.radar_review_update(p_update_id uuid, p_approve boolean, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO u FROM public.radar_updates WHERE id = p_update_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atualização não encontrada'; END IF;
  IF u.review_status <> 'pendente' THEN RAISE EXCEPTION 'Atualização já revisada'; END IF;

  IF NOT p_approve THEN
    UPDATE public.radar_updates
      SET review_status = 'rejeitada', review_reason = left(p_reason, 300), reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = p_update_id;
    RETURN 0;
  END IF;

  PERFORM public.radar_apply_patch(u.concurso_id, coalesce(u.patch, '{}'::jsonb));
  UPDATE public.radar_concursos SET is_published = true WHERE id = u.concurso_id;
  UPDATE public.radar_updates
    SET review_status = 'publicada', review_reason = left(p_reason, 300), reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_update_id;

  INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
  VALUES ('radar_update_approved', auth.uid(), true, jsonb_build_object('update_id', p_update_id, 'concurso_id', u.concurso_id));

  RETURN public.radar_fanout_update(p_update_id);
END;
$$;

REVOKE ALL ON FUNCTION public.radar_review_update(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_review_update(uuid, boolean, text) TO authenticated;

-- Publica um rascunho de trilha revisado (admin): cria categoria, matérias, trilha,
-- módulos e matérias da trilha. A partir daí a fábrica de questões
-- (generate-track-questions) passa a gerar questões para as matérias com weekly_target > 0.
CREATE OR REPLACE FUNCTION public.radar_publish_track_draft(p_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d record;
  t jsonb;
  m jsonb;
  s jsonb;
  v_category_id uuid;
  v_track_id uuid;
  v_module_id uuid;
  v_subject_id uuid;
  v_m_order integer := 0;
  v_s_order integer;
  v_subject_order integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO d FROM public.radar_track_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado'; END IF;
  IF d.status <> 'pendente_revisao' THEN RAISE EXCEPTION 'Rascunho não está pendente de revisão'; END IF;

  t := d.draft;
  IF coalesce(t->>'slug', '') !~ '^[a-z0-9-]{3,80}$' THEN RAISE EXCEPTION 'Slug da trilha inválido'; END IF;
  IF jsonb_typeof(t->'modules') <> 'array' OR jsonb_array_length(t->'modules') = 0 THEN
    RAISE EXCEPTION 'Rascunho sem módulos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.study_tracks WHERE slug = t->>'slug') THEN
    RAISE EXCEPTION 'Já existe uma trilha com este slug';
  END IF;

  SELECT id INTO v_category_id FROM public.career_categories WHERE name = t->>'short_name' LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO public.career_categories (name, description, icon, display_order)
    VALUES (left(t->>'short_name', 80), left(coalesce(t->>'description', ''), 300), 'landmark', 0)
    RETURNING id INTO v_category_id;
  END IF;

  INSERT INTO public.study_tracks (slug, name, short_name, organ, banca, exam_date, edital_url, description, rules, is_active)
  VALUES (
    t->>'slug', left(t->>'name', 160), left(t->>'short_name', 80), left(t->>'organ', 160), left(coalesce(t->>'banca', 'A definir'), 120),
    nullif(t->>'exam_date', '')::date, nullif(t->>'edital_url', ''), left(t->>'description', 1000),
    coalesce(t->'rules', '{}'::jsonb), true
  )
  RETURNING id INTO v_track_id;

  FOR m IN SELECT * FROM jsonb_array_elements(t->'modules') LOOP
    v_m_order := v_m_order + 1;
    INSERT INTO public.study_track_modules (track_id, slug, name, nivel, description, cargos, structure, display_order)
    VALUES (
      v_track_id, m->>'slug', left(m->>'name', 120), m->>'nivel', left(m->>'description', 500),
      coalesce(ARRAY(SELECT left(x, 160) FROM jsonb_array_elements_text(coalesce(m->'cargos', '[]'::jsonb)) x), '{}'),
      coalesce(m->'structure', '[]'::jsonb), v_m_order
    )
    RETURNING id INTO v_module_id;

    v_s_order := 0;
    FOR s IN SELECT * FROM jsonb_array_elements(coalesce(m->'subjects', '[]'::jsonb)) LOOP
      v_s_order := v_s_order + 1;
      v_subject_order := v_subject_order + 1;
      INSERT INTO public.subjects (career_category_id, name, icon, display_order, slug, description)
      VALUES (v_category_id, left(s->>'name', 160), coalesce(nullif(s->>'icon', ''), 'book-open'), v_subject_order, s->>'slug', NULL)
      ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_subject_id;

      INSERT INTO public.study_track_subjects (module_id, subject_id, area, cargo, syllabus, study_tips, weekly_target, ai_grounded_only, display_order)
      VALUES (
        v_module_id, v_subject_id, left(s->>'area', 120), nullif(left(s->>'cargo', 160), ''), left(s->>'syllabus', 8000),
        left(s->>'study_tips', 2000), least(greatest(coalesce((s->>'weekly_target')::integer, 15), 0), 200),
        coalesce((s->>'ai_grounded_only')::boolean, false), v_s_order
      )
      ON CONFLICT (module_id, subject_id) DO NOTHING;
    END LOOP;
  END LOOP;

  UPDATE public.radar_track_drafts
    SET status = 'publicada', reviewed_by = auth.uid(), reviewed_at = now(), track_id = v_track_id
    WHERE id = p_draft_id;
  UPDATE public.radar_concursos SET track_id = v_track_id, track_suggested = false WHERE id = d.concurso_id;

  INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
  VALUES ('radar_track_published', auth.uid(), true, jsonb_build_object('draft_id', p_draft_id, 'track_id', v_track_id));

  RETURN v_track_id;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_publish_track_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_publish_track_draft(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Sementes: áreas (um coordenador por área), fontes oficiais e o concurso
--     já coberto por trilha (Câmara de Cuiabá 2026).
-- -----------------------------------------------------------------------------
INSERT INTO public.radar_areas (slug, name, description, focus, career_category_name, icon, priority, display_order) VALUES
  ('policial', 'Segurança Pública e Policial', 'Polícias, penal, bombeiros e guardas',
   'Polícia Federal, PRF, Polícias Civis e Militares, Polícia Penal, Corpos de Bombeiros, Guardas Municipais, Agentes de Trânsito. Priorize editais nacionais (PF, PRF, PP federal) e de estados com muitas vagas.',
   'Carreiras Policiais', 'shield', 3, 1),
  ('juridica', 'Tribunais e Carreiras Jurídicas', 'Tribunais, MP, Defensorias e Procuradorias',
   'TJs, TRFs, TRTs, TREs, STJ/STF/TST, Ministérios Públicos, Defensorias, Procuradorias, cartórios. Cargos de técnico e analista judiciário e carreiras jurídicas.',
   'Carreiras Jurídicas', 'scale', 3, 2),
  ('fiscal', 'Fiscal e Controle', 'Receitas, SEFAZ, tribunais de contas e controladorias',
   'Receita Federal, SEFAZ estaduais, auditores e fiscais municipais (ISS), TCU, TCEs, TCMs, CGU e controladorias. Salários altos e alta concorrência.',
   'Área Fiscal e Controle', 'calculator', 3, 3),
  ('bancaria', 'Bancária e Financeira', 'Bancos públicos e órgãos financeiros',
   'Banco do Brasil, Caixa, BNB, Basa, Banrisul, BRB, Banpará, Banco Central, BNDES, CVM.',
   'Bancária e Financeira', 'landmark', 2, 4),
  ('administrativa', 'Administração Pública', 'Órgãos, autarquias e prefeituras',
   'INSS, IBGE, agências reguladoras, ministérios, secretarias estaduais, prefeituras e autarquias. Cargos administrativos de nível médio e superior; o CNU (Concurso Nacional Unificado) entra aqui.',
   'Administração Pública', 'building-2', 2, 5),
  ('legislativo', 'Legislativo', 'Câmara, Senado, Assembleias e Câmaras Municipais',
   'Câmara dos Deputados, Senado Federal, Assembleias Legislativas e Câmaras Municipais (capitais e cidades grandes primeiro).',
   NULL, 'scroll', 2, 6),
  ('educacao', 'Educação', 'Professores e técnicos em educação',
   'Redes estaduais e municipais de ensino, institutos federais, universidades (técnico-administrativos e docentes).',
   'Educação', 'graduation-cap', 2, 7),
  ('saude', 'Saúde', 'SUS, hospitais e secretarias de saúde',
   'Ebserh, secretarias de saúde, hospitais universitários, residências multiprofissionais, agentes comunitários de saúde.',
   'Saúde', 'heart-pulse', 2, 8),
  ('ti', 'Tecnologia da Informação', 'Cargos de TI em qualquer órgão',
   'Analistas e técnicos de TI em tribunais, bancos, agências e empresas públicas (Serpro, Dataprev).',
   'Tecnologia da Informação', 'laptop', 1, 9),
  ('militar', 'Carreiras Militares', 'Forças Armadas e escolas militares',
   'Exército (EsPCEx, EsSA), Marinha (Escola Naval, fuzileiros, aprendizes), Aeronáutica (EPCAR, EEAR, EAOF).',
   NULL, 'medal', 1, 10),
  ('vestibular-enem', 'ENEM e Vestibulares', 'ENEM, Sisu, Prouni e vestibulares',
   'ENEM (inscrições, provas, resultados), Sisu, Prouni, Fies e os principais vestibulares (Fuvest, Unicamp, Unesp e estaduais).',
   NULL, 'graduation-cap', 2, 11)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, focus = EXCLUDED.focus,
  career_category_name = EXCLUDED.career_category_name, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order;

-- Fontes oficiais de bancas (gerais: o Batedor classifica por área) e do INEP.
-- Conferidas em 2026-11-17: as desligadas são páginas montadas por JavaScript (o HTML
-- chega sem o conteúdo) ou com desafio anti-robô; ficam cadastradas para o admin trocar
-- pela página do órgão ou por outra URL estática da banca.
INSERT INTO public.radar_sources (name, url, kind, area_id, check_interval_hours, is_active) VALUES
  ('FGV Conhecimento — concursos', 'https://conhecimento.fgv.br/concursos', 'banca', NULL, 12, true),
  ('Fundação Carlos Chagas (FCC)', 'https://www.concursosfcc.com.br/', 'banca', NULL, 12, true),
  ('Instituto Selecon', 'https://www.selecon.org.br/', 'banca', NULL, 12, true),
  ('Idecan', 'https://www.idecan.org.br/', 'banca', NULL, 24, true),
  ('INEP — ENEM', 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem', 'orgao',
   (SELECT id FROM public.radar_areas WHERE slug = 'vestibular-enem'), 24, true),
  ('Cebraspe — concursos (página dinâmica)', 'https://www.cebraspe.org.br/concursos/', 'banca', NULL, 12, false),
  ('Selecon — portal de seleções (página dinâmica)', 'https://selecao.net.br/', 'banca', NULL, 12, false),
  ('Fundatec (anti-robô)', 'https://www.fundatec.org.br/', 'banca', NULL, 24, false)
ON CONFLICT (url) DO NOTHING;

-- Concurso já coberto por trilha: entra publicado e ligado à trilha (dados do edital
-- versionados em content/trilhas/camara-cuiaba-2026/track.json).
INSERT INTO public.radar_concursos (
  slug, area_id, nome, orgao, banca, esfera, uf, municipio, status, escolaridade,
  inscricoes_fim, data_prova, link_oficial, relevance, track_id, is_published
)
SELECT
  'camara-cuiaba-2026', (SELECT id FROM public.radar_areas WHERE slug = 'legislativo'),
  'Câmara Municipal de Cuiabá-MT — Concurso 2026', 'Câmara Municipal de Cuiabá-MT', 'Instituto Selecon',
  'municipal', 'MT', 'Cuiabá', 'inscricoes_abertas', ARRAY['medio', 'superior'],
  DATE '2026-11-30', DATE '2026-12-20', t.edital_url, 45, t.id, true
FROM public.study_tracks t
WHERE t.slug = 'camara-cuiaba-2026'
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Agendamento: a cada 3 horas (o gerente master só processa as fontes vencidas).
--     Reaproveita o segredo do agendador no Vault (question_cron_secret).
-- -----------------------------------------------------------------------------
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net indisponíveis: agendamento do radar NÃO criado.';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'radar-concursos';

  PERFORM cron.schedule(
    'radar-concursos',
    '17 */3 * * *',
    $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/radar-concursos',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'question_cron_secret')
        ),
        body := '{"action":"monitor"}'::jsonb,
        timeout_milliseconds := 150000
      )
      WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'question_cron_secret')
        AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url');
    $job$
  );
END
$outer$;
