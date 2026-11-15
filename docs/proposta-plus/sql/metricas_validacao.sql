-- Consultas de validação de negócio (somente leitura). Rodar no SQL Editor do projeto
-- de produção ANTES de priorizar. Cada uma responde uma hipótese de docs/PROPOSTA_PLUS.md.
-- Todas foram executadas contra o schema atual (docs/proposta-plus/validate.mjs).

-- H1. "O limite de 30/dia empurra pouca gente para o Plus" — quantos Free batem no limite?
SELECT count(DISTINCT u.user_id) FILTER (WHERE u.questions_used >= 30) AS free_que_bateram_limite_30d,
       count(DISTINCT u.user_id) AS free_ativos_30d,
       round(100.0 * count(DISTINCT u.user_id) FILTER (WHERE u.questions_used >= 30)
             / nullif(count(DISTINCT u.user_id), 0), 1) AS pct
FROM public.daily_question_usage u
JOIN public.profiles p ON p.user_id = u.user_id AND p.tier = 'free'
WHERE u.usage_date >= current_date - 30;

-- H2. "O Mentor IA é pouco usado / a cota de 6 trava quem usa" — distribuição entre Plus.
SELECT m.questions_used AS perguntas_no_dia, count(*) AS dias_aluno
FROM public.ai_mentor_usage m
JOIN public.profiles p ON p.user_id = m.user_id AND p.tier = 'plus'
WHERE m.usage_date >= current_date - 30
GROUP BY 1 ORDER BY 1;

-- H3. Métrica estrela por plano: simulados concluídos por semana (últimas 8 semanas).
SELECT date_trunc('week', r.created_at)::date AS semana, p.tier,
       count(*) AS simulados, count(DISTINCT r.user_id) AS alunos
FROM public.quiz_results r JOIN public.profiles p ON p.user_id = r.user_id
WHERE r.created_at >= now() - interval '8 weeks'
GROUP BY 1, 2 ORDER BY 1, 2;

-- H4. Engajamento na trilha (base do Simulado Oficial e da revisão espaçada):
--     alunos com tentativas em matérias de trilha, por nível, nos últimos 14 dias.
SELECT m.nivel, count(DISTINCT a.user_id) AS alunos, count(*) AS respostas,
       round(100.0 * avg(a.is_correct::int), 1) AS acerto_pct
FROM public.user_question_attempts a
JOIN public.questions q ON q.id = a.question_id
JOIN public.study_track_subjects ts ON ts.subject_id = q.subject_id
JOIN public.study_track_modules m ON m.id = ts.module_id
WHERE a.created_at >= now() - interval '14 days'
GROUP BY 1;

-- H5. Tamanho da fila de revisão que existiria hoje (erros cuja última resposta foi errada).
--     (uma linha por aluno no subselect: soma n para questões, conta linhas para alunos)
SELECT COALESCE(sum(n), 0) AS questoes_para_revisar, count(*) AS alunos,
       round(avg(n), 1) AS media_por_aluno
FROM (
  SELECT user_id, count(*) AS n FROM (
    SELECT DISTINCT ON (user_id, question_id) user_id, question_id, is_correct
    FROM public.user_question_attempts ORDER BY user_id, question_id, created_at DESC) last
  WHERE NOT is_correct GROUP BY user_id) x;

-- H6. Conversão e receita: pagantes vs. cortesias, e quando os pagantes assinaram.
SELECT billing_tier, tier, count(*) FROM public.profiles GROUP BY 1, 2 ORDER BY 1, 2;

-- H7. Profundidade do banco por cargo (quantos simulados oficiais inéditos cabem).
SELECT m.slug, coalesce(ts.cargo, '(comum)') AS cargo, ts.area, count(q.id) AS questoes
FROM public.study_track_subjects ts
JOIN public.study_track_modules m ON m.id = ts.module_id
JOIN public.questions q ON q.subject_id = ts.subject_id AND q.is_active
  AND (q.nivel IS NULL OR q.nivel = m.nivel)
GROUP BY 1, 2, 3 ORDER BY 1, 3, 4;
