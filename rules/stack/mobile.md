# Mobile (PWA, Capacitor, lojas) — regras de stack

- **Uma base de código:** o app das lojas é o mesmo build Vite empacotado com Capacitor; nada de
  lógica de negócio exclusiva do nativo.
- **Valor nativo real** antes de submeter à App Store (diretriz 4.2): push, offline das trilhas,
  lembretes locais, compartilhamento nativo, biometria/haptics.
- **Gabarito nunca no aparelho;** respostas offline vão para fila local e são validadas no servidor.
- **Tokens** em armazenamento seguro do sistema (Keychain/Keystore), não em `localStorage` no nativo.
- **Deep links** (`/trilhas/:slug`, `/?ref=`) validados; nada de abrir URL arbitrária vinda de link.
- **Atualização:** web layer pode ser atualizada sem nova versão na loja só dentro do que as
  diretrizes permitem (sem mudar o propósito do app).
- **Cobrança:** compra digital dentro do app segue a regra de cada loja (IAP / Play Billing) salvo
  exceções vigentes no Brasil; direitos convergem em `profiles.tier` (decisão D5).
- **Privacidade:** rótulos da App Store e "Data safety" do Play coerentes com a LGPD e o ECA Digital.
- **Segurança:** checklist OWASP MASVS na revisão do `security-reviewer`.
