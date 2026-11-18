# Fluxo de Git — regras comuns

- Branch a partir de `main` (`feat/…`, `fix/…`, `docs/…`); **PR para `main`**, nunca commit direto.
- **Nunca** force-push em branch compartilhada; nunca reescrever histórico publicado.
- **Conventional Commits:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`
  (ex.: `feat(ia): solucionador cego na fábrica de questões`).
- Um PR = uma intenção. Migrations, funções e front da mesma feature podem ir juntos, com a
  **ordem de implantação** descrita no PR.
- Preencha o template de PR (`.github/pull_request_template.md`); CI verde é pré-requisito.
- Nunca commitar segredos. `.env` contém só a chave publicável (pública por design) e é gerido pelo Lovable.
- Arquivos gerenciados pelo Lovable (`.lovable/`, `auth-email-hook`, `types.ts` gerado) não são editados à mão.
- CHANGELOG atualizado em mudança visível ao aluno ou à equipe.
