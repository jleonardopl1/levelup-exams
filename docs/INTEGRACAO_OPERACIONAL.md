# Integração operacional do LevelUp Exams

A primeira entrega é acompanhar uma venda do Plus ou do Passe Concurso até o acesso do aluno e a comissão devida. A segunda é ajudar o aluno a decidir o que revisar hoje. A equipe acompanhará o uso da revisão, os simulados concluídos e a margem para o mesmo grupo de candidatos.

No primeiro dia, Produto e Pedagogia escolhem uma trilha com conteúdo revisado e alunos ativos. Engenharia e Financeiro identificam quem confere cobrança e acesso e abrem o registro privado de homologação. Para cada item, anotam ambiente, versão, data da conferência, resultado e responsável. Os prazos são estimativas a partir desse início e dependem dos critérios de aceite. Preço, comissão, ativação de fornecedor e publicação em produção têm decisões próprias.

## Quem responde pelo quê

| Insumo | Aplicação no LevelUp |
| --- | --- |
| Organograma EdTech | Comercial responde pelo canal. Marketing mede a aquisição, Sucesso do Cliente acompanha a renovação e Dados calcula o funil. Financeiro concilia as vendas. Produto escolhe a trilha com Pedagogia, que avalia as recomendações do Mentor. Engenharia responde pelo serviço e Pessoas organiza a capacidade da equipe. O fundador aprova condições comerciais e produção. Uma pessoa pode acumular funções. |
| Plano de agentes e monetização | Os dez responsáveis de área e os 69 especialistas são um catálogo proposto de atribuições. As primeiras tarefas são conferir divergências, preparar respostas de suporte e revisar conteúdo sob demanda. Cada tarefa tem responsável humano, identificador, ferramentas permitidas, limite de custo e critério de interrupção. Os 17 agentes de desenvolvimento já documentados atendem às mudanças no código. [Catálogo de desenvolvimento](../AGENTS.md) |
| Catálogo MCP e validações | Das 16 opções avaliadas, priorizar dois servidores próprios para leitura, LevelUp Aluno e LevelUp Conteúdo e Radar. Usar o Model Context Protocol (MCP) quando o teste no servidor demonstrar vantagem sobre a consulta direta. A conexão administrativa a fornecedores tem usuários e permissões próprios. |

## Sequência de entregas

### 1. Dias 1–7 · Conferir o ambiente e a oferta

Engenharia, com `edge-functions` e `supabase-db`, compara as versões do banco e das funções com as evidências do responsável pelo ambiente. Na base analisada (`9a2afbb`), o estado vivo registrava pendências de IA e Radar. Em paralelo, o PR #20 relata a implantação do Plus, o #22 relata a implantação de IA e um erro 402 no gateway à época, e o #24 relata a implantação do Radar. O #18 registrou pendências para ativar a cobrança. Confrontar esses relatos com o ambiente evita reaplicar migrations ou atribuir ao serviço atual um incidente passado. [Estado na base analisada](https://github.com/jleonardopl1/levelup-exams/blob/9a2afbbc2f3bb573a923a1ffc65a89bd2aa556ad/AGENTS-COLLAB.md#L87) · [PR #18](https://github.com/jleonardopl1/levelup-exams/pull/18) · [PR #20](https://github.com/jleonardopl1/levelup-exams/pull/20) · [PR #22](https://github.com/jleonardopl1/levelup-exams/pull/22) · [PR #24](https://github.com/jleonardopl1/levelup-exams/pull/24)

Financeiro e `pagamentos` conferem, em homologação, o preço e a periodicidade que o aluno vê, o recibo e o acesso resultante. Cobrir Plus mensal e anual e uma compra avulsa do Passe até a prova mais 15 dias. O Passe depende de preço avulso ativo e trilha elegível. A etapa termina com evidência de cada compra de teste, das diferenças encontradas e de quem vai resolvê-las. Confirmada a coleta de `ai_runs`, observar pelo menos sete dias e identificar custos estimados. [Planos](../src/config/plans.ts) · [Checkout](../supabase/functions/create-checkout/index.ts) · [Implantação do Plus](PLUS_IMPLANTACAO.md)

### 2. Dias 8–21 · Conciliar vendas, acessos e comissões

Financeiro conduz esta etapa após mapear a oferta. `pagamentos`, `supabase-db` e `tester` acompanham uma venda pelo webhook assinado até a confirmação, o acesso e o registro da indicação. Hoje a comissão incide na primeira cobrança. Reembolso e contestação exigem conferência manual. O painel lê uma página de até 100 registros por consulta à Stripe e soma o valor bruto das cobranças pagas com reembolso parcial. Percorrer todas as páginas, apurar o valor recebido e o devolvido e registrar ajustes de comissão vinculados à cobrança e à regra aplicada. Preservar o lançamento original. [Webhook](../supabase/functions/stripe-webhook/index.ts) · [Métricas do painel](../supabase/functions/admin-metrics/index.ts) · [Programa de afiliados](ADMIN_E_AFILIADOS.md)

Para aceitar a conciliação, testar em homologação confirmação tardia, eventos repetidos e fora de ordem, renovação, cancelamento, estorno integral e parcial e contestação após repasse. A reentrega mantém o mesmo prazo de acesso e o mesmo saldo de comissão. Após um estorno parcial, os totais de cobranças e devoluções devem explicar o saldo do período, inclusive com mais de 100 registros. Comparar com o extrato de teste considerando o mesmo período e as mesmas deduções. Diferença financeira abre uma pendência para conferência antes do repasse.

### 3. Dias 15–35 · Testar o Mentor de revisão

Produto e Pedagogia podem iniciar em paralelo à conciliação quando autenticação, cotas e telemetria estiverem verificadas. Para responder “O que devo revisar hoje e por quê?”, `engenheiro-ia`, `edge-functions` e `security-reviewer` comparam a leitura direta no servidor com as mesmas consultas pelo **LevelUp Aluno** via MCP. Começar pela fila de revisão e pelo resumo de desempenho. O Mentor já monta contexto no servidor e transmite a resposta em partes. A RPC `get_review_queue` identifica o aluno por `auth.uid()`. Chamá-la com um cliente que encaminhe o JWT da sessão validada. O cliente administrativo usado hoje pela Edge Function tem outro contexto de autorização. [Mentor](../supabase/functions/ai-mentor/index.ts) · [RPC da fila de revisão](../supabase/migrations/20261115120000_plus_features_v1.sql)

Para liberar o piloto, testar alunos distintos, simulado em andamento, cota esgotada e ferramenta indisponível. A resposta usa exclusivamente o progresso do próprio aluno e protege o gabarito até a entrega. Comparar as duas implementações com as mesmas perguntas quanto à utilidade pedagógica, ao custo por conversa e ao tempo de resposta no percentil 95. Distinguir o tempo até o início da resposta de sua duração total. O streaming atual registra o primeiro e deixa os tokens em branco. Identificar estimativas de custo e comparar revisões concluídas por aluno na coorte piloto. Validar no gateway real de homologação a chamada da ferramenta e a continuação da resposta. Se o piloto falhar, desligar o acesso à ferramenta e oferecer **Revisão de hoje**. Reabrir após corrigir a causa e repetir o caso que falhou.

Com as primeiras consultas aprovadas, acrescentar o histórico próprio e o **LevelUp Conteúdo e Radar**. Cada fato de edital vem de um registro publicado, com URL oficial, data e versão. O servidor valida o formato da resposta e trata o conteúdo da fonte como dado. Encaminhar retificações à curadoria e publicar novas trilhas pelo fluxo administrativo existente. [Radar de Concursos](RADAR_CONCURSOS.md)

### 4. Dias 36–60 · Testar um canal de parceiros

Depois da conciliação, Comercial e Marketing selecionam de 5 a 10 professores ou pequenos cursinhos. Usam os códigos e o painel atuais. Financeiro simula outra regra sobre cobranças conciliadas e mede o efeito na margem. As vendas sob contratos vigentes mantêm a regra de comissão da primeira cobrança. Uma eventual comissão recorrente exige regra versionada, aprovação comercial e adesão em contrato novo. Créditos por indicação de alunos e grandes parceiros ficam para uma avaliação posterior.

Para expandir o canal, fechar um ciclo em que o Financeiro consiga reproduzir cada comissão elegível, encaminhar as contestações e medir a margem. Comparar aquisição e retorno ao estudo com uma coorte de referência. Avaliar Pix avulso para o Passe conforme a conta. Pix Automático exige verificação separada de provedor, elegibilidade e autorização do pagador. [Pix na Stripe](https://docs.stripe.com/payments/pix)

### 5. Dias 61–90 · Validar uma oferta institucional

Comercial oferece um piloto assistido a 2–5 professores ou cursinhos. Produto e Sucesso do Cliente acompanham a ativação e o uso por turma. Antes de liberar um relatório, Engenharia verifica que o responsável por uma turma só vê a sua. O investimento em gestão institucional depende de um contrato pago, estudo recorrente, custo de atendimento medido e relatório útil confirmado pelo comprador. API comercial, marca branca e distribuição nas lojas dependem de uma avaliação posterior. [Roadmap](ARQUITETURA_MULTIAGENTE.md)

## Permissões e prestação de contas

| Quem usa | Acesso e decisão |
| --- | --- |
| Aluno no Mentor | O servidor identifica o usuário pela sessão e aplica as cotas e as regras de acesso do plano. Cada consulta retorna os campos necessários à tarefa. Credenciais administrativas permanecem no servidor. |
| Operação interna | Em A0, o responsável digital lê e compara dados autorizados. Em A1, prepara rascunhos para revisão. GitHub e Supabase começam em leitura restrita ao repositório ou projeto. Stripe apoia conferências do Financeiro. Resend apoia diagnóstico e rascunhos do Suporte. Avaliar analytics, agenda e Classroom quando o piloto demonstrar a necessidade. |
| Responsáveis humanos | Cobrança, acesso e comissão seguem regras em código. Financeiro concilia e o Admin Master registra o repasse autorizado. O dono aprova mudança de preço, contrato e implantação conforme a alçada existente. Uma rotina reversível só avança para A2 depois de testada, com limite de uso, registro de execução e forma de interrupção. |

No acompanhamento semanal, Dados apresenta **simulados concluídos por semana**, revisões concluídas e retorno ao estudo em 7 e 30 dias por coorte de entrada, oferta e trilha. A trilha da Câmara de Cuiabá registra prova em **20/12/2026**. Confirmar a data na fonte oficial para o teste curto e incluir outra prova mais distante para observar 60 dias. Medir o término programado do Passe separadamente do cancelamento do Plus. [Trilha de Cuiabá](../content/trilhas/camara-cuiaba-2026/track.json) · [Consultas de referência](proposta-plus/sql/metricas_validacao.sql)

Financeiro calcula a receita recorrente mensal normalizando o anual por 12. O Passe entra como venda avulsa e a cortesia fica fora da receita. Calcular a margem de contribuição por oferta e canal após reembolsos, taxas, tributos, comissões e custos variáveis de estudo, IA e atendimento, contando cada custo uma vez. Contratos, extratos, valores realizados e evidências identificáveis ficam no espaço privado dos responsáveis. O GitHub registra decisões, definições e resultados agregados apropriados para publicação.

Antes de usar dados de alunos no piloto, Produto e o responsável por privacidade definem finalidade, base legal, prazo de retenção e controles para menores. Registrar apenas metadados técnicos de IA. O afiliado acompanha os resultados comerciais das próprias indicações. No piloto institucional, relatórios de aprendizagem só incluem agregados da turma autorizada e suprimem recortes que identifiquem alunos em grupos pequenos. [Regras de privacidade](../rules/common/privacy.md) · [Telemetria de IA](../supabase/functions/_shared/ai/telemetry.ts)
