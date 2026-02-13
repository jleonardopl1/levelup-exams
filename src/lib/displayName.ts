/**
 * Returns a safe display name, never showing email addresses.
 * If the name looks like an email, extracts the username part.
 * Falls back to a default label if no name is available.
 */
export function getSafeDisplayName(
  name: string | null | undefined,
  fallback = 'Estudante'
): string {
  if (!name || name.trim().length === 0) return fallback;
  const trimmed = name.trim();
  // If it looks like an email, use the part before @
  if (trimmed.includes('@')) {
    return trimmed.split('@')[0] || fallback;
  }
  return trimmed;
}
