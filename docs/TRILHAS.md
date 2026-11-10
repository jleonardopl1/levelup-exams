# Trilhas de estudo por concurso

A primeira trilha é a do **Concurso da Câmara Municipal de Cuiabá-MT (Edital nº 001/2026-CMC, Instituto Selecon)**, com prova objetiva e discursiva em **20/12/2026**.

## O que o aluno encontra (`/trilhas/camara-cuiaba-2026`)

- **Módulos Nível Médio e Nível Superior**, com seletor de cargo (Técnico Legislativo, Sonorização, Cerimonial, Analista Legislativo e especialidades, Contador e Controlador Interno). Cada cargo vê as matérias comuns e a específica dele.
- **Quadro da prova do edital** por área (Básicos, Gerais e Específicos), com quantidade de questões, peso (1 ou 1,75) e a regra de não zerar nenhuma área.
- **Projeção de nota** (0–100): aplica o acerto atual do aluno em cada área ao peso que ela tem no edital e compara com o mínimo de 40 pontos.
- **Foco de hoje**: as 3 matérias com maior retorno esperado (peso no edital × erros × pouca cobertura).
- Por matéria: **Praticar** (inéditas primeiro, depois as que errou), **Revisar erros** (só as questões cuja última resposta foi errada) e **Novas da semana**, além do conteúdo programático do edital e de como a banca cobra o tema.
- Regras de aprovação, discursiva, títulos, desempate e cronograma.

## Banco de questões

| Matéria | Questões |
|---|---|
| Língua Portuguesa | 54 |
| Raciocínio Lógico e Matemático | 67 (51 no médio; 16 de tabela-verdade, análise combinatória e probabilidade só no superior) |
| Noções de Informática | 61 |
| Legislação (LOM, Regimento Interno, LC 93/2003, LC 235/2011 com a LC 609/2026) | 98 |
| História e Geografia de Mato Grosso | 59 |
| Noções de Ética e Filosofia | 52 |
| Relações Interpessoais | 51 |
| Noções de Administração Pública (superior) | 51 |
| Técnico Legislativo — específica | 58 |
| Técnico Legislativo — Sonorização | 56 |
| Técnico Legislativo — Cerimonial | 53 |
| Analista Legislativo — específica | 54 |
| Analista — Tecnologia da Informação | 63 |
| Analista — Segurança do Trabalho | 53 |
| Analista — Psicólogo | 52 |
| Analista — Assistente Social | 51 |
| Analista — Jornalismo | 52 |
| Contador | 54 |
| Controlador Interno | 52 |
| **Total** | **1.091** |

Sobre a origem: as questões são **autorais, no padrão da Selecon** (4 alternativas, uma correta), escritas a partir do Anexo V do edital e dos temas que mais caem em provas anteriores, com explicação e fundamento legal. Não são cópias literais de provas anteriores. As questões de **legislação municipal** foram escritas a partir do texto compilado das normas (LOM, Regimento Interno, LC 93/2003 e LC 235/2011, atualizado até outubro/2026), e cada explicação cita o artigo.

O conteúdo fica versionado em `content/trilhas/camara-cuiaba-2026/` (um JSON por matéria). Para alterar ou acrescentar questões:

```bash
node scripts/build-track-seed.mjs camara-cuiaba-2026
```

O script valida tudo (4 alternativas distintas, gabarito, explicação, mínimo de 50 por matéria e por nível), embaralha as alternativas de forma determinística para equilibrar o gabarito e regera a migration `supabase/migrations/20261110130100_trilha_camara_cuiaba_2026.sql`. A migration é idempotente: pode ser reaplicada sem duplicar nada (`content_hash`).

## Questões novas toda semana

A Edge Function `generate-track-questions` publica **3 questões novas por matéria por dia** (21 por semana, acima do mínimo de 15). Para cada matéria ela:

1. monta o contexto: conteúdo do edital por nível, tópicos menos explorados, últimos enunciados (para não repetir) e uma base de fatos já verificados;
2. gera as questões no padrão da banca;
3. faz um **segundo passe revisor**, que reprova gabarito duvidoso, mais de uma resposta defensável ou dado inventado;
4. valida, embaralha, deduplica e grava com `origem = 'ia_diaria'`.

Na **Legislação municipal** (`ai_grounded_only = true`), a geração só pode usar os fatos já verificados das explicações autorais, o que impede artigos ou prazos inventados.

O agendamento (`pg_cron` + `pg_net`) roda a cada 10 minutos entre 01h e 04h50 (horário de Cuiabá), até 3 matérias por chamada, parando quando a meta do dia é atingida. O administrador acompanha e dispara manualmente em **Admin → Questões → Questões novas das trilhas**.

## Implantação (nesta ordem)

1. **Migrations**: `supabase db push` (aplica `20261110130000_study_tracks.sql`, a trilha e o agendamento).
2. **Segredos das Edge Functions** (Dashboard → Edge Functions → Secrets):
   - `QUESTION_CRON_SECRET`: valor aleatório com pelo menos 32 caracteres (ex.: `openssl rand -hex 32`);
   - `LOVABLE_API_KEY`: já usado pelo Mentor IA;
   - opcionais: `QUESTION_MODEL` (padrão `google/gemini-2.5-pro`), `QUESTION_REVIEW_MODEL`, `QUESTIONS_PER_SUBJECT_DAY` (padrão 3).
3. **Publicar a função**: `supabase functions deploy generate-track-questions`.
4. **Vault** (SQL Editor, uma vez), para o agendador saber o endereço e o segredo:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<o mesmo valor de QUESTION_CRON_SECRET>', 'question_cron_secret');
   ```
   Se `pg_cron`/`pg_net` não estiverem habilitados no projeto, habilite-os em Database → Extensions e reaplique `20261110130200_schedule_question_generation.sql`.
5. **Publicar o frontend**.

Para testar logo após o deploy: Admin → Questões → **Gerar agora**.

## Segurança

- `user_question_attempts` só é gravada pelo servidor, dentro de `validate_answer` (o cliente só lê as próprias tentativas). O gabarito continua inacessível ao cliente antes da resposta.
- `get_practice_questions` e `get_track_progress` são `SECURITY INVOKER`: o paywall (RLS de `questions`) e a RLS das tentativas continuam valendo.
- Trilhas, módulos e matérias são somente leitura para clientes; o log de geração é visível só para administradores.
- A função de geração aceita apenas o segredo do cron (comparação em tempo constante) ou um administrador autenticado.

## Nova trilha (outro concurso)

Crie `content/trilhas/<slug>/track.json` e os JSON de questões no mesmo formato, defina `migration_file` e rode o script. A geração diária passa a cobrir as matérias da nova trilha automaticamente.
