# Auditoria de Segurança — LevelUp Exams

**Data:** 2026-11-10 · **Escopo:** frontend (React/Vite), Edge Functions (Deno), banco Supabase (todas as migrations), dependências npm.
**Método:** 3 passadas de revisão manual + validação dinâmica: todas as migrations aplicadas em um PostgreSQL 16 limpo (com emulação dos papéis `anon`/`authenticated`/`service_role` e `auth.uid()` do Supabase), seguidas de um roteiro de exploits executado **antes** e **depois** da correção.

> Severidade: **Crítica** = perda financeira/dados de todos os usuários sem pré-requisitos; **Alta** = impacto relevante com pré-requisito baixo; **Média/Baixa** = defesa em profundidade.

## Resumo

| ID | Severidade | Achado | Status |
|----|-----------|--------|--------|
| C1 | Crítica | Gabarito (`questions.correta`) e questões premium legíveis por qualquer usuário logado | Corrigido |
| C2 | Crítica | Usuário se auto-promovia a **Plus** (`UPDATE profiles SET tier='plus'`) | Corrigido |
| C3 | Crítica | RPCs `SECURITY DEFINER` sem checagem de identidade e executáveis por **anon**: pontos infinitos para qualquer conta, resgate de prêmios com custo negativo/zero, bloqueio da cota de terceiros | Corrigido |
| C4 | Crítica | Economia de pontos/uso 100% confiada ao cliente (UPDATE/INSERT diretos em `user_rewards`, `user_redemptions`, `daily_question_usage`, `ai_mentor_usage`) | Corrigido / mitigado |
| C5 | Crítica | Fraude no programa de indicação: criar código sem ser Top Player, definir comissão de 99% e alterar `total_earnings` (valor a pagar) | Corrigido |
| C6 | Crítica | Webhook Stripe: `listUsers({filter})` ignora o filtro ⇒ cada evento de assinatura alterava o plano do **primeiro usuário da base**, não do pagante; verificação de assinatura via API síncrona (o padrão recomendado para Deno é `constructEventAsync` com WebCrypto) | Corrigido |
| H1 | Alta | Ranking público (anon) expunha `user_id` de todos os jogadores (insumo para C3) e aceitava `limit` ilimitado | Corrigido |
| H2 | Alta | **LGPD**: `display_name` padrão = e-mail do usuário, exposto publicamente no ranking | Corrigido (dados existentes saneados) |
| H3 | Alta | Banimento não era aplicado em lugar nenhum (só gravado em `user_bans`) | Corrigido |
| H4 | Alta | `send-contact` (anônimo) servia de relay de spam/phishing: enviava e-mail com conteúdo arbitrário a qualquer endereço, a partir do domínio do produto | Corrigido |
| H5 | Alta | `has_role`/`get_user_tier` consultáveis para **qualquer** usuário (enumeração de admins, plano de terceiros) | Corrigido |
| H6 | Alta | Rate limit não atômico (race) e baseado só em `X-Forwarded-For` (falsificável) | Corrigido |
| H7 | Alta | Cota diária do Mentor IA com race condition e consumida antes da validação | Corrigido |
| H8 | Alta | Open redirect pós-pagamento: `success_url`/`return_url` montados a partir do header `Origin` | Corrigido |
| M1 | Média | Mensagens de erro internas (Stripe/Auth) devolvidas ao cliente | Corrigido |
| M2 | Média | Pagamento: busca de cliente Stripe só por e-mail, sem vínculo forte e sem exigir e-mail confirmado; possibilidade de assinatura duplicada | Corrigido |
| M3 | Média | `window.open` sem `noopener` (reverse tabnabbing) e sem validar a URL de pagamento | Corrigido |
| M4 | Média | `cleanup_audit_logs()`/`cleanup_rate_limits()` executáveis por anon | Corrigido |
| M5 | Média | Policy permitia admin **forjar** registros de auditoria; `details` arbitrário do cliente era espalhado no log | Corrigido |
| M6 | Média | Webhook sem idempotência (reentrega/replay reprocessava eventos) | Corrigido |
| M7 | Média | Dependências com CVEs (react-router, postcss, ws, lodash, nanoid, …) | Parcial (ver pendências) |
| L1 | Baixa | `.env` versionado apesar do `.gitignore` (contém apenas a chave **anon**, pública por design) | Informativo |

## Prova (antes × depois)

Roteiro executado em PostgreSQL 16 com todas as migrations do repositório:

| Ataque | Antes | Depois |
|---|---|---|
| Ler `questions.correta` | 10 gabaritos | `permission denied` |
| Resposta de questão premium sendo free (`validate_answer`) | resposta retornada | negado |
| `UPDATE profiles SET tier='plus'` | `plus` | permanece `free` |
| anon: `increment_user_points(vitima, 1000000)` | vítima com 1.000.010 pts | função removida |
| `redeem_reward(..., -100000)` | +100.000 pts | "Pontos insuficientes" |
| Resgatar "Mês grátis" por 0 pts | sucesso | negado (custo vem do catálogo) |
| `increment_daily_usage(vitima, ..., 9999)` | vítima bloqueada | `not authorized` |
| `UPDATE user_rewards SET total_points=999999` | 999.999 | limitado a +1.000/escrita e 5.000/dia |
| INSERT direto em `user_redemptions` / contadores de uso | aceito | bloqueado por RLS |
| Código de indicação com comissão 99% | aceito | bloqueado por RLS |
| `UPDATE referral_codes SET total_earnings=99999` | 99.999,00 | `permission denied` |
| anon: `get_leaderboard` → `user_id` | exposto | coluna inexistente |
| anon: `has_role(admin)` / user: `get_user_tier(outro)` | `t` / `plus` | negado / `free` |
| anon: `cleanup_audit_logs()` | executa | negado |
| Cadastro sem nome → nome público | `pii@x.com` | vazio ("Anônimo") |

Fluxos legítimos verificados após a correção: listar questões (free e plus), validar resposta, editar perfil, ganhar pontos de quiz, crédito de pontos de conquista (agora no servidor), resgate legítimo, contador diário, ranking anônimo, admin (alternar premium, ler auditoria, ver perfis/papéis, desativar código), criação de código de indicação por Plus com 10.000 pts, e as funções de servidor (`check_rate_limit`, `consume_ai_mentor_quota`, `get_user_id_by_email` só para e-mail confirmado, `is_user_banned`, idempotência do webhook).

## O que mudou

- **`supabase/migrations/20261110120000_security_hardening.sql`** — privilégios por coluna em `questions`; paywall premium na RLS; `has_role`/`get_user_tier` restritos ao próprio usuário (ou service_role); RPCs reescritas com `auth.uid()`, `search_path` fixo e `EXECUTE` revogado de `PUBLIC`/`anon`; triggers que protegem `profiles.tier` e limitam escritas do cliente em `user_rewards`; pontos de conquista creditados por trigger; policies de indicação com regra de negócio no servidor; ranking sem UUIDs e com `limit` ≤ 100; saneamento de nomes que eram e-mails; helpers `service_role` para rate limit atômico, cota do Mentor, lookup por e-mail confirmado, banimento e idempotência do webhook.
- **Edge Functions** — módulo `_shared` com `requireUser`/`requireAdmin` (Bearer estrito + bloqueio de banidos), rate limit atômico *fail-closed* por usuário, leitura de JSON com limite de tamanho, respostas sem vazamento de erro e `Cache-Control: no-store`. Stripe: vínculo `metadata.supabase_user_id`, redirects fixos em `SITE_URL`, estado da assinatura recalculado a partir do Stripe (não da ordem dos eventos), `constructEventAsync`. `send-contact` não ecoa mais conteúdo para terceiros e tem limites por IP, por destinatário e global. `admin-notify` aplica o ban no Supabase Auth (`ban_duration`) e grava apenas campos permitidos.
- **Frontend** — ranking usa `is_current_user`; removidas escritas diretas de pontos/uso do Mentor; `window.open` com `noopener,noreferrer` e validação de domínio Stripe; `Referrer-Policy`.
- **Dependências** — `npm audit fix` (sem upgrades de major).

## Deploy — ordem obrigatória

1. Aplicar a migration **antes** de publicar as Edge Functions (as funções dependem de `check_rate_limit`, `consume_ai_mentor_quota`, `get_user_id_by_email`, `is_user_banned` e `stripe_webhook_events`; o rate limit é *fail-closed*).
2. Variáveis das Edge Functions: `SITE_URL` (ex.: `https://simuladosconcursos.com.br`), `ALLOWED_ORIGIN`, opcionalmente `STRIPE_ALLOWED_PRICE_IDS`, `MAIL_FROM`, `CONTACT_INBOX`.
3. Publicar o frontend (a RPC `get_leaderboard` mudou de assinatura).

## Pendências e riscos residuais (requerem decisão/arquitetura)

1. **Pontuação e resultados ainda são calculados no cliente.** As travas limitam o dano (sem pontos negativos, ≤1.000 por escrita, ≤5.000/dia, conquistas uma única vez), mas um usuário técnico ainda pode inflar `quiz_results.score`/ranking e acumular até o teto diário. Correção definitiva: sessão de quiz no servidor (RPC `start_quiz` → questões sorteadas e guardadas; `submit_quiz` → corrige com `correta` e calcula pontos/estatísticas/conquistas no banco).
2. **Limite diário de questões do plano free** é aplicado no cliente; só o conteúdo premium está protegido no servidor. Resolve-se junto com o item 1.
3. **Supabase Auth (painel):** ativar confirmação de e-mail, *leaked password protection*, senha mínima ≥ 8 e CAPTCHA (Turnstile/hCaptcha) no cadastro/login e no formulário de contato.
4. **Cabeçalhos HTTP do host** (não configuráveis no repositório): `Content-Security-Policy` (sugestão: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`. O token de sessão fica em `localStorage`, então a CSP é a principal defesa contra roubo de sessão via XSS.
5. **Dependências restantes:** `react-router-dom` (moderada, correção só na v7), `zod` (alta, correção só na v4) — exigem migração de major. `bun.lockb` não foi regenerado; se o build usar Bun, rode `bun install`.
6. **`verify_jwt = false`** em todas as funções: a autenticação é feita no código (`requireUser`). Se o projeto usar chaves JWT legadas (HS256), considerar `verify_jwt = true` nas funções autenticadas como defesa em profundidade.
7. **Retenção (LGPD):** agendar `cleanup_audit_logs()` e `cleanup_rate_limits()` (pg_cron); `audit_logs` guarda IP/e-mail por 90 dias — documentar na política de privacidade.
8. **Comissões de indicação:** `total_earnings`/`commission_earned` só podem ser escritos por `service_role`; nenhum código atual os calcula — implementar no webhook a partir de `invoice.payment_succeeded` antes de qualquer pagamento a afiliados.
