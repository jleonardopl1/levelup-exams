# Changelog

## [1.7.0] - 2026-11-16

### Features (IA multiagente)
- **Fábrica de questões multiagente**: Elaborador → portão determinístico (pista de tamanho, "todas/nenhuma", gabarito no enunciado) → **Solucionador cego** (resolve sem ver o gabarito) em paralelo com o Revisor técnico → **Árbitro** só nas divergências; respeita o prazo de 140 s do agendador e reprova o que não deu tempo de arbitrar
- **Memória de lições por matéria**: o que o revisor, o árbitro e o portão reprovam volta ao prompt do Elaborador (`ai_lessons`, desativável pela equipe)
- **Camada de IA compartilhada** (`_shared/ai`): saída estruturada validada, novas tentativas com backoff só em erro temporário, prazo global, telemetria de metadados (`ai_runs`) e cercas contra injeção de prompt
- Correção da discursiva no cliente compartilhado (nova tentativa em falha temporária; texto do aluno cercado); Mentor com modelo configurável (`MENTOR_MODEL`) e telemetria
- Governança AGENTS-COLLAB: 17 agentes por faixa (`.claude/agents/`), `rules/`, `CLAUDE.md`, `AGENTS.md`, `AGENTS-COLLAB.md`, CI e templates de PR/issue

### Fixes
- Explicação que cita alternativa por letra deixava de bater depois do embaralhamento: o Elaborador não cita letras e a publicação não embaralha quando a explicação cita
- Gráficos (recharts, ~105 kB gzip) eram pré-carregados em toda página: JavaScript inicial caiu de 328 para 226 kB gzip
- Lint voltou a passar (9 erros); `package-lock.json` sincronizado com o `package.json`

### Banco
- `20261116120000_ai_runtime_observability.sql`: `ai_runs` (telemetria, retenção de 90 dias via pg_cron), `ai_lessons`, RPCs `record_ai_lessons` e `purge_old_ai_runs` (só `service_role`); leitura só para administradores

## [1.6.0] - 2026-11-15

### Features (Plus)
- **Simulado Oficial**: a prova inteira no formato do edital (70 questões, 15/15/40), cronômetro no servidor, sem gabarito até entregar, nota com os pesos e a regra de habilitação, resultado por área e revisão; Free faz 1 a cada 30 dias
- **Posição entre os candidatos do cargo** no resultado (Plus: posição, percentil e % habilitados; Free: metade de cima/baixo)
- **Revisão espaçada dos erros** (1, 3, 7, 14 e 30 dias, comprimida perto da prova): card "Revisão de hoje" e `/quiz?mode=srs`; Free: 5 por dia
- **Correção da discursiva** (`/trilhas/:slug/discursiva`): tema do cargo, nota estimada (80 conteúdo + 20 formal calculada no servidor), erros com trecho e correção, parágrafo reescrito; 3 por semana
- **Mentor IA com contexto** do aluno (trilha, cargo, dias até a prova, último simulado, matérias fracas) e "Explicar com o Mentor IA" por questão, sem gastar as 6 perguntas do dia
- **PDF do resultado** com explicações (quiz e Simulado Oficial)
- **Passe Concurso**: pagamento único com Plus até 15 dias depois da prova (aparece quando `STRIPE_PRICE_EXAM_PASS` está configurado)
- Matérias específicas de cargo passam a receber 6 questões novas por dia

### Fixes
- Planos, FAQ e modais anunciavam benefícios que não existiam (sem anúncios, acesso prioritário, Mentor ilimitado, estatísticas avançadas, PDF): agora tudo sai de `src/config/plans.ts`
- FAQ dizia que o limite diário renova à meia-noite; renova à meia-noite UTC (21h de Brasília)

### Banco
- `20261115120000_plus_features_v1.sql`: `mock_exams`, `mock_exam_items`, `question_review_schedule`, `review_daily_usage`, `exam_pass_purchases`; RPCs `start_mock_exam`, `get_mock_exam`, `save_mock_answer`, `finish_mock_exam`, `get_mock_exam_standing`, `get_review_queue`, `grant_exam_pass`; `validate_answer` recusa questão de simulado aberto; `get_premium_access` ganha `grant_kind`
- `20261115130000_essay_reviews.sql`: `essay_submissions`, `get_essay_quota`, `begin_essay_submission`
- Passo a passo de implantação em `docs/PLUS_IMPLANTACAO.md`

## [1.5.0] - 2026-11-13

### Features
- Admin master com **Plus permanente** (todas as funcionalidades pagas), sem assinatura
- Painel admin → Usuários: **Liberar Plus** para qualquer usuário (7 dias a 1 ano, ou sem prazo), com motivo, substituição e retirada; selo com a origem do Plus (assinante, liberado até dd/mm, permanente) e filtro "Plus liberado"
- Tela de planos e Configurações mostram quando o Plus foi liberado pela equipe (sem botão de portal de pagamento)

### Banco
- Migration `20261113150000_premium_grants.sql`: `profiles.billing_tier` (plano pago) separado de `profiles.tier` (plano efetivo), tabela `premium_grants`, trigger `sync_profile_effective_tier`, RPCs `admin_grant_premium`, `admin_revoke_premium`, `get_premium_access`, job horário `expire-premium-grants`; `get_user_tier`, `admin_list_users`, `admin_platform_overview` e `get_affiliate_dashboard` atualizados (cortesia não conta como receita nem como indicado ativo)
- Edge Functions `check-subscription`, `stripe-webhook`, `ai-mentor` e `admin-metrics` passam a gravar/ler o plano pago em `billing_tier` (versões antigas continuam compatíveis durante a publicação)

## [1.4.0] - 2026-11-13

### Fixes
- Simulado geral ("Iniciar Simulado" e categorias) trazia sempre as mesmas 10 questões: agora prioriza as inéditas, depois as erradas, em ordem aleatória (RPC `get_quiz_questions`)
- Fim do simulado por tempo esgotado calculava a nota com a lista de respostas vazia (o aluno recebia 0%)
- Erro de validação da resposta (limite de requisições, conexão) contava como resposta errada sem aviso; agora mostra a mensagem e deixa responder de novo
- Falha ao salvar o resultado deixava o aluno preso na tela; agora oferece "Tentar salvar de novo" ou ver o resultado
- Tela inicial podia abrir com "Estudante", nível 1 e 0 simulados para quem já estava logado (o cache era limpo ao restaurar a sessão)
- Nível e XP da tela inicial usavam outra fórmula e não batiam com Dashboard e Recompensas
- Limite diário do plano Free passa a contar só as questões respondidas

### Features
- Resultado do simulado com revisão questão a questão (sua resposta, gabarito e explicação), desempenho por matéria, pontos ganhos, "Revisar meus erros" (trilhas) e "Explicar com o Mentor IA"
- Resultado sobrevive a recarregar a página
- Simulado: atalhos de teclado (A–E / 1–5 e Enter), confirmação ao sair no meio (com opção de encerrar e ver o resultado parcial), aviso ao fechar a aba
- "Reportar erro" em cada questão; o aluno é notificado quando a equipe corrige
- Navegação inferior no celular / app instalado (Início, Trilhas, Simulado, Ranking, Progresso)
- Painel admin:
  - Visão Geral nova: métrica estrela (simulados concluídos por semana, com tendência e histórico de 12 semanas), alunos ativos (dia/7d/30d), conversão para Plus, cadastros x ativos em 30 dias, matérias mais praticadas com taxa de acerto, receita do Stripe e **Saúde do sistema** (webhook do Stripe, geração de questões, falhas, qualidade do conteúdo)
  - Banco de questões: filtros (categoria, situação, origem, Free/Plus), ordenação por taxa de erro / reportes / respostas, paginação, taxa de acerto de cada questão e editor completo (enunciado, alternativas, gabarito, explicação, categoria, tópico, dificuldade)
  - Questões podem sair de circulação sem apagar o histórico
  - Aba Reportes: fila de reportes dos alunos, resolver (fecha todos da mesma questão e avisa os alunos) ou descartar
  - Abas lembradas na URL (`/admin?tab=reports`) e atalho "Painel Admin" no menu do avatar
- Moderadores: curadoria (Premium / em circulação) e fila de reportes; conteúdo e gabarito só admin/master — regra aplicada no banco

### Banco
- Migration `20261113120000_quiz_quality_and_admin_console.sql`: `questions.is_active`, `question_reports`, RPCs `get_quiz_questions`, `report_question`, `admin_platform_overview`, `admin_list_questions`, `admin_update_question`, `admin_list_question_reports`, `admin_resolve_question_report` (todas revalidam o nível do chamador e registram em `audit_logs`)

## [1.3.1] - 2026-11-11

### Fixes
- Assinatura: os preços Mensal e Anual estavam trocados (o botão Mensal cobrava R$ 159,90/ano). O app envia só o plano; o servidor escolhe o preço e confere a periodicidade no Stripe antes de criar o checkout
- Preços configuráveis por secret (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`) para trocar de teste para produção sem mudar código


## [1.3.0] - 2026-11-10

### Fixes
- Login social: GitHub, LinkedIn, Microsoft e Facebook estavam desativados no backend e davam erro "Unsupported provider". A tela de login agora mostra apenas os provedores ativos (lidos do backend) e o Microsoft/Outlook usa o login gerenciado do Lovable Cloud
- Erros na volta do login social viram mensagem em português e levam de volta ao login
- Assinatura: o checkout do Stripe abre na mesma aba (antes era bloqueado como pop-up no iPhone, Safari e no app instalado)
- Volta do pagamento confirma o Plus direto no Stripe antes de atualizar o perfil
- "Gerenciar assinatura" mostra o motivo real do erro

### Features
- Plano Free/Plus sincronizado com o Stripe a cada login (não depende só do webhook)
- App instalável no Android, iPhone e computador (PWA): ícones, tela cheia, atalhos, abertura offline do app
- Página `/instalar` ("Baixar o app") com instalação em um toque e passo a passo para iPhone
- Guia `docs/LOGIN_PAGAMENTO_APP.md` com o diagnóstico e os passos de configuração


## [1.2.1] - 2026-11-10

### Fixes
- Contas criadas pelo Google ficavam sem nome (o app mostrava "Estudante"/"Usuário"): o cadastro passa a usar o nome e a foto do provedor de login, e contas existentes sem nome foram preenchidas a partir dos dados do login
- Login pelo Google sempre abre a tela de escolha de conta (antes entrava direto com a conta ativa no navegador)
- Menu do usuário mostra o e-mail da conta logada

### Features
- Recuperação de senha: "Esqueci minha senha" no login e página `/redefinir-senha` (também permite que contas criadas pelo Google definam uma senha)
- Página de Configurações (`/configuracoes`): nome e foto, dados da conta (e-mail, formas de login, plano, nível de acesso), criar/alterar senha, sair de todos os dispositivos, lembretes e pedido de exclusão de conta


## [1.2.0] - 2026-11-10

### Features
- Admin Master: conta do dono da plataforma com controle exclusivo de níveis de acesso (admin, moderador, usuário), protegida contra revogação
- Painel admin reorganizado por nível de acesso (Master, Administrador, Moderador), com busca paginada, filtros (equipe, afiliados, Plus, banidos) e guia da hierarquia
- Gestão de afiliados pelo master: adicionar (por e-mail ou a partir de um usuário), editar comissão/desconto, pausar, remover, registrar pagamentos e ligar/desligar a autoinscrição de Top Players
- Novo dashboard do afiliado com KPIs: comissão do mês (vs. mês anterior), saldo a receber, conversões, receita, ticket médio, indicados ativos/retenção, visitas, taxa de conversão, ranking, gráfico mensal e funil
- Link de indicação `/?ref=CODIGO` com contagem de visitas e aplicação automática do código no checkout
- Atribuição real de vendas: o código de indicação é aplicado no checkout (cupom Stripe) e a comissão é registrada pelo webhook de forma idempotente

### Security
- Escrita direta do cliente em `user_roles`, `user_bans`, `referral_codes` (exceto autoinscrição) e `referral_uses` revogada; ações passam por RPCs com hierarquia validada no banco
- Moderadores e administradores só moderam usuários comuns; somente o master modera a equipe
- E-mails de usuários visíveis apenas para o master (LGPD)
- `admin-notify` relê o estado no banco antes de bloquear contas ou enviar e-mails
- Busca de auditoria sanitizada antes de montar o filtro do PostgREST


## [1.1.0] - 2026-11-10

### Features
- Trilhas de estudo por concurso, começando pela Câmara Municipal de Cuiabá-MT 2026 (Selecon): módulos de nível médio e superior, seletor de cargo, quadro de pesos do edital, projeção de nota, foco do dia e conteúdo programático por matéria
- Banco inicial de 1.091 questões autorais (19 matérias, no mínimo 50 por matéria e por nível)
- Seleção inteligente de questões (inéditas primeiro, depois erros), modo "Revisar erros" e "Novas da semana"
- Geração automática diária de questões novas (3 por matéria por dia) com passe revisor e agendamento via pg_cron
- Painel admin para acompanhar e disparar a geração


## [1.0.0] - 2026-03-05

### Features
- Sistema de quizzes com validacao server-side
- Gamificacao completa: pontos, niveis, conquistas, ranking
- Desafios diarios e sistema de recompensas
- Mentor IA com Gemini 2.5 Flash (exclusivo Plus)
- Assinaturas Free/Plus via Stripe
- Portal de gerenciamento de assinatura
- Painel administrativo (usuarios, questoes, metricas, audit logs)
- Sistema de indicacoes/afiliados
- Formulario de contato com email via Resend
- Notificacoes in-app

### Security
- CORS restrito por variavel de ambiente em todas as Edge Functions
- Sanitizacao HTML (XSS) em todos os templates de email
- Rate limiting em todos os endpoints publicos e admin
- RPC functions atomicas para prevenir race conditions
- Validacao de action types em endpoints administrativos
- Stripe webhook signature verification
- Price ID whitelist para checkout

### Performance
- Code splitting com React.lazy em todas as rotas
- QueryClient otimizado com staleTime e gcTime
- Vendor splitting no build (react, supabase, radix-ui, recharts)
- Polling de subscription reduzido de 1min para 5min
- Queries paralelas em processRewards (Promise.all)
- Indices de banco otimizados

### Code Quality
- TypeScript strict mode habilitado
- ESLint no-unused-vars como warning
- React StrictMode habilitado
- Error Boundary para tratamento de erros
- Utilidades compartilhadas nas Edge Functions (_shared/)
- Versoes de dependencias normalizadas nas Edge Functions
