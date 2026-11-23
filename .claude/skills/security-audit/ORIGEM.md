# Origem desta skill

- **Repositório:** https://github.com/cloudflare/security-audit-skill
- **Commit:** `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14)
- **Licença:** MIT, Cloudflare, Inc. (`LICENSE` nesta pasta)
- **Arquivos copiados:** todo `skills/security-audit/` do commit acima, sem os testes
  `validate-findings.test.cjs` e `validate-coverage-ledger.test.cjs`. Nenhum arquivo foi alterado.
- **Revisão de segurança:** `security-reviewer`, 2026-11-23, aprovado com condições. Sem hooks,
  MCP nem scripts de instalação; os validadores (`*.cjs`, Node puro) só leem arquivos.
- **Aprovação:** dono, 2026-11-23 (pedido para instalar e ativar o que fizer sentido).
- **Catálogo:** `ops/radar-repositorios/catalogo.json` · relatório `docs/RADAR_REPOSITORIOS.md`.

## Condições de uso no LevelUp

1. O modo padrão é orientação (não grava arquivos). A **auditoria completa** só roda a pedido
   explícito do dono, com orçamento de subagentes combinado.
2. A saída da auditoria completa fica **fora do repositório** (o padrão da skill é
   `~/security-audit-skill/...`) ou no scratchpad da sessão. Nunca commitar relatório com detalhe
   de vulnerabilidade não corrigida.
3. Os validadores rodam com o `node` do sistema, nunca por `npx`.
4. Nunca sondar ambiente vivo com dados de alunos; o método é por leitura de código (a própria
   skill proíbe sondar e instalar dependências).

## Atualizar ou remover

Atualizar = ler o diff entre o commit acima e o novo com o `security-reviewer`, copiar de novo e
trocar o commit no catálogo. Remover = apagar esta pasta e a `ativacao` do item no catálogo e
rodar `node ops/radar-repositorios/radar.mjs relatorio`.
