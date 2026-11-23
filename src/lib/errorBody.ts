/**
 * Corpo JSON de erro das Edge Functions (`{ error, code? }`). Chega como `unknown`
 * (Response.json() com ts-reset), então só texto não vazio vale; o resto vira undefined.
 */
export function parseErrorBody(body: unknown): { error?: string; code?: string } {
  if (!body || typeof body !== 'object') return {};
  const error = 'error' in body && typeof body.error === 'string' && body.error ? body.error : undefined;
  const code = 'code' in body && typeof body.code === 'string' && body.code ? body.code : undefined;
  return { error, code };
}
