import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { storeReferralCode, trackReferralVisit } from '@/hooks/useAffiliates';

/**
 * Captura `?ref=CODIGO` em qualquer rota: guarda o código (30 dias) para o checkout,
 * registra a visita (KPI do afiliado) e limpa o parâmetro da URL.
 */
export function ReferralCapture() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (!ref) return;

    const code = storeReferralCode(ref);
    if (code) void trackReferralVisit(code).catch(() => undefined);

    params.delete('ref');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
  }, [location.search, location.pathname, location.hash, navigate]);

  return null;
}
