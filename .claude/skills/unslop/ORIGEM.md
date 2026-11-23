# Origem desta skill

- **Obra original:** "unslop", de **Damir Sokolovsky** — https://github.com/heydamir/unslop
- **Commit:** `620163eedb3529d9cd23a3994ed8d287d06f760d` (2026-11-15)
- **Licença:** Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), texto em `LICENSE` nesta
  pasta. Esta cópia é uma **adaptação**; os créditos ao autor devem acompanhar qualquer cópia.
- **Arquivos copiados:** `skills/unslop/SKILL.md` e `skills/unslop/references/*.md`.
- **Deixados de fora:** `skills/unslop/scripts/` (Playwright, ffmpeg e rede), `references/refs/`
  (imagens) e `agents/`.
- **Mudanças feitas na SKILL.md:**
  1. `disable-model-invocation: true` no cabeçalho (piloto só roda por `/unslop`);
  2. bloco "Adaptação do LevelUp Exams" logo após o título (só auditoria e polimento, sem scripts,
     sem geração de imagem sem aprovação, regras de acessibilidade e de escrita do projeto);
  3. linha 105: "never `!!`" virou "never a double exclamation mark", e linha 122: os valores em
     dólar viraram `R$ 48.210` e `R$ 124.860,40`. Os dois trechos originais seriam interpretados
     pelo Claude Code ao carregar a skill (comando e variável).
- **Revisão de segurança:** `security-reviewer`, 2026-11-23, aprovado com as condições acima.
- **Aprovação:** dono, 2026-11-23 ("de acordo: 3" — piloto do radar de repositórios).
- **Catálogo:** `ops/radar-repositorios/catalogo.json` · relatório `docs/RADAR_REPOSITORIOS.md`.

## Atualizar ou remover

Atualizar = ler o diff entre o commit acima e o novo com o `security-reviewer`, refazer as
mudanças listadas e trocar o commit no catálogo. Remover = apagar esta pasta e a `ativacao` do
item no catálogo e rodar `node ops/radar-repositorios/radar.mjs relatorio`.
