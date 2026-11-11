# Login social, pagamentos e app no celular

Diagnóstico feito em 10/11/2026 no app publicado (`levelupexams.lovable.app`, backend Lovable Cloud).

## 1. Login social

### O que foi encontrado

| Botão | Situação no backend | Resultado para o aluno |
|---|---|---|
| Google | Ativo (credenciais próprias) | Funcionava |
| GitHub | Desativado | Erro "Unsupported provider" |
| LinkedIn | Desativado | Erro "Unsupported provider" |
| Microsoft | Desativado (`azure`) | Erro "Unsupported provider" |
| Facebook | Desativado | Erro "Unsupported provider" |

Quatro dos cinco botões levavam a erro. O Lovable Cloud oferece **Google, Apple e Microsoft**
(gerenciados pelo Lovable, sem configuração), além de e-mail, telefone, SAML e **um** provedor
OIDC. **GitHub e Facebook não são suportados pelo Lovable Cloud**; LinkedIn só como OIDC próprio.

### O que mudou no código

- A tela de login só mostra os provedores **realmente ativos** (lidos do backend em tempo real).
  Se um provedor for ativado depois, o botão aparece sozinho.
- Microsoft (Outlook/Hotmail/Live) passa a usar o login gerenciado do Lovable Cloud
  (`src/integrations/lovable`).
- Erros de login na volta do provedor viram mensagem clara em português e levam de volta ao login.
- Cadastro: `src/lib/authProviders.ts`.

### O que o Jonas precisa fazer (1 clique)

1. No Lovable, abra o projeto → **Cloud** → **Users** → **Auth settings** → **Microsoft**.
2. Ligue **Enable Microsoft sign-in** (modo "Managed by Lovable").
3. Pronto. Até isso ser feito, o botão Microsoft mostra "Este método de login ainda não está ativado".

Opcionais:
- **Apple**: ligar em Auth settings → Apple e definir `VITE_MANAGED_OAUTH_PROVIDERS=microsoft,apple`.
  Necessário se um dia o app for para a App Store com login social.
- **LinkedIn**: Auth settings → OIDC, com Issuer `https://www.linkedin.com/oauth`, Client ID/Secret
  de um app em linkedin.com/developers (produto "Sign In with LinkedIn using OpenID Connect").
  Depois peça ao Lovable no chat: "adicione o botão de login OIDC do LinkedIn".

## 2. Pagamentos (Stripe)

### O que foi verificado

- Chaves do Stripe e do webhook configuradas; funções `create-checkout`, `check-subscription`,
  `customer-portal` e `stripe-webhook` no ar e respondendo corretamente.
- 3 sessões de checkout já foram criadas com sucesso (plano mensal) → chave e preço mensal OK.
- **Nenhum evento de webhook do Stripe chegou até hoje** e não há assinantes Plus.

### Correções no código

- **Botão "Assinar" no iPhone/app instalado**: o checkout abria numa nova aba depois de uma
  espera, e Safari/PWA bloqueavam a janela — o botão parecia não fazer nada. Agora abre na mesma aba.
- **Volta do pagamento**: o app confirma o Plus direto no Stripe (repete por ~30 s) antes de
  atualizar o perfil; antes podia continuar mostrando "Gratuito".
- **Plano sincronizado a cada login**: mesmo que o webhook falhe, o Plus é liberado (e o
  cancelamento é aplicado) assim que o aluno entra no app.
- Mensagens de erro reais no "Gerenciar assinatura".

### O que o Jonas precisa conferir no Stripe

1. dashboard.stripe.com → **Developers → Webhooks**: deve existir o endpoint
   `https://rxsovhyimflzvxggppal.supabase.co/functions/v1/stripe-webhook` no **mesmo modo**
   (Teste ou Produção) da chave usada pelo app, com os eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created/updated/deleted/paused/resumed`,
   `invoice.payment_succeeded`, `invoice.payment_failed`.
2. O "Signing secret" desse endpoint deve ser o mesmo salvo como `STRIPE_WEBHOOK_SECRET`.
3. Conferir que o preço anual `price_1SdkMfFQ1QkvCgEAnMRl3MXq` existe no mesmo modo
   (nunca foi usado em produção).
4. Testar pagamentos no endereço publicado, não na pré-visualização do editor
   (as funções só aceitam chamadas de `levelupexams.lovable.app`).

## 3. App para Android e iPhone

- O site virou um **app instalável (PWA)**: ícones próprios, tela cheia, atalhos
  (Quiz, Trilhas, Progresso) e abertura rápida/offline do app.
- Página **/instalar** ("Baixar o app" no menu e na tela de login) com botão de instalação
  no Android/computador e passo a passo para iPhone (Safari → Compartilhar → Adicionar à Tela de Início).

### Lojas (próximo passo, opcional)

- **Google Play**: empacotar o PWA como TWA (ex.: pwabuilder.com) — conta de desenvolvedor
  US$ 25 (uma vez). Exige `/.well-known/assetlinks.json` com a impressão digital da chave do app.
- **App Store**: conta Apple Developer US$ 99/ano. A Apple costuma recusar apps que são só um
  site (diretriz 4.2), pede uma opção de login com privacidade equivalente, como "Iniciar sessão com a Apple", quando há login social (4.8) e
  exige compra pelo próprio iPhone para assinaturas digitais (3.1.1) — o Stripe dentro do app
  pode causar recusa. Avaliar antes de investir.
