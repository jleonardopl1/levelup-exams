import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { diffNewLines, extractLinks, fetchPage, htmlToText, isAllowed, parseRobots, safeUrl, windowAround } from "./fetcher.ts";

Deno.test("safeUrl: só https público, sem IP, porta estranha ou host interno", () => {
  assert(safeUrl("https://www.cebraspe.org.br/concursos/"));
  assertEquals(safeUrl("http://www.cebraspe.org.br/"), null);
  assertEquals(safeUrl("https://127.0.0.1/"), null);
  assertEquals(safeUrl("https://[::1]/"), null);
  assertEquals(safeUrl("https://localhost/"), null);
  assertEquals(safeUrl("https://metadata.google.internal/"), null);
  assertEquals(safeUrl("https://abc.supabase.co/rest/v1"), null);
  assertEquals(safeUrl("https://exemplo.gov.br:8443/"), null);
  assertEquals(safeUrl("https://user:pw@exemplo.gov.br/"), null);
  assertEquals(safeUrl("nao é url"), null);
});

Deno.test("robots.txt: grupo '*', regra mais longa vence e Allow desempata", () => {
  const rules = parseRobots(`User-agent: *\nDisallow: /admin\nDisallow: /concursos/privado\nAllow: /concursos/privado/edital\n\nUser-agent: OutroBot\nDisallow: /`);
  assert(isAllowed(rules, "/concursos/"));
  assert(!isAllowed(rules, "/admin/painel"));
  assert(!isAllowed(rules, "/concursos/privado/x"));
  assert(isAllowed(rules, "/concursos/privado/edital.pdf"));
  assert(isAllowed(parseRobots(""), "/qualquer"));
  assert(!isAllowed(parseRobots("User-agent: *\nDisallow: /"), "/"));
});

Deno.test("htmlToText: remove scripts/menus, decodifica entidades e quebra blocos", () => {
  const html = `<html><head><title>x</title><script>var a=1</script></head><body><nav>Menu</nav>
    <h2>Concurso Pol&iacute;cia Federal</h2><p>Inscri&ccedil;&otilde;es at&eacute; 30/11/2026&nbsp;</p>
    <table><tr><td>Agente</td><td>R$ 14.164,81</td></tr></table><footer>rodapé</footer></body></html>`;
  const t = htmlToText(html);
  assert(t.includes("Concurso Polícia Federal"));
  assert(t.includes("Inscrições até 30/11/2026"));
  assert(t.includes("Agente | R$ 14.164,81"));
  assert(!t.includes("var a"));
  assert(!t.includes("Menu"));
  assert(!t.includes("rodapé"));
});

Deno.test("extractLinks: absolutos, sem duplicados, com o texto da âncora", () => {
  const links = extractLinks(`<a href="/concursos/pf_26">PF <b>26</b></a><a href="/concursos/pf_26">dup</a><a href="mailto:x@y">m</a><a href="#topo">t</a>`, "https://www.cebraspe.org.br/concursos/");
  assertEquals(links, [{ href: "https://www.cebraspe.org.br/concursos/pf_26", label: "PF 26" }]);
});

Deno.test("diffNewLines: só linhas novas, com uma linha de contexto", () => {
  const before = "Concursos abertos\nTJ-SP 2026 — inscrições abertas\nRodapé";
  const after = "Concursos abertos\nPF 2026 — edital publicado\nTJ-SP 2026 — inscrições abertas\nRodapé";
  assertEquals(diffNewLines(before, after), "Concursos abertos\nPF 2026 — edital publicado");
  assertEquals(diffNewLines(null, "a\nb"), "a\nb");
  assertEquals(diffNewLines("a\nb", "a\nb"), "");
});

Deno.test("windowAround: recorta ao redor do trecho; sem trecho, o começo", () => {
  const text = "x".repeat(1000) + "ALVO" + "y".repeat(1000);
  const w = windowAround(text, "ALVO", 10);
  assertEquals(w, "x".repeat(10) + "ALVO" + "y".repeat(10));
  assertEquals(windowAround("abc", "zzz", 1), "ab");
});

function fakeFetch(routes: Record<string, () => Response>): typeof fetch {
  return ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    return Promise.resolve(route ? route() : new Response("não achei", { status: 404 }));
  }) as typeof fetch;
}

Deno.test("fetchPage: HTML vira texto + links + hash; respeita robots.txt", async () => {
  const fetchFn = fakeFetch({
    "https://banca.org.br/robots.txt": () => new Response("User-agent: *\nDisallow: /privado"),
    "https://banca.org.br/concursos": () =>
      new Response(`<h1>Concursos</h1><a href="/c/pf">Polícia Federal</a>`, { headers: { "content-type": "text/html; charset=utf-8" } }),
  });
  const page = await fetchPage("https://banca.org.br/concursos", { fetchFn });
  assertEquals(page.binary, false);
  assert(page.text.includes("Concursos"));
  assertEquals(page.links[0].href, "https://banca.org.br/c/pf");
  assertEquals(page.hash.length, 64);
  await assertRejects(() => fetchPage("https://banca.org.br/privado/x", { fetchFn }), Error, "robots");
});

Deno.test("fetchPage: redirecionamento para host interno é recusado; PDF só gera hash", async () => {
  const fetchFn = fakeFetch({
    "https://banca.org.br/robots.txt": () => new Response("", { status: 404 }),
    "https://banca.org.br/r": () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/admin" } }),
    "https://banca.org.br/edital.pdf": () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } }),
  });
  await assertRejects(() => fetchPage("https://banca.org.br/r", { fetchFn }), Error, "redirecionamento");
  const pdf = await fetchPage("https://banca.org.br/edital.pdf", { fetchFn });
  assertEquals(pdf.binary, true);
  assertEquals(pdf.text, "");
  assertEquals(pdf.hash.length, 64);
});
