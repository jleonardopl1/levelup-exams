/**
 * Coletor do Radar (determinístico, sem IA): baixa as páginas oficiais com segurança,
 * normaliza o texto, extrai links e calcula o que mudou desde a última visita.
 *
 * Segurança (OWASP — SSRF): só https, sem IP literal, sem hosts internos, sem portas
 * fora do padrão, redirecionamentos conferidos um a um, tamanho e tempo limitados.
 * Boa vizinhança: respeita o robots.txt e se identifica com um agente genérico.
 */
import type { FetchedPage } from "./types.ts";

export const USER_AGENT = "LevelUpRadar/1.0 (+monitoramento de editais; respeita robots.txt)";
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;

const BLOCKED_HOSTS = /^(localhost|metadata(\.google\.internal)?|.*\.local|.*\.internal|.*\.localdomain|.*\.supabase\.co)$/i;

/** URL aceitável para o coletor? Retorna a URL normalizada ou null. */
export function safeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || BLOCKED_HOSTS.test(host)) return null;
  // IP literal (v4 ou v6): bloqueado — fontes oficiais têm nome de domínio.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":")) return null;
  u.hash = "";
  return u;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** Regras de robots.txt que valem para nós (grupo do nosso agente ou "*"). */
export function parseRobots(body: string, agent = "levelupradar"): string[] {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let current: { agents: string[]; disallow: string[]; allow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && value) current.disallow.push(value);
      if (key === "allow" && value) current.allow.push(value);
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  // Allow mais específico que Disallow é tratado no isAllowed; aqui devolvemos "!" para allow.
  return chosen.flatMap((g) => [...g.disallow, ...g.allow.map((a) => `!${a}`)]);
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

/** Regra mais longa vence (como no Google); empate favorece o Allow. */
export function isAllowed(rules: string[], path: string): boolean {
  let best = { len: -1, allow: true };
  for (const r of rules) {
    const allow = r.startsWith("!");
    const rule = allow ? r.slice(1) : r;
    if (!ruleMatches(rule, path)) continue;
    if (rule.length > best.len || (rule.length === best.len && allow)) best = { len: rule.length, allow };
  }
  return best.allow;
}

// ---------------------------------------------------------------------------
// HTML → texto
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ordm: "º", ordf: "ª", deg: "°",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ", acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô",
  agrave: "à", Agrave: "À", ccedil: "ç", Ccedil: "Ç", uuml: "ü", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", sect: "§", middot: "·",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e] ?? m;
  });
}

/** Texto legível de uma página HTML: um bloco por linha, sem scripts, estilos e menus. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|li|tr|h[1-6]|section|article|table|ul|ol|header|main|aside|dd|dt|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n");
}

/** Links absolutos (http/https) com o texto da âncora; no máximo 400. */
export function extractLinks(html: string, base: string): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 400) {
    let href: string;
    try {
      href = new URL(decodeEntities(m[1].trim()), base).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//.test(href) || seen.has(href)) continue;
    seen.add(href);
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160);
    out.push({ href, label });
  }
  return out;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Linhas NOVAS em relação à versão anterior (com 1 linha de contexto antes), na ordem
 * da página. É o que vai para a triagem: barato e focado no que mudou.
 */
export function diffNewLines(previous: string | null, current: string, maxChars = 30_000): string {
  if (!previous) return current.slice(0, maxChars);
  const before = new Set(previous.split("\n"));
  const lines = current.split("\n");
  const out: string[] = [];
  let size = 0;
  for (let i = 0; i < lines.length && size < maxChars; i++) {
    if (before.has(lines[i])) continue;
    const ctx = i > 0 && before.has(lines[i - 1]) && out[out.length - 1] !== lines[i - 1] ? [lines[i - 1]] : [];
    for (const l of [...ctx, lines[i]]) {
      out.push(l);
      size += l.length + 1;
    }
  }
  return out.join("\n").slice(0, maxChars);
}

/** Janela de texto ao redor de um trecho (contexto para o Analista de edital). */
export function windowAround(text: string, needle: string, radius = 5_000): string {
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase().slice(0, 80)) : -1;
  if (i < 0) return text.slice(0, radius * 2);
  return text.slice(Math.max(0, i - radius), i + needle.length + radius);
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export class FetchError extends Error {}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Cache de robots.txt por host durante a execução. */
  robotsCache?: Map<string, string[]>;
}

async function readCapped(res: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  // Uint8Array<ArrayBuffer> explícito: é o tipo que crypto.subtle.digest aceita.
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new FetchError("página grande demais");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  const enc = charset ?? meta ?? "utf-8";
  try {
    return new TextDecoder(enc === "iso-8859-1" || enc === "latin1" ? "windows-1252" : enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/**
 * GET com redirecionamentos MANUAIS: cada destino passa por safeUrl (https público, sem IP,
 * sem host interno, porta padrão). Vale para a página e para o robots.txt.
 */
async function safeFetch(start: URL, fetchFn: typeof fetch, accept: string, timeoutMs: number): Promise<{ res: Response; url: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetchFn(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      throw new FetchError(name === "TimeoutError" || name === "AbortError" ? "tempo esgotado" : "falha de rede");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      let next: URL | null = null;
      try {
        next = loc ? safeUrl(new URL(loc, url).toString()) : null;
      } catch { /* location inválido */ }
      if (!next) throw new FetchError("redirecionamento não permitido");
      url = next;
      continue;
    }
    return { res, url };
  }
  throw new FetchError("redirecionamentos demais");
}

async function robotsFor(url: URL, opts: FetchOptions): Promise<string[]> {
  const cache = opts.robotsCache ?? new Map<string, string[]>();
  const cached = cache.get(url.host);
  if (cached) return cached;
  let rules: string[] = [];
  try {
    const robotsUrl = safeUrl(`https://${url.host}/robots.txt`);
    if (robotsUrl) {
      const { res } = await safeFetch(robotsUrl, opts.fetchFn ?? fetch, "text/plain,*/*;q=0.5", 8_000);
      if (res.ok) rules = parseRobots(new TextDecoder().decode((await readCapped(res)).slice(0, 200_000)));
      else await res.body?.cancel().catch(() => {});
    }
  } catch {
    // robots.txt inacessível (ou redirecionado para destino proibido) = sem regras declaradas;
    // a página em si continua sujeita a safeUrl e aos redirecionamentos conferidos.
  }
  cache.set(url.host, rules);
  return rules;
}

/** Baixa e normaliza uma página oficial. Lança FetchError com mensagem curta. */
export async function fetchPage(rawUrl: string, opts: FetchOptions = {}): Promise<FetchedPage> {
  const fetchFn = opts.fetchFn ?? fetch;
  const initial = safeUrl(rawUrl);
  if (!initial) throw new FetchError("URL não permitida");

  const rules = await robotsFor(initial, opts);
  if (!isAllowed(rules, initial.pathname + initial.search)) throw new FetchError("bloqueado pelo robots.txt");

  const { res, url } = await safeFetch(
    initial, fetchFn, "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5", opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new FetchError(`HTTP ${res.status}`);
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const bytes = await readCapped(res);
  const isText = /text\/html|application\/xhtml|text\/plain|application\/xml|text\/xml/.test(contentType) || contentType === "";
  if (!isText) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { url: url.toString(), status: res.status, contentType, text: "", links: [], hash, binary: true };
  }
  const raw = decodeBody(bytes, contentType);
  const isHtml = !/text\/plain/.test(contentType);
  const text = (isHtml ? htmlToText(raw) : raw.replace(/[ \t]+/g, " ")).slice(0, 400_000);
  const links = isHtml ? extractLinks(raw, url.toString()) : [];
  return { url: url.toString(), status: res.status, contentType, text, links, hash: await sha256(text), binary: false };
}

// ---------------------------------------------------------------------------
// Renderização por serviço externo (piloto Firecrawl, D15)
// ---------------------------------------------------------------------------

/** Endpoint fixo: a chave só vai para este host (nada configurável por onde o segredo vaze). */
export const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const RENDER_TIMEOUT_MS = 45_000;

export interface RenderOptions extends FetchOptions {
  /** Secret FIRECRAWL_API_KEY. Sem ele a fonte falha com mensagem curta (piloto desligado). */
  apiKey?: string;
}

interface FirecrawlPayload {
  success?: unknown;
  data?: { html?: unknown; metadata?: { statusCode?: unknown; url?: unknown } };
}

/**
 * Página oficial montada por JavaScript (ex.: portais de banca que chegam vazios ao fetchPage):
 * pede à Firecrawl o HTML já renderizado e segue o mesmo caminho do coletor (texto, links, hash).
 * Mantém as regras do coletor: URL segura, robots.txt da fonte conferido ANTES, resposta limitada
 * a 2 MB, URL final conferida com safeUrl. Sem cache (`maxAge: 0`, `storeInCache: false`) e com
 * proxy `basic`: não contorna anti-robô. Só a URL pública da fonte vai ao serviço.
 */
export async function fetchRendered(rawUrl: string, opts: RenderOptions = {}): Promise<FetchedPage> {
  if (!opts.apiKey) throw new FetchError("renderização não configurada");
  const fetchFn = opts.fetchFn ?? fetch;
  const initial = safeUrl(rawUrl);
  if (!initial) throw new FetchError("URL não permitida");

  const rules = await robotsFor(initial, opts);
  if (!isAllowed(rules, initial.pathname + initial.search)) throw new FetchError("bloqueado pelo robots.txt");

  let res: Response;
  try {
    res = await fetchFn(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url: initial.toString(),
        formats: ["html"],
        onlyMainContent: false,
        maxAge: 0,
        storeInCache: false,
        proxy: "basic",
        blockAds: true,
        timeout: 30_000,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(opts.timeoutMs ?? RENDER_TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    throw new FetchError(name === "TimeoutError" || name === "AbortError" ? "renderização: tempo esgotado" : "renderização: falha de rede");
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    if (res.status === 402) throw new FetchError("renderização sem crédito");
    if (res.status === 429) throw new FetchError("renderização limitada (429)");
    throw new FetchError(`renderização falhou (HTTP ${res.status})`);
  }

  let payload: FirecrawlPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(await readCapped(res))) as FirecrawlPayload;
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError("renderização: resposta inválida");
  }
  const html = payload?.data?.html;
  const meta = payload?.data?.metadata;
  if (payload?.success !== true || typeof html !== "string" || typeof meta?.statusCode !== "number") {
    throw new FetchError("renderização: resposta inválida");
  }
  const status = meta.statusCode;
  if (!((status >= 200 && status < 300) || status === 304)) throw new FetchError(`HTTP ${status}`);
  const finalUrl = safeUrl(typeof meta.url === "string" && meta.url ? meta.url : initial.toString());
  if (!finalUrl) throw new FetchError("redirecionamento não permitido");

  const text = htmlToText(html).slice(0, 400_000);
  const links = extractLinks(html, finalUrl.toString());
  return { url: finalUrl.toString(), status, contentType: "text/html", text, links, hash: await sha256(text), binary: false };
}
