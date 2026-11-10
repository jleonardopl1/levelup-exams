import { useAccess } from '@/hooks/useAccess';

/** Compatibilidade: `isAdmin` inclui o admin master; `isStaff` inclui moderadores. */
export function useIsAdmin() {
  const { access, isLoading } = useAccess();
  return { isAdmin: access.isAdmin, isStaff: access.isStaff, isMaster: access.isMaster, isLoading };
}
