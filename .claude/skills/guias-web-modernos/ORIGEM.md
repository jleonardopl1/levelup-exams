# Origem destes guias

- **Repositório:** https://github.com/GoogleChrome/modern-web-guidance
- **Commit:** `2b4aa13a72dd47cd135b06ce5abfccd92e19b24f` (Release v1.0.2, 2026-11-23)
- **Licença:** Apache-2.0 (`LICENSE` nesta pasta)
- **Arquivos copiados:** `skills/modern-web-guidance/guides/` das categorias accessibility, css,
  forms, html, js, performance, privacy, pwa, security, ui-atoms, ui-behaviors, ui-components,
  user-experience e visual-design (202 guias em Markdown), sem alteração.
- **Deixados de fora:** a `SKILL.md` original e o plugin; as categorias webmcp, built-in-ai e
  wasm; o CLI `npx modern-web-guidance@latest`.
- **Adaptação:** `SKILL.md` própria, escrita para o LevelUp, que consulta os guias locais com
  Grep e Read.
- **Revisão de segurança:** `security-reviewer`, 2026-11-23, aprovado com condições: não instalar
  como plugin nem liberar o `npx` (a skill original baixa e executa a versão mais recente do npm a
  cada consulta, se declara obrigatória em toda tarefa, pede pré-autorização de rede e sugere
  editar o `CLAUDE.md`). Copiar só os guias, com a licença, e escrever a própria `SKILL.md`.
- **Aprovação:** dono, 2026-11-23 (pedido para instalar e ativar o que fizer sentido).
- **Catálogo:** `ops/radar-repositorios/catalogo.json` · relatório `docs/RADAR_REPOSITORIOS.md`.

## Atualizar ou remover

Atualizar = ler o diff de `guides/` entre o commit acima e o novo com o `security-reviewer`,
copiar de novo e trocar o commit no catálogo. Remover = apagar esta pasta e a `ativacao` do item
no catálogo e rodar `node ops/radar-repositorios/radar.mjs relatorio`.
