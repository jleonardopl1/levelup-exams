/**
 * CORS das Edge Functions.
 *
 * O app responde em mais de um endereço (domínio próprio, www, o antigo
 * levelupexams.lovable.app e as prévias do Lovable). Um cabeçalho fixo com uma
 * única origem quebraria as chamadas feitas a partir dos outros endereços, por
 * isso a origem é validada por requisição contra uma lista e devolvida no
 * Access-Control-Allow-Origin apenas quando permitida.
 *
 * ALLOWED_ORIGIN (opcional) aceita uma ou mais origens separadas por vírgula,
 * que se somam às padrão abaixo.
 */
const DEFAULT_ORIGINS = [
  "https://levelupexams.com.br",
  "https://www.levelupexams.com.br",
  "https://levelupexams.lovable.app",
];

/** Prévias deste projeto no Lovable (editor e preview). */
const LOVABLE_PROJECT_ID = "42ea172a-0a3b-4331-b866-f7ed4fc4ba44";
const PREVIEW_ORIGIN = new RegExp(
  `^https://([a-z0-9-]+--)?${LOVABLE_PROJECT_ID}\\.(lovable\\.app|lovableproject\\.com)$`,
);

const ALLOWED_ORIGINS = new Set(
  [
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get("ALLOWED_ORIGIN") ?? "").split(","),
  ]
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);

const PRIMARY_ORIGIN = DEFAULT_ORIGINS[0];

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin));
}

/**
 * Cabeçalhos CORS base. O Allow-Origin daqui é só um valor inicial: `withCors`
 * o substitui pela origem da requisição quando ela é permitida.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": PRIMARY_ORIGIN,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};

type Handler = (req: Request) => Response | Promise<Response>;

/** Envolve o handler e ajusta o Access-Control-Allow-Origin à origem da requisição. */
export function withCors(handler: Handler): Handler {
  return async (req) => {
    const res = await handler(req);
    const origin = req.headers.get("origin");
    const allowed = isAllowedOrigin(origin) ? origin : PRIMARY_ORIGIN;
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", allowed);
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
