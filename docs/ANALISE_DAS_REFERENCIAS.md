# Análise e instalação das referências do LevelUp Exams

Este inventário registra o que a equipe conseguiu instalar e verificar em ambiente local. A unidade de avaliação é o repositório de origem. Cada ficha identifica o componente usado, a revisão inspecionada, os limites do teste e a decisão para o LevelUp.

| Resultado local | Repositórios |
| --- | ---: |
| Aplicativo ou CLI instalado | 6 |
| Componente instalado | 13 |
| Conteúdo local | 9 |
| Somente análise | 4 |

Os manifestos guardam as evidências e as receitas permitem repetir as instalações fora do aplicativo de estudo. Um teste de CLI, módulo ou material didático cobre apenas o componente indicado na ficha. A equipe deve conferir a licença de cada arquivo e as condições de serviços hospedados para a utilização pretendida. [Instruções de reprodução](../ops/referencias/README.md) · [Catálogo de origem](REFERENCIAS_REPOSITORIOS.md)

O anexo de MCP cita outros sete repositórios. As fichas adicionais tratam de pagamentos, desenvolvimento, observabilidade, pesquisa e ferramentas de data e leitura. [Operação](../ops/referencias/grupos/mcp-operacao.md) · [Dados e pesquisa](../ops/referencias/grupos/mcp-dados.md)

## Aprendizagem e material de estudo

### HKUDS/DeepTutor

O agendador diferencia memória, conceitos, procedimentos e design. Duas respostas certas na mesma sessão não estendem duas vezes a revisão. O cálculo de domínio pondera as cinco tentativas mais recentes e limita a confiança nas duas primeiras. O LevelUp já implementa parte dessa política em src/lib/mastery.ts.

**Componente instalado** · Agendador de revisão espaçada e cálculo de domínio por tópico.

**Instalação** · O pacote de aprendizagem do commit fixado foi disponibilizado por um arquivo .pth em um ambiente Python dedicado. O ambiente recebeu Pydantic 2.12.5 e pytest 8.4.2. O sistema completo de tutoria, o RAG e os modelos de linguagem ficaram fora da instalação.

**Verificação** · 43 testes oficiais do agendador passaram em CPU. Um teste adicional confirmou domínio de 0%, 50%, 80% e 100% após zero, um, dois e três acertos consecutivos.

**Aplicação no LevelUp** · Comparar em uma amostra de tentativas o agendador atual e o de estabilidade. Medir acerto na revisão após sete dias e revisões concluídas por aluno antes de alterar a agenda em produção.

**Licença** · Apache-2.0. **Arquivos consultados** · `README.md`, `LICENSE`, `deeptutor/learning/scheduler.py`, `deeptutor/learning/mastery.py`, `deeptutor/learning/models.py`, `deeptutor/learning/tests/test_scheduler.py`. [Revisão 4c1e000d8563](https://github.com/HKUDS/DeepTutor/tree/4c1e000d8563c5ac3b231baaaf149dc4dc4d2406)

### mattpocock/skills

teach estrutura objetivo, materiais e registros de aprendizagem. grill-me encaminha para grilling, uma entrevista para avaliar escolhas. O Mentor do LevelUp já oferece modo socrático. A entrevista intensa de revisão de decisões exige adaptação de tom antes de atender alunos.

**Componente instalado** · Habilidades teach, grill-me e grilling para ensino guiado e revisão de decisões.

**Instalação** · As três habilidades, seus arquivos auxiliares e a licença foram copiados para instalado/.agents/skills no laboratório. O perfil global e a configuração do aplicativo ficaram fora da instalação.

**Verificação** · Os nomes de ativação de três SKILL.md e as referências locais de formatos de ensino foram verificados no destino. Avaliação por um modelo e conversa com aluno ficam para o piloto.

**Aplicação no LevelUp** · Testar no Mentor uma dica progressiva e uma pergunta de recuperação após erro, usando questões autorizadas. Medir segundo acerto independente e abandono da conversa. Manter registros individuais sob os controles do produto.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `LICENSE`, `skills/productivity/teach/SKILL.md`, `skills/productivity/teach/LEARNING-RECORD-FORMAT.md`, `skills/productivity/grill-me/SKILL.md`, `skills/productivity/grilling/SKILL.md`. [Revisão 5863806dd4e1](https://github.com/mattpocock/skills/tree/5863806dd4e15c63174bee4e7515a4256792ecfa)

### debpalash/VoiceStudio

A CLI opera um backend separado. O pré-processador distingue pt-BR e pt-PT e prepara a leitura de números. O LevelUp já usa a Web Speech API em src/lib/speech.ts. A AGPL e os termos dos modelos precisam ser considerados em qualquer serviço modificado exposto a usuários.

**Componente instalado** · CLI oficial e normalizador de português usado antes da síntese de fala.

**Instalação** · A CLI oficial foi construída do diretório cli/ e instalada em um ambiente Python próprio. O normalizador e o catálogo de variantes foram disponibilizados nesse ambiente com num2words 0.5.14. O aplicativo desktop, o servidor de inferência e os pesos ficaram fora do teste.

**Verificação** · A CLI 0.5.9b6 carregou a ajuda local. Os 28 casos em português das duas tabelas oficiais de normalização verificaram a saída e a idempotência, incluindo horários, preços, decimais e preservação de códigos. O teste verificou texto, sem gerar áudio.

**Aplicação no LevelUp** · Usar o laboratório para avaliar a leitura de valores, datas e referências de leis em português. Publicar áudios autorais em uma amostra de questões só depois de medir inteligibilidade e conclusão em dispositivos móveis.

**Licença** · AGPL-3.0-only para o software. Os pesos e os recursos de terceiros têm condições próprias. **Arquivos consultados** · `README.md`, `LICENSE`, `LICENSE-NOTICE.md`, `cli/pyproject.toml`, `cli/hatch_build.py`, `cli/voicestudio_cli/__main__.py`, `backend/services/text_normalization.py`, `backend/core/language_variants.py`, `tests/test_text_normalization.py`. [Revisão 11becfa75d9d](https://github.com/debpalash/VoiceStudio/tree/11becfa75d9d641aa0954aefc1a305ab76704b92)

### nilbuild/developer-roadmap

O modelo usa roadmapSlug, nodeId e recursos tipados. O fluxo de sincronização pressupõe um banco externo. A LevelUp pode estruturar material próprio por edital e acompanhar teoria e revisão com o recurso já existente.

**Somente análise** · Modelo de organização de tópicos, recursos e progresso.

**Instalação** · O checkout do laboratório serviu para inspeção. A receita registra apenas o link do commit em referencia.url. A licença restringe o material a uso pessoal e permite compartilhar links.

**Verificação** · A licença, o README, o modelo de tópicos e os documentos de sincronização foram lidos no commit indicado. A receita verificou o registro do endereço. Nenhum serviço de sincronização foi acionado.

**Aplicação no LevelUp** · Vincular o site oficial como leitura externa quando houver aderência. Para as páginas públicas por concurso, escrever a sequência de estudo com base no edital oficial e em questões próprias.

**Licença** · Licença própria. Uso pessoal. Compartilhamento de links permitido. **Arquivos consultados** · `readme.md`, `license`, `scripts/readme.md`, `scripts/lib/official-roadmap-topic.ts`. [Revisão 16ea08c3b308](https://github.com/nilbuild/developer-roadmap/tree/16ea08c3b308bb3e60881acad04071232489c2b2)

### jwasham/coding-interview-university

O roteiro combina planejamento por assunto com recursos para praticar algoritmos e estruturas de dados. O objetivo original é a entrevista de programação. A seleção editorial precisa relacionar cada assunto ao edital brasileiro.

**Conteúdo local** · Plano de estudo e checklist em português para disciplinas de informática.

**Instalação** · O README, a tradução brasileira, a bibliografia de programação e a licença estão disponíveis para consulta local no checkout fixado.

**Verificação** · A tradução abriu em UTF-8. A verificação encontrou 719 linhas com caixas de seleção. O arquivo de materiais por linguagem também está presente.

**Aplicação no LevelUp** · Experimentar uma checklist autoral de sete dias para um concurso de TI. Na página aberta, vincular o material de origem e oferecer um simulado diagnóstico. Acompanhar cadastro e primeiro simulado concluído.

**Licença** · CC-BY-SA-4.0 para a compilação. Fontes externas têm termos próprios. **Arquivos consultados** · `README.md`, `LICENSE.txt`, `translations/README-ptbr.md`, `programming-language-resources.md`. [Revisão 2399df2f688b](https://github.com/jwasham/coding-interview-university/tree/2399df2f688ba9fafe11c399cc067d7270921bb1)

### donnemartin/system-design-primer

Os baralhos exemplificam como transformar um conceito ou exercício em cartão. O material tem foco em arquitetura de software e entrevistas. A exportação de revisão para outras disciplinas exige adaptação editorial e controle do que o aluno pode ver.

**Conteúdo local** · Três baralhos Anki para estudo do formato e revisão espaçada.

**Instalação** · O guia, a licença e três arquivos .apkg do autor estão disponíveis para consulta local. Os pacotes foram abertos como arquivos ZIP e os bancos internos foram lidos em memória.

**Verificação** · As tabelas cards foram consultadas por SQLite. System Design contém 42 cartões, System Design Exercises contém 8 e OO Design contém 6, totalizando 56.

**Aplicação no LevelUp** · Prototipar a exportação de flashcards autorais para o caderno de erros após a correção. Testar abertura no Anki e o retorno à plataforma na semana seguinte.

**Licença** · CC-BY-4.0 para o material do repositório. **Arquivos consultados** · `README.md`, `LICENSE.txt`, `resources/flash_cards/System Design.apkg`, `resources/flash_cards/System Design Exercises.apkg`, `resources/flash_cards/OO Design.apkg`. [Revisão ae9bbd7b02d9](https://github.com/donnemartin/system-design-primer/tree/ae9bbd7b02d90b9866215de185217d33f39ab733)

### freeCodeCamp/freeCodeCamp

A montagem escolhe uma resposta correta e até quatro distratores ativos. A fórmula de aprovação usa percentual com uma casa decimal. O LevelUp já corrige respostas no servidor e atende bancas com números e formatos diferentes de alternativas.

**Componente instalado** · Módulo TypeScript de montagem, embaralhamento e correção de exames.

**Instalação** · O utilitário oficial exam.ts e seu embaralhador foram compilados com esbuild 0.25.12 em um bundle CommonJS de Node. A licença foi copiada ao lado do bundle. A instalação do cliente, banco e currículo do monorepo ficou fora deste ensaio.

**Verificação** · Em uma prova sintética, o módulo excluiu a questão e a alternativa descontinuadas, retornou cinco alternativas sem marcador de gabarito, atribuiu 100% ao acerto e 0% ao erro e rejeitou um ID de questão inexistente.

**Aplicação no LevelUp** · Reaproveitar os casos de teste para simulados com alternativas desativadas, insuficientes ou formatos por banca. Preservar a correção no servidor. Produzir enunciados próprios para os diagnósticos públicos.

**Licença** · BSD-3-Clause para o software. O currículo em /curriculum tem copyright separado do freeCodeCamp. **Arquivos consultados** · `README.md`, `LICENSE.md`, `api/src/utils/exam.ts`, `api/src/utils/exam.test.ts`, `packages/shared/src/utils/shuffle-array.ts`. [Revisão a996e0d9eaef](https://github.com/freeCodeCamp/freeCodeCamp/tree/a996e0d9eaef1bde5636d67a88ea65123f661ca5)

### practical-tutorials/project-based-learning

O catálogo organiza exercícios práticos por linguagem e separa a validação de estrutura da verificação de links. O modelo atende trilhas técnicas e cursos parceiros. A maioria das disciplinas de concurso exige outro tipo de atividade.

**Conteúdo local** · Índice por linguagem de programação e linter de contribuições.

**Instalação** · O catálogo, as instruções de contribuição, a licença e o validador foram instalados para leitura local. O comando lint do repositório foi executado sobre o catálogo.

**Verificação** · O linter contou 457 entradas, 458 URLs e 23 seções. Reportou zero erros, zero avisos e 52 registros informativos de HTTP. A disponibilidade atual das URLs externas não foi verificada.

**Aplicação no LevelUp** · Pilotar um desafio autoral de lógica para o público de TI, com rubrica curta e encaminhamento a um simulado relacionado. Vincular tutoriais externos depois de conferir atualidade e direitos.

**Licença** · MIT para o índice. Cada tutorial externo mantém a licença do autor. **Arquivos consultados** · `README.md`, `LICENSE.md`, `CONTRIBUTING.md`, `scripts/check_readme.py`, `scripts/lint-allow-duplicates.txt`. [Revisão f99ea242247b](https://github.com/practical-tutorials/project-based-learning/tree/f99ea242247b9b6df9bd277f832fa5a8f1da28e1)

### codecrafters-io/build-your-own-x

A organização por artefato como banco de dados, CLI e servidor ajuda o editor a selecionar desafios por habilidade. A ausência de licença explícita impede presumir permissão para republicar o catálogo comercialmente.

**Conteúdo local** · Consulta local de categorias de projetos construídos do zero.

**Instalação** · O README e o formulário de contribuição foram obtidos no checkout do laboratório para consulta técnica. A receita mantém o conteúdo no diretório de fontes. Os projetos externos ficaram fora da instalação.

**Verificação** · A leitura local identificou 30 cabeçalhos de categorias de tutoriais. O modelo de contribuição especifica título, linguagem, URL e categoria. A árvore do commit foi conferida quanto à presença de licença.

**Aplicação no LevelUp** · Oferecer links diretos para materiais selecionados e publicar desafios, descrições e rubricas próprios. Priorizar apenas temas previstos no edital de TI escolhido.

**Licença** · Sem licença explícita no commit consultado. Tutoriais externos seguem os termos de cada autor. **Arquivos consultados** · `README.md`, `ISSUE_TEMPLATE.md`. [Revisão ebae1430d28d](https://github.com/codecrafters-io/build-your-own-x/tree/ebae1430d28d52dbe12e189ffc7507e08d8c62ca)

### EbookFoundation/free-programming-books

A taxonomia já atende áreas de TI em português, como bancos de dados, Git e lógica. Gratuidade de leitura e licença para redistribuição são propriedades independentes de cada obra.

**Conteúdo local** · Índices brasileiros de livros e cursos, com orientações de curadoria.

**Instalação** · Os dois índices em português, o guia de contribuição, a apresentação e a licença foram instalados para leitura local. Os livros e vídeos permanecem nos sites dos autores.

**Verificação** · A verificação contou 180 entradas com links HTTP(S) em livros e 318 em cursos nas listas brasileiras. Os catálogos foram lidos localmente. A disponibilidade e a atualização de cada obra dependem do site de origem.

**Aplicação no LevelUp** · Publicar uma página por edital de TI com cinco leituras externas conferidas, relevância explicada e uma questão autoral para começar. Acompanhar acesso orgânico, cadastro e primeiro simulado concluído.

**Licença** · CC-BY-4.0 para a compilação. Cada curso e livro tem termos próprios. **Arquivos consultados** · `README.md`, `LICENSE`, `books/free-programming-books-pt_BR.md`, `courses/free-courses-pt_BR.md`, `docs/HOWTO-pt_BR.md`. [Revisão 10e33dd516cc](https://github.com/EbookFoundation/free-programming-books/tree/10e33dd516cc53864e6bece7e6bd51f2a035d06c)

## IA, conteúdo e automação

### heygen-com/hyperframes

O CLI interpreta composições HTML e dispõe de um linter estático. Uma mesma peça de questão comentada pode ser reaproveitada por banca ou professor. O lint verifica a composição, não a qualidade da campanha.

**Aplicativo ou CLI instalado** · HyperFrames CLI 0.9.65.

**Instalação** · Distribuição oficial hyperframes@0.9.65 instalada com npm local. CLI de terminal, sem aplicativo gráfico ou serviço HeyGen.

**Verificação** · hyperframes --version informou 0.9.65. O linter aprovou a composição HTML de teste e identificou a ausência de data-composition-id na amostra inválida.

**Aplicação no LevelUp** · Testar uma peça de divulgação com questão autoral e chamada para o simulado. Medir ativações atribuídas ao vídeo e rever o texto com Pedagogia.

**Licença** · Apache-2.0. **Arquivos consultados** · `README.md`, `packages/cli/package.json`, `packages/lint/package.json`. [Revisão ebddc42486ec](https://github.com/heygen-com/hyperframes/tree/ebddc42486ec251e773770f7743ffe59ad2004cd)

### ag-ui-protocol/ag-ui

RUN_STARTED, TEXT_MESSAGE_CONTENT e RUN_FINISHED permitem acompanhar uma resposta em partes. O SDK do protocolo não fornece o gateway de modelos nem a autorização do aluno.

**Componente instalado** · SDK TypeScript @ag-ui/core 1.0.5.

**Instalação** · Núcleo do protocolo AG-UI instalado no Node, com o peer Zod fixado localmente.

**Verificação** · Importados PROTOCOL_VERSION e os tipos de eventos usados no ciclo da conversa, conferindo início, fragmento e fim.

**Aplicação no LevelUp** · Comparar o fluxo de eventos com o streaming já usado pelo Mentor, mantendo compatibilidade no cliente antes de publicar o novo formato.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `sdks/typescript/packages/core/package.json`, `sdks/typescript/packages/core/README.md`. [Revisão 3416b86da4b3](https://github.com/ag-ui-protocol/ag-ui/tree/3416b86da4b3288e87f827c7f2759a7fa18b5231)

### openclaw/openclaw

A aplicação oferece um gateway de canais e agentes. O módulo permite usar retentativa e cancelamento nas tarefas locais de aquisição. Um piloto de mensagens exigiria conta, consentimento e supervisão do atendimento. O SHA do catálogo identifica o código analisado. O CLI semântico veio do lançamento npm e mostra o identificador próprio e13cf15.

**Aplicativo ou CLI instalado** · OpenClaw CLI 2026.11.5 e módulo @openclaw/retry.

**Instalação** · Distribuição npm oficial em cli/, acompanhada do módulo de retentativas no commit analisado. Na edição Linux x64 foram instalados os dois complementos nativos do fornecedor. Onboarding, canais e gateway ficaram inativos.

**Verificação** · O executável oficial informou OpenClaw 2026.11.5 (e13cf15). O módulo do commit analisado passou nos casos de atraso e cancelamento em memória.

**Aplicação no LevelUp** · Reaproveitar a política em tarefas editoriais reversíveis. Uma confirmação de pagamento com estado desconhecido exige consulta ao provedor antes de repetir.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `packages/retry/package.json`, `packages/retry/src/index.ts`, `packages/retry/src/index.test.ts`, `package.json`, `openclaw.mjs`. [Revisão a2c1b0e86ff9](https://github.com/openclaw/openclaw/tree/a2c1b0e86ff94643d22636445c695b6469bc4b82)

### blader/humanizer

O perfil revisa ritmo, fórmulas repetitivas e afirmações vagas. Suas recomendações em inglês precisam de interpretação em português e revisão de fatos.

**Componente instalado** · Perfil humanizer.

**Instalação** · Instalação manual do SKILL.md canônico no diretório .agents/skills/humanizer do laboratório.

**Verificação** · Perfil descoberto no caminho do agente, com nome e descrição no frontmatter e conteúdo editorial no corpo.

**Aplicação no LevelUp** · Usar nos textos de aquisição e explicações de questões junto às regras brasileiras existentes. Não alterar gabarito, fatos ou benefícios aprovados.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `SKILL.md`, `LICENSE`. [Revisão b48c832f0f80](https://github.com/blader/humanizer/tree/b48c832f0f809c1b5658edbb838c2521b72f2413)

### Nutlope/hallmark

O sloplint verifica padrões mecânicos no HTML, com regras por gênero e etapa da página. Revisão pedagógica e acessibilidade por teclado continuam a exigir testes do fluxo.

**Componente instalado** · Hallmark e sloplint estático.

**Instalação** · Perfil, referências de design e verificador estático upstream instalados localmente.

**Verificação** · Nome do perfil conferido e sloplint executado em HTML local com saída JSON.

**Aplicação no LevelUp** · Rodar a avaliação estática da futura página de amostra por concurso. Conferir posteriormente leitura em tela pequena e navegação por teclado.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `skills/hallmark/SKILL.md`, `skills/hallmark/scripts/sloplint.mjs`, `skills/hallmark/references/gates.md`. [Revisão 04977e15f3df](https://github.com/Nutlope/hallmark/tree/04977e15f3dfd6ee4b74c887dac3eb52665d6c92)

### pbakaus/impeccable

O detector percorre o código ou uma página renderizada e devolve ocorrências por regra. A análise estática cobre padrões de conteúdo e de CSS, não o comportamento real da jornada do estudante.

**Aplicativo ou CLI instalado** · Impeccable CLI 4.9.2.

**Instalação** · Pacote oficial e binário compatível com a plataforma instalados localmente, sem hooks globais.

**Verificação** · Executados --version e detect contra uma página HTML local; validada a saída estruturada.

**Aplicação no LevelUp** · Usar o detector no cadastro, checkout e página da trilha. Priorizar os problemas que prejudiquem o primeiro simulado no celular.

**Licença** · Apache-2.0. **Arquivos consultados** · `README.md`, `cli/bin/cli.js`, `package.json`. [Revisão d41d9860b009](https://github.com/pbakaus/impeccable/tree/d41d9860b0094dcb68030657da63461212835aaa)

### nateherkai/scroll-craft

O kit orienta a composição mobile, a progressão da página e o movimento reduzido. Animação longa na entrada do quiz pode aumentar o abandono e o tráfego móvel.

**Componente instalado** · Perfil scroll-craft e motor local de apresentação.

**Instalação** · Instalados skill, motor CSS/JS e referências da experiência. As ferramentas opcionais de serviços externos ficam fora do perfil instalado.

**Verificação** · Nome e descrição do perfil conferidos; verificada a sintaxe do motor JavaScript e a presença da folha de estilo.

**Aplicação no LevelUp** · Reservar para um experimento de página promocional. Comparar início de simulado e tempo de carregamento com uma página estática.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `plugins/nateherk-design/skills/scroll-craft/SKILL.md`, `plugins/nateherk-design/skills/scroll-craft/engine/scrollcraft.js`. [Revisão 75d81f74e836](https://github.com/nateherkai/scroll-craft/tree/75d81f74e83692add18cd7a8a8e078b8a887a579)

### anthropics/knowledge-work-plugins

A triagem classifica prioridade e encaminha o caso. O rascunho organiza a resposta e a validação de dados procura inconsistências. A classificação do modelo precisa de revisão quando envolve pagamento ou dados de aluno.

**Componente instalado** · Suporte e Dados: ticket-triage, draft-response, validate-data.

**Instalação** · Três skills de texto oficiais instaladas em .agents/skills no laboratório. Sem instalar as conexões administrativas dos plugins.

**Verificação** · Descoberta local confirmou as três identidades e descrições a partir dos manifests SKILL.md.

**Aplicação no LevelUp** · Usar em A1 para preparar tickets e explicar divergências agregadas. Financeiro e atendimento decidem repasses, reembolsos e envio da resposta.

**Licença** · Apache-2.0. **Arquivos consultados** · `README.md`, `customer-support/skills/ticket-triage/SKILL.md`, `customer-support/skills/draft-response/SKILL.md`, `data/skills/validate-data/SKILL.md`. [Revisão e91a134584eb](https://github.com/anthropics/knowledge-work-plugins/tree/e91a134584eb798bac7fb0379358006a2b63b965)

### deepseek-ai/deepseek-harness

Timeouts têm causa explícita, sinal de cancelamento e limpeza do temporizador. O fornecedor classifica o harness completo como prévia sem auditoria de segurança.

**Componente instalado** · @deepseek-ai/dsh-timeout do código-fonte.

**Instalação** · Módulo upstream de prazos e cancelamento instalado isoladamente. Sem host de agentes, plugins, shell ou acesso a modelos.

**Verificação** · Importada a biblioteca e observada a expiração de um prazo com motivo verificável.

**Aplicação no LevelUp** · Usar o padrão para interromper uma ferramenta lenta do Mentor e apresentar a fila de revisão existente quando o prazo terminar.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `SAFETY.md`, `packages/util/timeout/src/index.ts`, `packages/util/timeout/tests/timeout.spec.ts`. [Revisão ca33fd6843b2](https://github.com/deepseek-ai/deepseek-harness/tree/ca33fd6843b205e279c7ccb6cb73a472c78f5760)

### n8n-io/n8n

A biblioteca valida a forma dos fluxos de trabalho. Persistência, filas, retentativas e execução são funções distintas do serviço. A licença limita usos comerciais, sobretudo hospedar a ferramenta para terceiros.

**Aplicativo ou CLI instalado** · n8n CLI 2.49.0 e n8n-workflow 2.49.0.

**Instalação** · Distribuição npm oficial em cli/ e biblioteca de fluxos instalada no laboratório. A instalação omitiu scripts de ciclo de vida e pacotes opcionais. Cron, webhooks, banco e servidor ficaram inativos.

**Verificação** · n8n --version informou 2.49.0. safeParseWorkflowStructure aceitou uma lista de nós e rejeitou um campo nodes numérico.

**Aplicação no LevelUp** · Avaliar alertas internos de falha de geração e de conciliação. Pagamento e concessão de direitos permanecem no serviço determinístico; revisar licença antes de embutir ou revender.

**Licença** · Sustainable Use License 1.0; recursos EE sob licença separada. **Arquivos consultados** · `README.md`, `LICENSE.md`, `packages/workflow/package.json`, `packages/workflow/src/workflow.ts`, `packages/cli/package.json`. [Revisão 7b7b4e0a1f53](https://github.com/n8n-io/n8n/tree/7b7b4e0a1f53e5281bff207af64f4eeb4e77f0e4)

## Engenharia, governança e catálogos

### affaan-m/ECC

tdd-workflow parte de critérios de aceite e preserva a separação entre plano e instruções. api-design orienta contratos, paginação e erros. As habilidades podem ser usadas sem o pacote de hooks do projeto.

**Componente instalado** · Perfil local de TDD e desenho de APIs.

**Instalação** · Perfil .claude/skills com tdd-workflow e api-design, acompanhado da licença. Cada arquivo foi obtido na revisão fixada.

**Verificação** · Perfil descobre tdd-workflow pelo nome e descrição. Perfil descobre api-design pelo nome e descrição.

**Aplicação no LevelUp** · Aplicar o roteiro de testes ao webhook e à paginação de cobranças e revisar os contratos do segundo provedor com a engenharia. A meta de cobertura do upstream é indicativa; o projeto mede os cenários financeiros críticos.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `skills/tdd-workflow/SKILL.md`, `skills/api-design/SKILL.md`, `LICENSE`. [Revisão 3f14a103a869](https://github.com/affaan-m/ECC/tree/3f14a103a8694e51c1df9a806217a6d0b5f7a6f7)

### cloudflare/security-audit-skill

O projeto organiza classificação, revisão independente e registro de evidências por achado. O LevelUp já atribui a verificação das mudanças ao security-reviewer. As etapas operacionais externas excedem a necessidade desta integração.

**Somente análise** · Referência metodológica; sem instalação operacional.

**Instalação** · Avaliado apenas pelo escopo e pelos metadados públicos. Sem cópia, instalação ou conexão.

**Verificação** · Identidade, revisão e licença do projeto confirmadas no GitHub. Nenhum fluxo do projeto executado.

**Aplicação no LevelUp** · Manter o revisor defensivo local para examinar autorização do aluno, isolamento de turmas e logs do Mentor por revisão de código.

Metadados públicos · MIT. Revisão `c1c8a8c14710`.

### elementalsouls/Claude-BugHunter

Conjunto concebido para bug bounty e red team. O componente relevante para a governança é exigir evidência e separar falso positivo de defeito confirmado. O produto educacional já possui verificações de regressão e revisão independente.

**Somente análise** · Análise de finalidade, sem instalação.

**Instalação** · Avaliado apenas pelo escopo e pelos metadados públicos. Sem cópia, instalação ou conexão.

**Verificação** · Identidade, revisão e licença do projeto confirmadas no GitHub. Nenhum fluxo do projeto executado.

**Aplicação no LevelUp** · Usar security-reviewer e tester com fixtures sintéticas para verificar autorização e deduplicação no próprio código.

Metadados públicos · MIT. Revisão `5d91c812ee25`.

### obra/superpowers

O ciclo falha/correção/refatoração exige demonstrar uma regressão previamente e verificar o resultado final. O material auxiliar de qualidade de testes acompanha a habilidade e pode ser descoberto no próprio diretório.

**Componente instalado** · TDD e evidência de conclusão.

**Instalação** · Perfil .claude/skills com test-driven-development, o material auxiliar writing-good-tests.md, verification-before-completion e a licença.

**Verificação** · Perfil descobre test-driven-development pelo nome e descrição. Perfil descobre verification-before-completion pelo nome e descrição.

**Aplicação no LevelUp** · Usar como roteiro para estorno parcial, liquidação tardia do Pix e devolução ao aluno da fila de revisão; preservar o portão de CI existente.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `skills/test-driven-development/SKILL.md`, `skills/test-driven-development/writing-good-tests.md`, `skills/verification-before-completion/SKILL.md`, `LICENSE`. [Revisão 22f0b463e7a5](https://github.com/obra/superpowers/tree/22f0b463e7a5e579904dd6211a520321035526f7)

### backnotprop/plannotator

O revisor permite percorrer um plano e reunir observações antes da implementação; o lançador de fonte usa Bun. A release distribui um executável independente. Compartilhamento e agentes conectados são recursos opcionais.

**Aplicativo ou CLI instalado** · CLI local de anotação de planos Markdown.

**Instalação** · Executável independente Linux x86-64 de v0.28.67 em bin/plannotator. SHA-256 do arquivo compactado, do executável e das duas licenças conferidos.

**Verificação** · plannotator 0.28.67 Guia e diff sintéticos exportados em HTML com viewer local.

**Aplicação no LevelUp** · Usar no planejamento local do segundo provedor e do piloto do Mentor com material sintético; contratos e dados de pagamento ficam no ambiente autorizado.

**Licença** · MIT OR Apache-2.0. **Arquivos consultados** · `README.md`, `apps/hook/README.md`, `apps/hook/server/annotate-command.ts`, `package.json`, `LICENSE-APACHE`, `LICENSE-MIT`. [Revisão 969084882013](https://github.com/backnotprop/plannotator/tree/969084882013ac7634283ebca06f3118e766d30d)

### vercel-labs/agent-browser

O executável controla Chromium e expõe uma representação da árvore acessível. O frontend de npm também usa o binário nativo da plataforma. A fixture local permite medir se o aluno encontra a chamada para iniciar um simulado sem usar dados de conta.

**Aplicativo ou CLI instalado** · CLI Linux do navegador para testes com páginas locais.

**Instalação** · Executável independente Linux x86-64 v0.43.0 em bin/agent-browser com sua licença. SHA-256 do binário conferido.

**Verificação** · O CLI informou agent-browser 0.43.0. Chromium do sistema, em contêiner descartável com sessão temporária e acesso limitado a 127.0.0.1, abriu a página sintética e identificou o botão “Iniciar simulado” na árvore acessível. O Chromium deste contêiner precisou do isolamento externo porque seu helper SUID pertence a nobody. Para repetir em máquina com sandbox do Chromium funcional, acrescente --chromium /usr/bin/chromium.

**Aplicação no LevelUp** · Ensaiar em homologação a navegação da página pública, o cadastro, a continuidade do simulado e o retorno após checkout com usuários de teste.

**Licença** · Apache-2.0. **Arquivos consultados** · `README.md`, `package.json`, `bin/agent-browser.js`, `cli/src/native/snapshot.rs`, `LICENSE`. [Revisão 1cc19526f364](https://github.com/vercel-labs/agent-browser/tree/1cc19526f3641c8543d55aa6700e7c55b37ac356)

### morluto/rea

O escopo declarado vai do comportamento de aplicativos a binários nativos. A exploração de um binário de terceiros não é uma dependência do checkout nem da aprendizagem do LevelUp.

**Somente análise** · Análise de finalidade, sem instalação.

**Instalação** · Avaliado apenas pelo escopo e pelos metadados públicos. Sem cópia, instalação ou conexão.

**Verificação** · Identidade, revisão e licença do projeto confirmadas no GitHub. Nenhum fluxo do projeto executado.

**Aplicação no LevelUp** · Revisar os fluxos próprios pelo código-fonte, pelas instruções públicas dos provedores e por testes de contrato em homologação.

Metadados públicos · MIT. Revisão `9bd17e8673de`.

### AgriciDaniel/claude-seo

schema_generate.py gera objetos de perfil, discussão e pedido com a biblioteca padrão do Python. As referências de schema distinguem marcação válida de elegibilidade a recursos de busca. O perfil instalado pode ser usado sem extensões externas ou credenciais.

**Componente instalado** · Gerador local de JSON-LD, templates e referências de schema.

**Instalação** · Gerador de JSON-LD, coleção de templates, notas sobre tipos depreciados e licença materializados em perfil local, com SHA-256 fixado.

**Verificação** · Gerador executado com perfil fictício; ProfilePage, mainEntity.name e coleção de templates validados.

**Aplicação no LevelUp** · Revisar títulos, descrições e dados estruturados da página pública de concurso; validar os fatos e as URLs antes de publicar e medir visitas que resultam em estudo.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `scripts/schema_generate.py`, `schema/templates.json`, `skills/seo-schema/references/deprecated-types-2024-2026.md`, `LICENSE`. [Revisão 468ed5b0d9e3](https://github.com/AgriciDaniel/claude-seo/tree/468ed5b0d9e3249394783710e54abb02837e326b)

### public-apis/public-apis

O catálogo registra documentação, autenticação e cobertura por API. O IBGE é um candidato para normalizar municípios. A presença na lista não valida disponibilidade, licença de reuso ou edital de um concurso.

**Conteúdo local** · Índice seletivo de serviços públicos.

**Instalação** · Extraída a seção Geocoding em SECAO.md com atribuição, revisão, link permanente e licença do catálogo.

**Verificação** · Texto original e recorte conferidos por SHA-256. A seção usa o título Geocoding e contém a entrada IBGE.

**Aplicação no LevelUp** · Consultar diretamente o órgão responsável e registrar URL e data no Radar antes de exibir dados ao aluno.

**Licença** · MIT. **Arquivos consultados** · `README.md`, `LICENSE`. [Revisão d6dab92da95c](https://github.com/public-apis/public-apis/tree/d6dab92da95c003e82e5b32c623bd2ad9d6a017f)

### awesome-selfhosted/awesome-selfhosted

A lista diferencia plataformas avaliativas, catálogos e sistemas completos de gestão de aprendizagem, com links, licenças e linguagem dos projetos. O documento selecionado serve para comparar requisitos e custos do piloto institucional.

**Conteúdo local** · Seção sobre plataformas de aprendizagem.

**Instalação** · Extraída a seção Learning and Courses em SECAO.md com atribuição, revisão, link permanente e licença do catálogo.

**Verificação** · Texto original e recorte conferidos por SHA-256. A seção usa o título Learning and Courses e contém a entrada Moodle.

**Aplicação no LevelUp** · Usar para entrevistar professores sobre gestão de turmas e interoperabilidade. Antes de reutilizar software citado, revisar sua própria licença.

**Licença** · CC-BY-SA-3.0. **Arquivos consultados** · `README.md`, `LICENSE`. [Revisão 2a8926e0ac50](https://github.com/awesome-selfhosted/awesome-selfhosted/tree/2a8926e0ac5014de75c00472319cdd6cb6a1f95d)

### sindresorhus/awesome

O índice encaminha a listas temáticas mantidas por comunidades independentes. A seção Learn é uma fonte de padrões de curadoria e categorização, com conteúdo muito mais amplo do que um edital brasileiro.

**Conteúdo local** · Seção Learn da coleção de listas.

**Instalação** · Extraída a seção Learn em SECAO.md com atribuição, revisão, link permanente e licença do catálogo.

**Verificação** · Texto original e recorte conferidos por SHA-256. A seção usa o título Learn e contém a entrada Educational Games.

**Aplicação no LevelUp** · Reutilizar o formato de seleção e revisão por especialista. Publicar itens de estudo somente após a curadoria pedagógica específica.

**Licença** · CC0-1.0. **Arquivos consultados** · `readme.md`, `license`. [Revisão bc98e517ddca](https://github.com/sindresorhus/awesome/tree/bc98e517ddca672f55f9857d714fc3ea3c3540b2)

### vinta/awesome-python

A coleção destaca bibliotecas de testes e ferramentas associadas ao pytest. Sua licença cobre o índice; cada pacote listado tem versão e licença próprias. O LevelUp usa TypeScript e Deno para o produto.

**Conteúdo local** · Seção de bibliotecas Python para testes.

**Instalação** · Extraída a seção Testing em SECAO.md com atribuição, revisão, link permanente e licença do catálogo.

**Verificação** · Texto original e recorte conferidos por SHA-256. A seção usa o título Testing e contém a entrada pytest.

**Aplicação no LevelUp** · Consultar apenas em experimentos auxiliares em Python, como simulação pedagógica offline; conferir resultados com as mesmas fixtures usadas no produto.

**Licença** · CC-BY-4.0. **Arquivos consultados** · `README.md`, `LICENSE`. [Revisão 4c3cb15dc695](https://github.com/vinta/awesome-python/tree/4c3cb15dc695e95ae64add86b9994add8277f323)
