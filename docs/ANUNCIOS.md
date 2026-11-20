# Anúncios no plano Free · plano

Proposta para ter anúncios no Free com o menor desgaste possível para quem estuda. Responsável:
`pagamentos` (receita) com `designer` (experiência) e `security-reviewer` (privacidade e menores).
Decisão pendente com o dono: **D15** em `AGENTS-COLLAB.md`. Nada aqui foi implementado.

## Resumo

Recomendação: **começar por patrocínio próprio**, em um cartão por tela, nas pausas do estudo e
nunca dentro de questão, simulado ou revisão. O cartão é rotulado "Patrocinado", segue o
contexto do concurso e é servido pelo próprio LevelUp, sem rede de anúncios, sem cookie e sem
perfil do aluno. Quando não houver patrocinador, o espaço mostra o próprio Plus ou o Passe.

Rede de anúncios programática (Google AdSense e similares) **não** é recomendada agora, por três
motivos:

1. **Menores na base.** O ECA Digital proíbe perfilar crianças e adolescentes para publicidade, e
   a verificação de idade ainda não existe (D6). Uma rede de terceiros traz cookies e perfil de
   público que o LevelUp não controla.
2. **Promessas já publicadas.** A Política de Privacidade diz "não usamos cookies de publicidade"
   e que os dados não servem a publicidade de terceiros. Mudar isso pede banner de consentimento,
   nova versão da política e aviso prévio.
3. **Escala.** Produção tem 20 contas (20/11/2026). Rede paga por mil exibições; nessa base o
   valor do mês seria de centavos, e o custo em experiência seria real. Um patrocinador local,
   por um valor fixo por trilha (ex.: um cursinho para a Câmara de Cuiabá), rende mais com
   poucos alunos.

## Restrições

| Restrição | Efeito no desenho |
| --- | --- |
| Estrela-guia: simulados concluídos por semana | Anúncio nunca interrompe questão, simulado, revisão, discursiva ou Mentor. Se o indicador cair, o anúncio sai. |
| ECA Digital (Lei 15.211/2025) e LGPD (art. 14) | Sem perfil, sem cookie de terceiro, sem dado do aluno enviado ao anunciante. Segmentação só pelo contexto da tela (trilha, matéria). |
| CDC, art. 37, § 2º (publicidade abusiva) | Nada que explore a ansiedade da prova ("garanta sua vaga", contagem regressiva falsa). Revisão humana de cada peça. |
| Política de Privacidade atual | Patrocínio próprio cabe no texto atual; rede de terceiros exige reescrever a política antes. |
| `rules/common/privacy.md` | Sem design que explore vulnerabilidade: nada de pop-up, tela cheia, autoplay ou pressão. |

## Formatos avaliados

| Formato | Invasividade | Receita com a base atual | Risco | Decisão |
| --- | --- | --- | --- | --- |
| **Cartão patrocinado próprio** (contextual, nas pausas) | baixa | valor fixo por patrocinador | baixo | **Fase A** |
| Cartão "da casa" (Plus, Passe, trilhas) | baixa | conversão para pago | nenhum | **Fase A**, preenche o espaço vazio |
| Anúncio recompensado opcional ("assista e ganhe +10 questões") | baixa, o aluno escolhe | pequena | médio (rede de terceiros, idade) | **Fase B**, só para adulto com idade verificada |
| Banner de rede (AdSense) em páginas públicas | média | desprezível | médio (cookies, política) | Não agora |
| Banner fixo ou intersticial dentro do estudo | alta | pequena | alto | **Nunca** |
| Vídeo com som, pop-up, tela cheia, anúncio entre questões | muito alta | pequena | alto | **Nunca** |

## Fase A · patrocínio próprio

**Onde aparece (no máximo um cartão por tela, só no Free):**

- início (Dashboard), abaixo do bloco de estudo do dia;
- resultado do quiz e do Simulado Oficial, **depois** da nota e da revisão dos erros;
- lista de trilhas.

**Onde nunca aparece:** questão, Simulado Oficial em andamento, revisão espaçada, discursiva,
Mentor, Planos, login, telas legais e qualquer tela de erro.

**Regras do cartão:**

- rótulo "Patrocinado" visível, mesmo tamanho de texto do corpo; anunciante identificado;
- texto curto e imagem estática pequena; sem animação, som ou vídeo; respeita modo escuro e
  `prefers-reduced-motion`;
- botão "Ocultar por hoje" e link "Estude sem anúncios com o Plus";
- frequência: no máximo 3 exibições por aluno por dia (contadas no aparelho) e nunca o mesmo
  anunciante duas vezes seguidas;
- link abre em nova aba com `rel="sponsored noopener"`; nenhum parâmetro com dado do aluno.

**Quem pode anunciar:** cursinhos, editoras, livrarias, cursos de idiomas, materiais de estudo e
serviços públicos de interesse do candidato. **Não pode:** apostas, crédito e empréstimo, venda
de "gabarito", promessa de aprovação, produtos para adultos, política partidária e concorrentes
diretos no mesmo concurso. O conteúdo é aprovado pelo Comercial e pela Pedagogia antes de
entrar no ar.

**Medição sem perfil:** só contadores agregados por anúncio e por dia (exibições e cliques). Nada
por aluno; o anunciante recebe o relatório agregado.

## Fase B · condicional

Só depois da verificação de idade (D6) e com resultado positivo da fase A:

- **Anúncio recompensado opcional**, para adulto verificado: o aluno escolhe ver um anúncio curto
  em troca de, por exemplo, mais 10 questões no dia. Nunca automático, nunca para menor. Exige
  rede de terceiros, banner de consentimento e nova versão da política de privacidade.
- No app das lojas (D5), o mesmo formato pelo SDK de anúncios da plataforma, com as regras de
  cada loja para apps usados por menores.

## Como medir e quando parar

Experimento com metade dos alunos Free vendo o cartão por quatro semanas:

| Indicador | Regra |
| --- | --- |
| Simulados concluídos por semana por aluno Free | queda maior que 5% no grupo com anúncio: o anúncio sai |
| Retorno no D7 | queda maior que 5%: o anúncio sai |
| Conversão para Plus ou Passe | acompanhar (o cartão da casa pode aumentar) |
| Receita de patrocínio | valor fixo por contrato; o relatório agregado vai ao anunciante |
| Reclamações e ocultações | mais de 20% de "Ocultar por hoje": rever peça e posição |

## Implementação (depois da aprovação)

| Peça | O que faz |
| --- | --- |
| Tabela `sponsored_placements` | anunciante, texto, imagem, link, telas, trilhas/matérias alvo, período, ativo; RLS, só admin escreve |
| Tabela `sponsored_daily_stats` | contadores agregados por anúncio e dia (sem usuário) |
| RPC `get_sponsored_slot(surface, track_id)` | devolve um cartão só para quem é Free, respeitando período e contexto; sem anunciante, devolve o cartão da casa |
| RPC `record_sponsored_event(placement_id, kind)` | soma exibição ou clique no contador do dia, com limite por requisição |
| `src/components/SponsoredCard.tsx` | o cartão, com "Ocultar por hoje" e frequência no aparelho |
| Interruptor `ads_enabled` em `platform_settings` | liga e desliga sem publicar código |
| Painel admin | cadastro dos anúncios e relatório agregado |
| Testes | regras puras de frequência e de tela (`node --test`), RPC só para Free e sem usuário nos contadores (PGlite), verificação no navegador nas telas proibidas |
| Textos | FAQ ("por que vejo um anúncio?"), Termos e Privacidade, com aviso prévio |

Esforço estimado: um PR médio (banco, componente e painel) mais a revisão de segurança.

## Outras formas de aumentar a receita

Por ordem de retorno esperado com a base atual:

1. **Mercado Pago ligado** (Pix e anual parcelado): pronto em produção, falta a conta e a
   homologação ([Mercado Pago](MERCADO_PAGO.md)).
2. **Passe Concurso por trilha** com campanha junto aos professores
   ([crescimento](CRESCIMENTO_E_PAGAMENTOS.md)).
3. **Turmas para cursinhos e professores** (assentos por turma e relatório agregado): contrato
   fixo, sem anúncio.
4. **Patrocínio por trilha** (fase A acima).
5. **Pacote avulso de correções da discursiva**, quando houver procura medida.

## Decisões do dono (D15)

1. Aprovar a fase A (patrocínio próprio, sem rede de terceiros) ou adiar os anúncios.
2. Lista de categorias permitidas e proibidas (acima é a proposta).
3. Quem vende e aprova as peças (Comercial e Pedagogia).
4. Se a fase B entra no planejamento depois da verificação de idade (D6).
