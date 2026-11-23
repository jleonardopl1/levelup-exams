-- Radar de Concursos — piloto de renderização de páginas montadas por JavaScript (D15).
--
-- Fontes como o portal do Cebraspe e o da Selecon chegam vazias ao coletor, que não executa JS.
-- Com render_mode = 'firecrawl', a função radar-concursos pede o HTML renderizado à API da
-- Firecrawl (secret FIRECRAWL_API_KEY) e segue o mesmo caminho do coletor: robots.txt conferido
-- antes, URL final conferida, limite de 2 MB, evidência literal e verificador.
--
-- Idempotente e tolerante à ordem de publicação: a função lê as fontes com select("*") e trata a
-- coluna ausente como 'direto'. Sem o secret, a fonte marcada falha com "renderização não
-- configurada" e o resto do Radar segue normalmente. Desligar = voltar a fonte para 'direto'.

ALTER TABLE public.radar_sources
  ADD COLUMN IF NOT EXISTS render_mode text NOT NULL DEFAULT 'direto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'radar_sources_render_mode_check'
      AND conrelid = 'public.radar_sources'::regclass
  ) THEN
    ALTER TABLE public.radar_sources
      ADD CONSTRAINT radar_sources_render_mode_check CHECK (render_mode IN ('direto', 'firecrawl'));
  END IF;
END $$;

COMMENT ON COLUMN public.radar_sources.render_mode IS
  'direto = coletor próprio (fetchPage); firecrawl = página montada por JavaScript, renderizada pela API da Firecrawl (piloto D15, secret FIRECRAWL_API_KEY).';
