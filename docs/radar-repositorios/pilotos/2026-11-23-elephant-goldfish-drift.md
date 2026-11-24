# Piloto elephant-goldfish — divergências entre documentos e código (2026-11-23)

- **Ferramenta:** skill `egm-drift-report` do plugin `google/elephant-goldfish-model` no commit
  `94d948d` (Apache-2.0), carregada só nesta execução, numa cópia descartável do repositório no
  commit `0625fe3` (`ops/radar-repositorios/egm-drift.sh`). Piloto 22 do radar, aprovado pelo dono.
- **Alvo:** `docs/RADAR_CONCURSOS.md` e `docs/MERCADO_PAGO.md` contra o código.
- **Conferência:** o relatório é saída de modelo. Três dos achados mais graves foram conferidos no
  código e procedem:
  1. mudança de `vagas`, `salario_max`, `banca` e outros valores já conhecidos é publicada sem
     revisão (`supabase/functions/radar-concursos/evidence.ts`, laço de `consolidate`);
  2. `nome` e `esfera` de concurso novo entram sem portão nem Verificador
     (`supabase/functions/radar-concursos/pipeline.ts`, depois da verificação);
  3. a prévia do Mercado Pago devolve o preço cheio, sem o desconto de indicação
     (`supabase/functions/mp-create-checkout/index.ts`, ramo `preview`).
  Os demais não foram conferidos um a um: confira cada um antes de agir.
- **Resultado do piloto:** passou no critério (achados acionáveis que as revisões anteriores não
  trouxeram). Itens levados ao backlog em `AGENTS-COLLAB.md` (P1.8h–k).

---

## RADAR_CONCURSOS.md

- **Implantação, passo 1, cita uma migration só.** O documento diz que `supabase db push` aplica `20261117120000_radar_concursos.sql`. Falta `20261117120100_radar_policies_anon.sql`, que separa as políticas de leitura de `anon` e `authenticated`. Sem ela, a leitura anônima de áreas, concursos e atualizações falha com "permission denied for function has_role", porque `has_role` tem `EXECUTE` revogado de `anon`.
- **Implantação, passo 4, e `radarDb` estão desatualizados.** O documento diz que o front usa acesso sem tipos "até" `types.ts` ser regerado. O `src/integrations/supabase/types.ts` já tem `radar_concursos`, `radar_sources` e as outras tabelas do Radar. Mesmo assim, `src/hooks/useRadar.ts:12` e todo o `src/hooks/useAdminRadar.ts` continuam usando `radarDb` (cast para `SupabaseClient` sem tipos), e o comentário de `useRadar.ts:7-11` ainda descreve o estado anterior. A coluna `radar_sources.render_mode` (migration `20261123120000`) também não aparece em `types.ts`.
- **Variáveis de ambiente sem documentação.** O documento cita só `RADAR_MODEL`, `RADAR_VERIFIER_MODEL`, `RADAR_TRACK_MODEL` e `RADAR_MAX_*`. O código também lê:
  - `RADAR_RUN_BUDGET_MS`: prazo global da execução, padrão 140 000 ms, faixa de 60 000 a 380 000 ms (`index.ts:183`, `index.ts:408`). O cron chama a função com `timeout_milliseconds := 150000`, então um valor acima de 150 s ultrapassa o tempo de espera do `pg_net`.
  - `QUESTION_CRON_SECRET`: substitui o segredo do Vault (`index.ts:440`).
  - Os padrões e limites de `RADAR_MAX_SOURCES` (8, de 1 a 20), `RADAR_MAX_EXTRACTIONS` (8, de 1 a 30) e `RADAR_MAX_DETAIL_FETCHES` (4, de 0 a 10) também não estão documentados.
- **A ordem da coleta não está documentada.** O passo 1 descreve as fontes vencidas pelo intervalo e pelo recuo. O código ordena as fontes vencidas pela `priority` da área antes de cortar em `RADAR_MAX_SOURCES` (`index.ts:203-205`). O recuo tem teto de 7 dias: `check_interval_hours × 2^min(falhas, 4)`, limitado a 168 h (`pipeline.ts:116-124`).
- **Página sem texto: o critério e o efeito não estão documentados.** O documento diz só que a página é "sinalizada no painel". No código, ela é qualquer página não binária com menos de 200 caracteres de texto. Ela conta como erro na execução e incrementa `consecutive_failures`, o que aciona o recuo exponencial (`index.ts:235-239`, `index.ts:323-329`).
- **Fatos de concurso novo entram sem passar pelo portão nem pelo verificador.** O documento diz que cada valor tem trecho literal conferido em `evidence.ts` e pelo Verificador. Em `pipeline.ts:337-347`, quando falta a afirmação `nome`, o código cria uma. O valor vem de `extraction.nome` (sem checagem) ou do órgão, e a evidência é o trecho do Batedor. A `esfera` classificada pelo Batedor também é adicionada como afirmação. Nenhuma das duas passa por `checkClaims` nem pelo Verificador, e ambas entram no patch publicado.
- **Coordenador indisponível: a degradação não está documentada.** O documento só trata o verificador indisponível. Se o coordenador da área falha ou o tempo acaba, todos os candidatos seguem como `novo` com prioridade 1, e a correspondência com concursos conhecidos fica só no código (`pipeline.ts:237-242`). O resto do fluxo continua normalmente: o portão roda e a publicação pode ser automática.
- **Outras mudanças publicadas sem revisão humana.** O passo 7 lista o que publica sozinho: concurso novo verificado com fase confirmada, avanço de fase e data nova. Em `evidence.ts:350-376`, a mudança de um valor já conhecido de `vagas`, `salario_max`, `banca`, `cargos`, `escolaridade`, `municipio`, `uf`, `link_oficial` ou `nome` também é publicada e avisada sem revisão. Só as datas já conhecidas são tratadas como retificação.
- **"PDF oficial alterado → revisão humana" vale só em parte.** No código, a mudança de arquivo binário só gera uma atualização pendente se houver concurso com `source_id` igual ao da fonte (`index.ts:299-310`). Em fonte binária sem concurso ligado, a mudança é descartada sem registro. O resultado do `insert` em `radar_updates` não é conferido, e o snapshot da fonte avança mesmo se a gravação falhar. Isso contraria a regra de que o retrato só avança com tudo gravado.
- **A relevância não acompanha o número de seguidores.** O documento inclui "alunos que acompanham" na relevância (0–100) e na sugestão de trilha. A conta só é refeita para os concursos tocados numa execução do monitor (`index.ts:159-173`, `index.ts:312`). Seguir ou deixar de seguir um concurso não muda `relevance` nem `track_suggested` até ele receber outra atualização.
- **A lista de erros do piloto Firecrawl está incompleta.** O documento lista cinco mensagens. `fetchRendered` também produz "renderização: tempo esgotado", "renderização: falha de rede", "renderização: resposta inválida", "renderização falhou (HTTP <código>)" (erro da própria Firecrawl que não é 402 nem 429), "URL não permitida" e "redirecionamento não permitido" (`fetcher.ts:347-405`).
- **Filtro da página `/radar` sem documentação.** `src/pages/Radar.tsx` tem um filtro de concursos encerrados (`showClosed`) que a seção "O que o aluno vê" não cita.
- **As rotas exigem login.** `/radar` e `/radar/:slug` estão atrás de `RequireAuth` (`src/App.tsx:121-122`). Já a migration `20261117120100` dá leitura pública a `anon`. O documento não diz se o Radar é público ou só para alunos logados, e o código segue os dois caminhos.

## MERCADO_PAGO.md

- **O modelo `payment_orders` está incompleto e diferente da §5.1.**
  - Falta a coluna `access_kind`: o tipo de acesso sai de `product` mais `access_months` e `access_until_fixed`.
  - Existem colunas que a §5.1 não lista: `provider_status`, `provider_status_detail`, `refunded_cents`, `possible_duplicate` e `live_mode`. A última é adicionada pela migration `20261120130000`.
- **A assinatura de `apply_mp_payment` mudou.** A §5.1 documenta 9 parâmetros: `order_id, payment_id, status, status_detail, amount_cents, refunded_cents, method, installments, paid_at`. A versão em vigor (`20261120130000_mercadopago_hardening.sql:158-169`) tem 11, com `p_currency` e `p_live_mode` a mais. `create_payment_order` também ganhou `p_live_mode`.
- **A prévia não aplica o desconto de indicação.** As §5.2 e §10 dizem que a prévia devolve "o mesmo valor que será cobrado" e que a tela lê esse valor. Em `mp-create-checkout/index.ts:124-135`, a prévia devolve `amount_cents = listCents`, sem o desconto. O front também não envia `referralCode` na prévia (`useSubscription.ts:202-203`). Com código de indicação, `Upgrade.tsx:576` mostra o preço cheio, mas o Mercado Pago cobra o valor com desconto.
- **Renovação antecipada bloqueada.** A §1 diz que o aluno "renova quando quiser" e que a renovação antecipada soma 12 meses. O `mp-create-checkout` recusa o anual com 409 enquanto faltarem mais de 30 dias para o fim do acesso pago (`index.ts:77-81`, `RENEWAL_WINDOW_DAYS`). A mesma regra bloqueia o anual de quem tem um Passe do Mercado Pago que vai além de 30 dias. A §5.4 fala só do botão nos últimos 30 dias, sem dizer que fora dessa janela a compra é recusada.
- **A trava no `create-checkout` (Stripe) é mais fraca que a §5.2.** O documento diz que a função "recusa nova assinatura de quem tem anual pré-pago ativo". O código só recusa se `paid_until` estiver a mais de 30 dias (`create-checkout/index.ts:224-230`). Nos últimos 30 dias, o aluno pode assinar na Stripe com o anual pré-pago ainda ativo. A regra vale para qualquer acesso pago no Mercado Pago, inclusive o Passe, e a mensagem é outra ("A assinatura pode ser feita nos últimos 30 dias").
- **O webhook lê o corpo antes de conferir a assinatura.** O checklist da §6 pede o `x-signature` conferido "antes de ler o corpo", e a §5.2 pede "antes de qualquer coisa". Em `mp-webhook/index.ts:40-62`, o corpo é lido e interpretado como JSON antes de `verifyMpSignature`. Isso acontece porque o `data.id` assinado cai para o do corpo quando falta na query string. O limite de tamanho é aplicado antes, mas a ordem é diferente da documentada.
- **`referral_in_use` é mais amplo que o descrito.** A revisão de segurança fala em "mesmo código de indicação com desconto em dois pedidos abertos". `create_payment_order` (`20261120130000_mercadopago_hardening.sql:123-130`) recusa qualquer código se o aluno tiver qualquer pedido com indicação em `created`, `pending`, `paid`, `partially_refunded` ou `in_dispute`. Isso vale mesmo para um código diferente e para um pedido já pago.
- **Lembretes de vencimento não existem.** As §5.4 e §8 (PR 5) preveem e-mail transacional 15 e 3 dias antes do fim do anual pré-pago, com cron diário. Não há cron, função nem modelo de e-mail para isso em `supabase/`. A seção "Diferenças em relação ao plano" só registra a troca do `admin-metrics` por `admin_platform_overview` e não cita essa ausência.
- **"Configurações" não mudou.** A §5.4 põe em Configurações o status "Plus anual pago pelo Mercado Pago, válido até DD/MM/AAAA", o botão "Renovar por mais 12 meses" e o Pix pendente com link para retomar. `src/pages/Settings.tsx` não tem nada do Mercado Pago. Essas três coisas estão em `src/pages/Upgrade.tsx` (linhas 283-299 e 440-456). O aviso de pagamento em aberto só aparece para quem não tem Plus (`!isPremium`).
- **A volta do checkout tem outros valores e outros textos.**
  - A §5.4 manda consultar "a cada 5 s por até 2 min". O código consulta a cada 4 s, até 30 vezes (`Upgrade.tsx:153-166`).
  - O texto do Pix pendente é "Estamos esperando a confirmação do pagamento." em vez de "…do Pix. Costuma levar poucos segundos.".
  - Para pedido aprovado e depois estornado, existe um estado `reversed` (`src/lib/checkout.ts:42-62`) que a §5.4 não prevê.
- **A §7 aponta para outro arquivo de testes de banco.** A §7 manda estender `docs/proposta-plus/validate.mjs`. Os testes do Mercado Pago estão num arquivo separado, `supabase/tests/mercadopago.validate.mjs`, com `supabase/tests/pglite-supabase.mjs`. A tabela de estado já cita esse arquivo, mas a §7 não foi atualizada.
- **O roteiro de conciliação do Financeiro (§8, PR 5) não existe.** Nenhum documento ou script descreve a conciliação das vendas do Mercado Pago, apesar de a fase 4 depender dela ("Conciliação de todas as vendas do período sem divergência").
- **A preferência tem campos que a tabela da §3 não lista.** `buildPreference` (`_shared/mercadopago.ts:134-161`) também envia `binary_mode: false`, `expiration_date_from`, `date_of_expiration` e `items[].id`.
