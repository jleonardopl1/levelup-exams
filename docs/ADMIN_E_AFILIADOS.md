# Admin Master, níveis de acesso e programa de afiliados

Migration: `supabase/migrations/20261110150000_master_admin_and_affiliates.sql`

## 1. Níveis de acesso

| Nível | Quem | O que pode fazer |
|-------|------|------------------|
| **Admin Master** | Conta confirmada com o e-mail definido em `public.master_admin_email()` | Tudo. É o **único** que cria, altera e revoga níveis de acesso, adiciona/edita/remove afiliados, registra pagamentos de comissão e altera configurações da plataforma. |
| **Administrador** | `user_roles.role = 'admin'` | Painel completo: métricas, questões, geração de questões, auditoria, moderação de usuários comuns. Vê afiliados em modo leitura (sem e-mails). |
| **Moderador** | `user_roles.role = 'moderator'` | Painel restrito: moderação de usuários comuns (banir/desbanir) e curadoria de questões (premium on/off). |
| **Usuário** | demais contas | Acesso normal ao app. |

**Afiliado** não é um nível de acesso: é um usuário com linha em `referral_codes`. Ele vê apenas o próprio painel em `/affiliate`.

### Garantias aplicadas no banco (não só na interface)

- O master é reconhecido pelo e-mail **confirmado** (comparação sem diferenciar maiúsculas). Uma conta não confirmada com o mesmo e-mail não vira master.
- O e-mail fica fixado no código da função (não em tabela editável): trocar o dono da plataforma exige uma nova migration revisada.
- `has_role(uid, 'admin')` é sempre verdadeiro para o master, mesmo sem linha em `user_roles`.
- O papel de admin do master não pode ser removido nem pelo `service_role` (trigger `protect_master_role`). A exclusão da própria conta continua possível.
- `user_roles`, `user_bans`, `referral_codes` (exceto a autoinscrição), `referral_uses` e `affiliate_payouts` não aceitam escrita direta do cliente: tudo passa por RPCs `SECURITY DEFINER` que revalidam o chamador.
- Hierarquia de moderação (`_can_moderate`): ninguém bane a si mesmo nem o master; administradores e moderadores banem apenas usuários comuns; só o master bane membros da equipe. Um banimento só é alterado ou retirado por quem tem nível igual ou maior ao de quem o aplicou.
- Membro da equipe banido perde os poderes imediatamente (sem esperar o token expirar).
- Ninguém além do próprio usuário edita um perfil (a antiga permissão de admins editarem qualquer perfil foi removida).
- E-mails e IPs aparecem no painel **somente para o master** (LGPD), inclusive nos logs de auditoria, que agora são lidos pela RPC `admin_list_audit_logs`.
- Notas internas do master sobre afiliados (`notes`, `revoked_reason`, `created_by`) não são legíveis pelo afiliado.
- Toda ação gera registro em `audit_logs` (aba Auditoria), com o usuário afetado identificado pelo nome.

### RPCs

| RPC | Quem chama | Função |
|-----|-----------|--------|
| `get_my_access()` | qualquer usuário logado | Nível do próprio usuário (monta menus/abas) |
| `admin_set_access_level(user, level, reason)` | master | Define admin / moderador / usuário de forma atômica |
| `admin_ban_user(user, type, days, reason)` / `admin_unban_user(user)` | equipe | Banimento com hierarquia |
| `admin_list_users(search, filter, limit, offset)` | equipe | Lista paginada com nível, ban e status de afiliado |
| `admin_get_settings()` / `admin_update_setting(key, value)` | admin / master | Configurações da plataforma (autoinscrição e condições padrão) |
| `admin_list_audit_logs(search, limit)` | admin / master | Auditoria com e-mail/IP apenas para o master |

A Edge Function `admin-notify` aplica os efeitos colaterais (bloqueio no Supabase Auth e e-mail ao usuário) relendo o estado do banco, sem confiar no cliente.

## 2. Programa de afiliados

### Ciclo de vida

1. **Entrada**: o master adiciona pelo painel (por e-mail ou pelo botão "Tornar afiliado" na aba Usuários), definindo código, comissão (0–50%) e desconto para o indicado (0–50%). A autoinscrição de Top Players (Plus + 10.000 pontos ou prêmio "Top Player") continua disponível e pode ser desligada pelo master em **Afiliados → Autoinscrição**. As condições da autoinscrição são sempre as padrões do programa (`affiliate_default_*`), forçadas no servidor.
2. **Divulgação**: o afiliado compartilha o código ou o link `https://<app>/?ref=CODIGO`. O link é guardado por 30 dias no navegador e aplicado automaticamente na página de planos.
3. **Venda**: `create-checkout` valida o código (ativo, não é o próprio, primeiro uso do comprador), aplica um cupom Stripe `LEVELUP_REF_<percentual>` (primeira cobrança) e grava `referral_code_id` no metadata da sessão.
4. **Atribuição**: `stripe-webhook`, ao receber `checkout.session.completed` pago (ou `checkout.session.async_payment_succeeded`, para pagamentos confirmados depois), chama `record_referral_conversion` (somente `service_role`). A comissão é calculada sobre o valor efetivamente pago com o percentual vigente. A operação é idempotente (sessão e indicado únicos). Se o código foi pausado ou removido enquanto o checkout estava aberto, a venda é registrada **sem comissão**.
5. **Pagamento**: o master registra repasses (PIX/transferência) em **Afiliados → ⋮ → Registrar pagamento**. O valor não pode exceder o saldo devido.
6. **Pausa / remoção**: pausar desativa o código temporariamente. Remover encerra a participação (o código deixa de funcionar na hora) e **preserva o histórico** de vendas, comissões e pagamentos para prestação de contas. O afiliado pode ser readicionado depois.

> A comissão é gerada sobre a **primeira cobrança** de cada novo assinante indicado (um código por comprador). O próprio código do comprador e compradores que já usaram um código não validam.

### Limitações conhecidas

- Reembolsos e chargebacks **não** estornam a comissão automaticamente: confira antes de registrar o pagamento ao afiliado.
- Visitas ao link podem ser infladas por quem quiser (a contagem é pública); trate-as como indicador, não como dado contábil.
- Exclusão de conta (LGPD): o indicado excluído vira anônimo e a venda continua contabilizada; a exclusão do afiliado remove seu histórico de vendas e pagamentos, que permanece resumido em `audit_logs`.

### KPIs do dashboard do afiliado (`get_affiliate_dashboard`)

| KPI | Definição |
|-----|-----------|
| Comissão no mês | Soma das comissões do mês corrente (fuso America/Sao_Paulo), com variação vs. mês anterior |
| Saldo a receber | Comissão acumulada − pagamentos registrados |
| Comissão acumulada | Total de comissões desde o início |
| Conversões no mês / total | Novas assinaturas atribuídas ao código |
| Receita gerada / ticket médio | Valor pago pelos indicados e média por venda |
| Indicados ativos / retenção | Indicados que continuam com plano Plus / percentual sobre o total |
| Visitas (30 dias) | Aberturas do link `?ref=` (uma por navegador por dia) |
| Taxa de conversão (30 dias) | Conversões ÷ visitas nos últimos 30 dias |
| Ranking | Posição por comissão acumulada entre os afiliados ativos |

Também exibe gráfico mensal (comissão, conversões ou visitas, com visão em tabela), funil de 30 dias, últimas conversões (indicados anônimos) e pagamentos recebidos. O master abre o dashboard de qualquer afiliado pelo painel.

### Visão do programa (`admin_affiliate_overview`)

Afiliados ativos/pausados/removidos, receita via afiliados, comissões dos últimos 30 dias, total pago e saldo a pagar, além da lista com condições, conversões e saldo de cada afiliado.

## 3. Implantação

1. Aplicar a migration (`supabase db push` ou pelo painel do Supabase).
2. Garantir que a conta do master já existe e está com o e-mail **confirmado**, e que a confirmação de e-mail está **ligada** no Supabase (Authentication → Sign In / Providers → Email → Confirm email). Com a confirmação desligada, quem cadastrasse esse e-mail primeiro seria tratado como master.
3. Publicar as Edge Functions alteradas: `admin-notify`, `create-checkout`, `stripe-webhook`.
4. No Stripe, o webhook deve continuar recebendo `checkout.session.completed` (já incluso). A chave precisa de permissão para criar cupons (`coupons:write`), usada na primeira venda de cada percentual de desconto.
5. Em Supabase → Authentication → URL Configuration, inclua `https://<seu-dominio>/redefinir-senha` (e a URL de preview, se usar) em **Redirect URLs**. Sem isso o link do e-mail de "Esqueci minha senha" é recusado.

## 4. Console de conteúdo e métricas (v1.4.0)

Migration: `supabase/migrations/20261113120000_quiz_quality_and_admin_console.sql`

| Aba | Quem vê | O que faz |
|-----|---------|-----------|
| **Visão Geral** | admin, master | Métrica estrela (simulados concluídos por semana), alunos ativos, conversão Plus, receita Stripe, matérias mais praticadas e **Saúde do sistema** |
| **Questões → Banco** | equipe | Busca e filtros, taxa de acerto por questão, editor completo. Moderador altera só Premium e "em circulação" |
| **Questões → Geração com IA** | admin, master | Execuções da geração diária e disparo manual |
| **Reportes** | equipe | Problemas apontados pelos alunos. "Resolver" fecha todos os reportes abertos da questão e notifica os alunos (a observação vai na notificação); "Descartar" não notifica |

Dicas de uso:
- Ordene o banco por **Maior taxa de erro**: questões com menos de 25% de acerto e pelo menos 5 respostas aparecem com ⚠ — costumam ter gabarito errado ou enunciado ambíguo.
- Tirar uma questão de circulação a remove dos simulados e trilhas na hora, sem apagar as respostas já dadas.
- Alterar o gabarito vale a partir da próxima resposta; o histórico antigo não é recalculado.
- Se a "Saúde do sistema" mostrar o webhook do Stripe em vermelho, nenhum evento chegou: cadastre o endpoint `stripe-webhook` (veja `docs/LOGIN_PAGAMENTO_APP.md`).
