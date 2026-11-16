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

async function robotsFor(url: URL, opts: FetchOptions): Promise<string[]> {
  const cache = opts.robotsCache ?? new Map<string, string[]>();
  const cached = cache.get(url.host);
  if (cached) return cached;
  let rules: string[] = [];
  try {
    const res = await (opts.fetchFn ?? fetch)(`https://${url.host}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) rules = parseRobots(new TextDecoder().decode((await readCapped(res)).slice(0, 200_000)));
    else await res.body?.cancel().catch(() => {});
  } catch {
    // robots.txt inacessível = sem restrições declaradas.
  }
  cache.set(url.host, rules);
  return rules;
}

/** Baixa e normaliza uma página oficial. Lança FetchError com mensagem curta. */
export async function fetchPage(rawUrl: string, opts: FetchOptions = {}): Promise<FetchedPage> {
  const fetchFn = opts.fetchFn ?? fetch;
  const initial = safeUrl(rawUrl);
  if (!initial) throw new FetchError("URL não permitida");
  let url: URL = initial;

  const rules = await robotsFor(url, opts);
  if (!isAllowed(rules, url.pathname + url.search)) throw new FetchError("bloqueado pelo robots.txt");

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      res = await fetchFn(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      throw new FetchError(name === "TimeoutError" || name === "AbortError" ? "tempo esgotado" : "falha de rede");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      const next = loc ? safeUrl(new URL(loc, url).toString()) : null;
      if (!next) throw new FetchError("redirecionamento não permitido");
      url = next;
      continue;
    }
    break;
  }
  if (!res || (res.status >= 300 && res.status < 400)) throw new FetchError("redirecionamentos demais");
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
