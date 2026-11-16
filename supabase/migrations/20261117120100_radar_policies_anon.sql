-- =============================================================================
-- Radar de Concursos: leitura pública sem chamar has_role para visitantes anônimos.
--
-- public.has_role tem EXECUTE revogado de anon (20261110120000_security_hardening.sql).
-- As políticas de leitura de 20261117120000 valiam para anon E authenticated e
-- chamavam has_role, então a consulta anônima falhava com "permission denied for
-- function has_role" em vez de devolver os dados publicados. Aqui cada papel ganha a
-- própria política: anon só vê o que está publicado/ativo; authenticated continua
-- vendo também o que é de admin. Idempotente.
-- =============================================================================

DROP POLICY IF EXISTS "Radar areas are public" ON public.radar_areas;
DROP POLICY IF EXISTS "Radar areas: anon reads active" ON public.radar_areas;
DROP POLICY IF EXISTS "Radar areas: users read active, admins all" ON public.radar_areas;
CREATE POLICY "Radar areas: anon reads active" ON public.radar_areas
  FOR SELECT TO anon USING (is_active);
CREATE POLICY "Radar areas: users read active, admins all" ON public.radar_areas
  FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Published radar concursos are public" ON public.radar_concursos;
DROP POLICY IF EXISTS "Radar concursos: anon reads published" ON public.radar_concursos;
DROP POLICY IF EXISTS "Radar concursos: users read published, admins all" ON public.radar_concursos;
CREATE POLICY "Radar concursos: anon reads published" ON public.radar_concursos
  FOR SELECT TO anon USING (is_published);
CREATE POLICY "Radar concursos: users read published, admins all" ON public.radar_concursos
  FOR SELECT TO authenticated USING (is_published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Published radar updates are public" ON public.radar_updates;
DROP POLICY IF EXISTS "Radar updates: anon reads published" ON public.radar_updates;
DROP POLICY IF EXISTS "Radar updates: users read published, admins all" ON public.radar_updates;
CREATE POLICY "Radar updates: anon reads published" ON public.radar_updates
  FOR SELECT TO anon
  USING (review_status = 'publicada'
         AND EXISTS (SELECT 1 FROM public.radar_concursos c WHERE c.id = concurso_id AND c.is_published));
CREATE POLICY "Radar updates: users read published, admins all" ON public.radar_updates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (review_status = 'publicada'
        AND EXISTS (SELECT 1 FROM public.radar_concursos c WHERE c.id = concurso_id AND c.is_published))
  );
