# Login com Google com a marca LevelUp Exams

**Problema:** ao entrar com Google, o aluno vê "rxsovhyimflzvxggppal.supabase.co" na tela do Google e no e-mail "Você compartilhou alguns dados da sua Conta do Google". Parece golpe.

**Causa:** o login do Google volta pelo endereço técnico do banco de dados (Supabase), e o app ainda não tem a marca verificada no Google. Enquanto a marca não for verificada, o Google mostra o domínio de retorno no lugar do nome do app.

**Resultado esperado:** a tela do Google e o e-mail passam a mostrar **LevelUp Exams**, com o logo.

> O e-mail "Você compartilhou alguns dados…" é um aviso de segurança do próprio Google e não pode ser desligado por nenhum app. O que muda é o que ele mostra: nome e logo do LevelUp Exams no lugar do endereço técnico.

## Já feito no código

- Páginas públicas `/sobre` (apresentação), `/privacidade` (Política de Privacidade, LGPD) e `/termos` (Termos de Uso).
- Rodapé com links legais na página inicial e aviso "Ao continuar, você concorda…" na tela de login.
- Conteúdo estático no `index.html` com o nome e os links legais, lido pelo robô de verificação do Google.
- Nome, domínio e e-mail centralizados em `src/config/site.ts`.
- Chave para o Google passar pelo login do Lovable com credenciais próprias, que devolve o aluno no domínio do app (`src/lib/authProviders.ts`). Fica desligada até a etapa 7.

## Situação (12/11/2026)

- [x] Domínio `levelupexams.com.br` registrado e conectado ao Lovable (o antigo `levelupexams.lovable.app` e o `www` já redirecionam para ele)
- [x] E-mail `contato@levelupexams.com.br` criado
- [ ] Registro **A** do domínio puro (`@` → `185.158.133.1`) no Registro.br — sem ele o site não abre
- [ ] Etapas 4 a 8

## Ordem das etapas

A ordem importa: o Google só aprova a marca se, no momento da análise, a tela de login já mostrar o domínio próprio e não o supabase.co.

### 1. Comprar o domínio
1. Em registro.br, pesquise `levelupexams.com.br` (ou outro nome de sua escolha) e registre (cerca de R$ 40 por ano).
2. Se usar outro nome, troque `domain` e `contactEmail` em `src/config/site.ts`.

### 2. Conectar o domínio ao Lovable
1. No projeto do Lovable: **Settings → Domains → Connect domain**.
2. Copie os registros DNS que o Lovable mostrar e cadastre no Registro.br (**Domínios → DNS → Editar zona**).
3. Aguarde o certificado (cadeado) ficar ativo e marque o domínio como **principal**.

### 3. Criar o e-mail contato@
- **Receber:** use um serviço de e-mail ou de redirecionamento para o seu Gmail (por exemplo, Zoho Mail gratuito ou ImprovMX).
- **Enviar os e-mails do app** (confirmação de cadastro, redefinição de senha) com o seu domínio: no Lovable, **Cloud → Emails** (custom emails).

### 4. Provar ao Google que o domínio é seu
1. Acesse search.google.com/search-console com a **mesma conta Google** que vai administrar o projeto no Google Cloud.
2. **Adicionar propriedade → Domínio** → `levelupexams.com.br`.
3. Cadastre o registro TXT indicado no Registro.br e clique em **Verificar**.

### 5. Configurar a marca no Google Cloud
Em console.cloud.google.com, crie (ou abra) o projeto **LevelUp Exams** e vá em **Google Auth Platform**:

**Branding**
| Campo | Valor |
|---|---|
| App name | `LevelUp Exams` (exatamente assim) |
| User support email | `contato@levelupexams.com.br` |
| App logo | arquivo `logo-google-120.png` (120 × 120) |
| Application home page | `https://levelupexams.com.br/sobre` |
| Privacy policy | `https://levelupexams.com.br/privacidade` |
| Terms of service | `https://levelupexams.com.br/termos` |
| Authorized domains | **somente** `levelupexams.com.br` (remova qualquer `supabase.co`) |
| Developer contact | seu e-mail |

**Audience:** tipo **External** → clique em **Publish app** (status **In production**).

**Data access:** apenas `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile`. Não adicione outros: esses três não exigem auditoria de segurança.

**Clients → Create client → Web application**
- Authorized JavaScript origins: `https://levelupexams.com.br`
- Authorized redirect URIs: cole **exatamente** a(s) URI(s) que o Lovable mostrar na etapa 6.
- Guarde o **Client ID** e o **Client secret**.

### 6. Ligar as credenciais no Lovable
1. **Cloud → Users → Auth settings → Google**.
2. Selecione **Your own credentials** e cole Client ID e Client secret.
3. Copie as URIs de retorno que o Lovable lista, cadastre no Google Cloud (etapa 5) e **selecione no Lovable** a do domínio próprio.
4. **Save**.

### 7. Ativar no app
Em `src/lib/authProviders.ts`, acrescente `google` na lista de provedores do broker:

```ts
(import.meta.env.VITE_MANAGED_OAUTH_PROVIDERS ?? 'microsoft,apple,google')
```

Publique. Teste numa janela anônima no domínio próprio: a tela do Google deve mostrar `levelupexams.com.br` (ainda não o nome, isso vem na etapa 8). Só depois do teste ok, remova do cliente Google a URI antiga do `supabase.co`.

### 8. Pedir a verificação da marca
1. Google Auth Platform → **Verification Center** → **Verify branding**.
2. A análise costuma levar alguns dias úteis. O Google pode responder por e-mail pedindo ajustes; responda no mesmo e-mail.
3. Aprovado: a tela e o e-mail passam a mostrar **LevelUp Exams** com o logo.

### 9. Conferir
- [ ] Tela do Google mostra "LevelUp Exams" e o logo
- [ ] E-mail do Google mostra "LevelUp Exams"
- [ ] Login com Google, Microsoft, Apple e e-mail funcionando no domínio próprio
- [ ] `levelupexams.lovable.app` redireciona ou continua funcionando
- [ ] Links de Privacidade e Termos abrindo sem login
