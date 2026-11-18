-- Funções internas das funcionalidades Plus: o Supabase concede EXECUTE a `authenticated`
-- por padrão em funções novas do schema public, e as migrations 20261115120000/130000 só
-- revogaram de PUBLIC e anon. As funções já recusam quem não é service_role, mas o padrão
-- do projeto (ver 20261113150000_premium_grants.sql) é não expor função interna.
REVOKE EXECUTE ON FUNCTION public.grant_exam_pass(uuid, uuid, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.begin_essay_submission(uuid, uuid, text, text, text, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._schedule_review() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._review_interval(smallint, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._essay_used_7d(uuid) FROM authenticated;
