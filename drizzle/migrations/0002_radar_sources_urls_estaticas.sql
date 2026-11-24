-- Radar de Concursos — Cebraspe e Selecon sem renderização (backlog 17 e 21).
--
-- Conferido em 2026-11-24 pelo curador-conteudo (evidências no handoff de AGENTS-COLLAB.md):
--
-- * Cebraspe: https://www.cebraspe.org.br/concursos/ é uma aplicação React; o HTML chega ao
--   coletor sem texto e sem links. A lista de notícias https://www.cebraspe.org.br/noticias/ é
--   HTML estático (WordPress) e anuncia cada concurso novo; a notícia traz vagas, inscrições,
--   remuneração, data da prova e o link oficial (www.cebraspe.org.br/concursos/<SIGLA>), que o
--   coletor baixa como página de detalhe. O robots.txt libera tudo.
--
-- * Selecon: https://selecao.net.br/ não é página dinâmica. A raiz da plataforma de inscrições
--   responde só "Cliente não encontrado."; cada concurso fica num subdomínio
--   (selecon-mt.selecao.net.br, selecon.selecao.net.br) atrás de desafio anti-robô da Cloudflare,
--   que o Radar não contorna. A lista estática está no site do instituto:
--   https://selecon.org.br/concursos/ (os 12 concursos mais recentes, sem contadores nem abas
--   repetidas). Ela cobre o mesmo que a fonte ativa "Instituto Selecon" (https://www.selecon.org.br/):
--   ligue só uma das duas.
--
-- O que faz: troca URL e nome das duas fontes, zera o retrato da página (a primeira visita lê a
-- página inteira) e deixa render_mode = 'direto'. NÃO liga nenhuma fonte: is_active é decisão do dono.
--
-- Idempotente e tolerante à ordem:
-- * só troca a fonte que ainda estiver desligada e se a URL nova ainda não existir (url é UNIQUE);
--   rodar de novo não faz nada;
-- * pending_retries e render_mode só são tocados se a coluna existir (a primeira entrou depois do
--   primeiro commit da tabela; a segunda vem de 20261123120000_radar_render_mode.sql);
-- * sem a tabela do Radar (20261117120000 não aplicada), só avisa e sai.

DO $$
DECLARE
  extra text := '';
  pair text[];
BEGIN
  IF to_regclass('public.radar_sources') IS NULL THEN
    RAISE NOTICE 'radar_sources não existe: aplique 20261117120000_radar_concursos.sql antes desta.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'radar_sources' AND column_name = 'pending_retries') THEN
    extra := extra || ', pending_retries = 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'radar_sources' AND column_name = 'render_mode') THEN
    extra := extra || ', render_mode = ''direto''';
  END IF;

  -- [URL antiga, URL nova, nome novo]
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['https://www.cebraspe.org.br/concursos/', 'https://www.cebraspe.org.br/noticias/',
          'Cebraspe — notícias (concursos e seleções)'],
    ARRAY['https://selecao.net.br/', 'https://selecon.org.br/concursos/',
          'Selecon — concursos (lista estática)']
  ] LOOP
    EXECUTE format(
      'UPDATE public.radar_sources
          SET url = %2$L, name = %3$L,
              last_checked_at = NULL, last_changed_at = NULL, last_hash = NULL, last_text = NULL,
              last_status = NULL, consecutive_failures = 0%4$s
        WHERE url = %1$L
          AND is_active = false
          AND NOT EXISTS (SELECT 1 FROM public.radar_sources s WHERE s.url = %2$L)',
      pair[1], pair[2], pair[3], extra);
  END LOOP;
END $$;