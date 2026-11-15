# Proposta: novas funcionalidades para assinantes Plus

Data: 15/11/2026 · Base: código em `main` (v1.5.0), 39 migrations, trilha Câmara de Cuiabá 2026 (prova em **20/12/2026**, inscrições até **30/11**).

Estrela-guia do produto: *candidatos passam nos concursos* · métrica: **simulados concluídos por semana**.

---

## 1. Resumo

1. **O Plus de hoje vende mais do que entrega.** De 8 benefícios anunciados, 4 não existem no código (PDF, estatísticas avançadas, "sem anúncios", "acesso prioritário") e 1 contradiz o servidor ("Mentor IA ilimitado" × limite de 6/dia). Corrigir isso é P0: é risco de consumidor (oferta vincula, CDC art. 30; publicidade enganosa, art. 37) e mina a confiança de quem paga.
2. **O que mais aproxima da aprovação é gratuito.** A trilha inteira, a projeção de nota e o "Foco de hoje" são Free, e nenhuma das 1.091 questões da trilha (nem as geradas por dia) é `is_premium`. Para quem estuda para Cuiabá, o Plus hoje é basicamente "mais de 30 questões por dia" + 6 perguntas ao Mentor.
3. **Proposta: o Plus passa a ser "treinar a prova de verdade"**: Simulado Oficial no formato do edital, posição entre os candidatos do cargo, correção da discursiva com a rubrica da banca, revisão espaçada dos erros e Mentor que conhece o aluno. O Free continua com a trilha (aquisição) e ganha 1 Simulado Oficial por mês (gancho de conversão).
4. **Validado tecnicamente:** as funcionalidades de banco (Simulado Oficial, posição, revisão espaçada, Passe Concurso) estão escritas em SQL e passam **45 verificações** num Postgres com todas as migrations reais + o seed da trilha (`docs/proposta-plus/`).
5. **Janela curta:** faltam 35 dias para a prova. O que não estiver no ar até ~06/12 perde a turma atual. E depois de 20/12 há um **penhasco de cancelamento** (o motivo para pagar acaba): o roadmap inclui pós-prova e retenção.

---

## 2. Diagnóstico do Plus atual

| Benefício anunciado | Onde é prometido | Existe? | Evidência no código |
|---|---|---|---|
| Questões ilimitadas | Upgrade, modais | ✅ | `FREE_DAILY_LIMIT = 30` em `useDailyUsage.ts` |
| Mentor IA (6/dia) | Upgrade | ✅ | `DAILY_LIMIT = 6` em `ai-mentor/index.ts` |
| "Mentor IA **ilimitado**" | `PremiumUpsellModal.tsx:39` | ❌ contradiz o servidor | cota de 6/dia |
| Questões premium exclusivas | Upgrade, modais | ⚠️ só fora das trilhas | seed da trilha e `generate-track-questions` gravam `is_premium = false` |
| Explicações em PDF | Upgrade, FAQ, `DailyLimitModal`, `PremiumBadge` | ❌ | nenhuma geração de PDF no app |
| Estatísticas avançadas | Upgrade, `PremiumUpsellModal` | ❌ | `Dashboard.tsx` é igual para Free e Plus |
| Sem anúncios | FAQ, `PremiumUpsellModal` | ❌ (não há anúncios) | benefício vazio |
| Acesso prioritário | Upgrade | ❌ | não definido em lugar nenhum |

O que já é forte e **não** deve ir para trás do paywall: trilha por cargo, quadro de pesos, projeção de nota e Foco de hoje — é o que traz o aluno e o faz voltar.

Lacunas técnicas que limitam as propostas:
- **Cargo do aluno não fica no servidor** (só em `localStorage`, `Trilha.tsx`). Ranking e plano por cargo precisam dele → o Simulado Oficial passa a gravá-lo.
- **Tempo por questão não é registrado** (só o tempo total do quiz em `quiz_results`). "Estatísticas avançadas" de ritmo exigem gravar `time_ms` em `validate_answer`.
- **O Mentor não recebe contexto**: o prompt de sistema é genérico; "Explicar com o Mentor" cola o enunciado na URL (`buildMentorPrompt`) e gasta 1 das 6 perguntas.
- **Banco de Específicas é raso para provas completas:** a prova tem 40 questões específicas e cada cargo tem 51–63 → **1,3 a 1,6 simulados inéditos por cargo** (medido no seed). A 3 questões/dia, chegam +105 por matéria até 20/12.

---

## 3. Propostas (em ordem de prioridade)

Legenda de esforço: P ≤ 2 dias · M 3–5 dias · G > 1 semana (1 dev full-stack).

### P0 — Alinhar a oferta ao que existe · esforço P · até 20/11
- Entregar **PDF do resultado do simulado e do caderno de erros** com `window.print()` + folha de estilo `@media print` em `Result.tsx` (sem dependência nova). É o benefício mais citado e o mais barato de cumprir.
- Remover "Sem anúncios" e "Acesso prioritário"; trocar "Mentor IA ilimitado" pelo limite real.
- Reescrever a lista de benefícios em um único lugar (`src/config/plans.ts`) usado por Upgrade, FAQ e os 3 modais — hoje são 5 listas divergentes.
- **Validação:** checklist de oferta = lista de funcionalidades com teste manual; nenhum benefício sem tela correspondente.

### 1. Simulado Oficial · esforço M · ✅ SQL validado
Prova completa no formato do edital: 70 questões (15 Básicos · 15 Gerais · 40 Específicos do cargo), distribuídas igualmente entre as matérias de cada área, cronômetro da prova, **sem gabarito durante a prova**, correção no servidor com pesos (1 / 1,75), regra de aprovação (≥ 40 e não zerar área) e revisão completa ao final.
- **Free:** 1 por mês (gancho). **Plus:** ilimitado.
- **Por que:** ataca direto a métrica estrela; é o que o candidato mais quer na reta final ("como eu iria hoje?"); não existe hoje (o simulado atual tem 10 questões e mostra o gabarito a cada resposta).
- **Banco:** `mock_exams`, `mock_exam_items`; RPCs `start_mock_exam`, `get_mock_exam`, `save_mock_answer`, `finish_mock_exam` (`docs/proposta-plus/sql/plus_features_v1.sql`). Prioriza questões inéditas, depois as erradas; ao finalizar grava em `user_question_attempts` (alimenta progresso da trilha e revisão espaçada). Salvar e finalizar usam o mesmo lock da linha do simulado.
- **Muda uma RPC em produção:** `validate_answer` passa a recusar questões de um simulado aberto do próprio aluno; sem isso, o gabarito vaza antes de finalizar (achado da revisão do PR). O corpo é o atual mais essa trava, e o teste confere isso.
- **Front:** nova rota `/trilhas/:slug/simulado` (navegação livre entre questões, marcação "revisar depois", salvamento a cada resposta, retomada se fechar a aba) e tela de resultado por área.
- **Pendências:** confirmar no edital a duração da prova e gravar `rules.duracao_minutos` (padrão provisório: 240); **subir `QUESTIONS_PER_SUBJECT_DAY` das matérias específicas para ~6 agora** por causa da profundidade do banco.
- **Validado:** 70 questões 15/15/40; Básicos 4/4/4/3; gabarito não sai antes do fim; outro aluno não lê nem responde; nota 85 = 15×1 + 40×1,75; reprova ao zerar área; finalizar é idempotente; Free bloqueado no 2º do mês; Plus ilimitado; início em ~17 ms.

### 2. Posição entre os candidatos do cargo · esforço P (depois do 1) · ✅ SQL validado
"Você ficaria em **12º de 340** candidatos de Técnico Legislativo · percentil 96 · 38% dos que fizeram o simulado estariam habilitados."
- Usa a melhor nota de cada aluno no mesmo módulo+cargo nos últimos 60 dias; **só aparece com ≥ 20 alunos** (sem expor ninguém e sem percentil sem significado).
- **Free:** vê se está acima/abaixo da média. **Plus:** posição, percentil e evolução.
- RPC `get_mock_exam_standing`. Validado com 27 candidatos sintéticos.

### 3. Correção da discursiva com a rubrica da banca · esforço M
A discursiva vale 100 pontos (80 conteúdo + 20 formal) e só é corrigida para quem fica até 20× o número de vagas — é decisiva e quase ninguém treina com correção. Hoje a trilha manda o aluno "pedir um tema ao Mentor", o que gasta a cota de 6 e devolve texto livre.
- Nova Edge Function `essay-review`: (a) sorteia/gera tema do cargo a partir do conteúdo programático; (b) recebe o texto, conta linhas (20–30) e (c) devolve **JSON estruturado**: nota por critério de conteúdo, desconto formal por tipo de erro com o trecho, pontos fortes, versão reescrita do parágrafo mais fraco. Mesmo padrão de "segundo passe revisor" que `generate-track-questions` já usa.
- Tabela `essay_submissions` (texto, tema, nota, rubrica JSON); histórico de evolução.
- **Plus:** 3 correções por semana, cota separada do Mentor. **Free:** vê um exemplo corrigido.
- **Validar antes de escalar:** 30 redações reais corrigidas pela IA e por 1 professor; meta de diferença média ≤ 10 pontos e mesma ordem (correlação) — se não bater, mostrar só feedback qualitativo, sem nota.

### 4. Revisão espaçada dos erros · esforço P/M · ✅ SQL validado
Cada erro entra numa fila que volta em 1, 3, 7, 14 e 30 dias (Leitner); acerto na data sobe de caixa, erro volta à caixa 1. **Perto da prova os intervalos encolhem** (no máximo metade dos dias restantes), para tudo ser revisto antes de 20/12.
- Evidência: prática distribuída e testes de recuperação são as duas técnicas de "alta utilidade" na revisão de Dunlosky et al. (2013, *Psychological Science in the Public Interest*); o efeito do espaçamento é consistente na meta-análise de Cepeda et al. (2006, *Psychological Bulletin*).
- Funciona por gatilho em `user_question_attempts` → vale para quiz, trilha e Simulado Oficial sem mudar o front deles.
- Card "Revisão de hoje: 14 questões" no início e na trilha. **Free:** 5 por dia. **Plus:** fila inteira.
- RPC `get_review_queue`. Validado: entrada no erro, promoção só quando vencida, compressão (caixa 3: 7d → 2d com prova em 4 dias), lapso volta à caixa 1.

### 5. Mentor IA que conhece o aluno · esforço P
- No `ai-mentor`, montar no servidor um bloco de contexto: trilha, cargo, dias até a prova, 3 matérias com pior acerto, últimos erros (só metadados), nota do último Simulado Oficial.
- "Explicar esta questão" passa a enviar `question_id`; o servidor busca enunciado, gabarito e explicação (o aluno não precisa colar nada e não dá para forjar). **Explicações de questão não consomem a cota de 6** (são curtas e com modelo barato).
- Revisar a cota depois de olhar a consulta H2: se muitos Plus batem 6/dia, subir para 15.

### 6. Passe Concurso (Plus até a prova, pagamento único) · esforço P/M · ✅ SQL validado
Para quem estuda para **uma** prova, assinatura mensal/anual é atrito ("vou ter que lembrar de cancelar"). Um passe único — ex.: "Plus até a prova de Cuiabá + 15 dias para conferir gabarito e recursos" — tende a converter melhor nessa fase. **Preço é hipótese a testar**, não recomendação.
- Reaproveita `premium_grants` (já usado pela "Liberar Plus" do painel): `grant_exam_pass` é chamado pelo `stripe-webhook` em `checkout.session.completed` com `mode = payment`; idempotente pela sessão do Stripe; não encurta uma liberação maior; atualiza `profiles.tier`.
- `create-checkout` ganha o plano `exam_pass` (preço em secret `STRIPE_PRICE_EXAM_PASS`, como os atuais). Comissão de afiliado: registrar igual à assinatura.
- Validado: concede até 04/01/2027 (prova + 15 dias, fuso de Cuiabá), recusa chamada de cliente, webhook repetido não duplica, perfil vira Plus.

### 7. Plano até a prova · esforço M
Evolução do "Foco de hoje" (que continua Free): o aluno informa horas por dia e dias da semana; o plano distribui matérias por peso × erro × cobertura, com revisão espaçada e um Simulado Oficial por semana; **última semana = só revisão + simulados**. Replaneja toda noite com o que foi feito. Lembrete pelo push/e-mail que já existem (`StreakReminderToggle`).

### 8. Pós-prova: "Confira sua nota" e recursos · esforço M · prazo fixo: no ar em 20/12
O gabarito preliminar sai em 21/12. Quem fez a prova procura "gabarito Câmara Cuiabá" nesse dia.
- **Free (aquisição):** o candidato digita as 70 respostas, recebe a nota ponderada e se estaria habilitado (mesma correção do Simulado Oficial).
- **Plus:** posição estimada entre os que conferiram, e **rascunho de recurso** por questão contestada (Mentor com o enunciado + fundamentação).
- Também é o principal antídoto para o cancelamento em massa depois da prova (ver seção 5).

### 9. Estatísticas avançadas de verdade · esforço M
Só depois de gravar tempo por questão: acerto por tópico (`questions.topico`) e por dificuldade, ritmo (segundos/questão × ritmo necessário na prova), evolução semanal, comparação com a média do mesmo cargo. Enquanto isso não existir, **o benefício sai da lista** (P0).

---

## 4. Free × Plus proposto

| | Free | Plus |
|---|---|---|
| Trilha, pesos, projeção, Foco de hoje | ✅ | ✅ |
| Questões por dia | 30 | ilimitadas |
| Simulado Oficial | 1 por mês | ilimitado |
| Posição entre candidatos | acima/abaixo da média | posição, percentil, evolução |
| Revisão espaçada | 5 por dia | fila inteira |
| Correção de discursiva | exemplo corrigido | 3 por semana, com rubrica |
| Mentor IA | — | contextual, 6 perguntas/dia + explicações de questão sem cota |
| PDF do resultado e caderno de erros | — | ✅ |
| Plano até a prova | Foco de hoje | plano semanal adaptativo |
| Confira sua nota (pós-prova) | nota e habilitação | posição + rascunho de recurso |

---

## 5. Roadmap até a prova

| Semana | Entrega | Por que nesta ordem |
|---|---|---|
| 16–22/11 | P0 (oferta + PDF) · subir geração das Específicas · Mentor contextual (5) | risco legal; banco precisa de tempo para crescer; baixo esforço |
| 23–29/11 | **Simulado Oficial (1)** + posição (2) | fecha antes do fim das inscrições (30/11), quando entra a maior leva |
| 30/11–06/12 | Revisão espaçada (4) · Passe Concurso (6) | revisão precisa de 2+ semanas para fazer efeito; passe pega os indecisos |
| 07–13/12 | Correção da discursiva (3) · modo "última semana" | após validar a rubrica com professor |
| 14–20/12 | Confira sua nota (8) pronto e testado | data fixa |
| Após 21/12 | Plano até a prova (7) · estatísticas (9) · próxima trilha | para o próximo concurso |

**Retenção pós-prova** (planejar já): oferecer **pausar a assinatura** em vez de cancelar (o Stripe tem pausa de cobrança na assinatura) e anunciar a próxima trilha antes de 20/12. Sem próxima trilha, o Plus perde o motivo de existir em 21/12.

---

## 6. Como validar (negócio)

Não tive acesso aos dados de produção (o projeto roda no Lovable Cloud; o conector Supabase desta sessão vê outro projeto). As consultas estão prontas em `docs/proposta-plus/sql/metricas_validacao.sql` e já rodam no schema atual:

| Hipótese | Consulta | Decisão que ela muda |
|---|---|---|
| Poucos Free batem o limite de 30/dia | H1 | se < 10%, o limite não converte → Simulado Oficial vira o principal gancho |
| A cota de 6 do Mentor trava os Plus | H2 | subir a cota ou separar as explicações |
| Métrica estrela por plano | H3 | linha de base para medir o Simulado Oficial |
| Engajamento real na trilha | H4 | dimensiona ranking (≥ 20 por cargo?) |
| Tamanho da fila de revisão | H5 | se a média for alta, o limite Free de 5/dia é um bom gancho |
| Pagantes × cortesias | H6 | receita real |
| Profundidade do banco | H7 | quantos simulados inéditos cabem por cargo |

Experimentos:
- **Simulado Oficial:** comparar simulados concluídos/semana e conversão Free→Plus nas 2 semanas antes e depois; sucesso = +30% na métrica estrela entre alunos de trilha. Guarda: taxa de abandono do simulado (meta < 40%).
- **Passe Concurso:** teste A/B na tela de planos (com e sem o passe); sucesso = conversão total maior sem queda de receita por visitante. Antes do código, dá para medir intenção com um botão "Quero o passe" que abre lista de espera (*fake door*).
- **Discursiva:** concordância IA × professor (seção 3.3) antes de mostrar nota.

---

## 7. Riscos

- **Banco raso para provas completas** → subir geração das Específicas já; o simulado repete erradas antes de repetir certas.
- **Custo de IA** (discursiva, Mentor): cotas por semana, modelo `flash` nas explicações, registrar tokens em `audit_logs.metadata`.
- **Ranking com poucos alunos** distorce → mínimo de 20 e janela de 60 dias.
- **Correção de discursiva errada** prejudica o aluno → validar com professor; mostrar como "estimativa".
- **Fuso:** o limite diário usa UTC (`useDailyUsage.ts`) e a geração usa Cuiabá; a proposta usa `America/Cuiaba`. Unificar.

---

## 8. Validação técnica (reproduzir)

```bash
npm i --no-save @electric-sql/pglite@0.5.16
node docs/proposta-plus/validate.mjs
```

O script sobe um Postgres em memória com stubs do Supabase (auth, vault, cron, net), aplica as 39 migrations atuais (incluindo as 1.091 questões da trilha), aplica `docs/proposta-plus/sql/plus_features_v1.sql` e roda 45 verificações. Resultado atual: **45/45 passaram**.

Limites do que foi validado: RLS foi checada pelas funções `SECURITY DEFINER` (dono = superusuário no teste), não com os papéis `authenticated` reais do Supabase; a corrida entre salvar e finalizar foi verificada pela presença do mesmo `FOR UPDATE` nas duas funções, porque o PGlite tem uma conexão só (o teste de concorrência real exige um Postgres com duas sessões); o front e as Edge Functions das propostas ainda não existem. O SQL não está em `supabase/migrations/` de propósito: só vira migration depois de aprovado.
