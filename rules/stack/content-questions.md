# Conteúdo e questões — regras de stack

## Item de múltipla escolha
- Exatamente 4 alternativas (padrão atual das trilhas) e **uma** correta.
- Enunciado contextualizado, dentro da ementa do edital, com legislação/entendimento **vigentes**.
- Distratores plausíveis e homogêneos em tamanho e estrutura; sem "todas/nenhuma das anteriores".
- Sem pistas: a correta não pode se destacar pela forma (tamanho, detalhe, ressalvas, termos do
  enunciado). Régua em código: [Pistas de forma](#pistas-de-forma-regra-em-código).
- Explicação com fundamento (artigo, conceito, cálculo) e por que as outras estão erradas,
  **citando o conteúdo, nunca a letra** (alternativas são embaralhadas na publicação).
- Nunca inventar número de artigo, prazo, percentual ou nome.

## Pistas de forma (regra em código)
Alunos acertavam "no automático" marcando a alternativa mais longa: em 2026-11-24 a correta era
a mais longa em 66% das questões autorais da Câmara de Cuiabá (acaso = 25%). A régua única está em
`supabase/functions/generate-track-questions/length-cue.ts` e vale para o seed, a auditoria
(`node scripts/audit-questions.mjs <trilha>`, também no `test:unit`) e a fábrica:

| Regra | Reprova quando |
| --- | --- |
| A — correta mais longa | é a mais longa **e** passa a maior errada em > 20% e ≥ 10 caracteres |
| B — correta acima da média | passa a média das erradas em > 50% e ≥ 25 caracteres |
| C — pista invertida | é a mais curta, < 75% da menor errada e ≥ 10 caracteres menor |
| Teto por matéria (n ≥ 20) | correta mais longa em > 35% das questões, ou mais curta em > 40% |

Calibragem: na Selecon real (Prefeitura de Cuiabá 2024, 79 questões) a alternativa mais longa,
correta ou não, passa a segunda em 11% (mediana) e 29% (p90).

Como corrigir sem estragar o item: **enxugue a correta** (a justificativa vai para a explicação,
não para a alternativa) e **dê às erradas o mesmo nível de detalhe** — qualificadores, condições,
prazos e órgãos, só que errados. Nunca alongue uma errada com palavras vazias.

## Distratores (o que separa a questão de banca da questão "de IA")
- Cada errada nasce de um **erro típico de quem estudou pela metade**: prazo, quórum, percentual
  ou competência trocados; órgão vizinho; conceito parecido de outro autor ou outra lei; exceção
  tratada como regra; causa e efeito invertidos; requisito a mais ou a menos.
- Nenhuma errada pode ser eliminável por bom senso: nada caricato ("o cidadão é o único
  responsável"), nada antiético óbvio, nada oposto à frase do enunciado, nada fora do assunto.
- A correta não pode ser a única "equilibrada", técnica, com ressalva ("desde que", "observado",
  "salvo") ou que repete palavras do enunciado. Se ela tem ressalva, as erradas também têm.
- Termos absolutos ("sempre", "exclusivamente") não podem aparecer só nas erradas.

## Estilo da Selecon (Câmara de Cuiabá 2026)
Observado nas provas da Prefeitura de Cuiabá 2024 (mesma banca):
- Enunciado contextualizado que termina em **dois-pontos**; as alternativas **completam a frase**,
  começam com minúscula e não têm ponto final ("…o diagnóstico exige sintomas antes dos:" →
  "12 anos de idade"). Pergunta direta só quando a resposta é um nome ou número.
- Alternativas **paralelas**: mesma classe gramatical, mesma estrutura ("a vinculação entre…",
  "a preservação de…"), mesmo nível de detalhe. Listas (princípios, valores, etapas) com o mesmo
  número de itens em todas as alternativas.
- Alternativas **numéricas em ordem crescente** (idades, prazos, valores, frações). A fábrica
  ordena sozinha; no autoral use `"fixa": true` com a ordem crescente.
- Comandos usuais: "é correto afirmar que:", "De acordo com…, …:", "A alternativa que apresenta…
  é:", "…assim designados:". Comando negativo em caixa alta ("INCORRETA", "EXCETO", "NÃO").
- Português formal; legislação local cobrada pela letra da lei (troca de prazo, quórum, competência).

## Origens
- `autoral`: escrita/revisada pela equipe (`content/trilhas/<slug>/questions/*.json` → `bun run build:trilhas`).
  O build recusa conteúdo com pista (mesma auditoria do `test:unit`).
- `ia_diaria`: fábrica multiagente (`generate-track-questions`); só publica com revisor aprovando,
  solucionador cego concordando ou árbitro confirmando, e passando pela régua de pistas.
- Deduplicação por `content_hash` (mesmo algoritmo no seed e na geração).
- Legislação local: `ai_grounded_only = true` → só fatos verificados das questões autorais.

## Revisar questão já publicada
- O banco guarda o **índice** marcado (`user_question_attempts.selected_index`,
  `mock_exam_items.selected_index`). Ao reescrever, **mantenha a posição**: a alternativa `k`
  nova é a reescrita da alternativa `k` antiga e o gabarito `c` não muda.
- Autoral: edite o JSON no lugar e grave em `"k"` os 16 primeiros caracteres do `content_hash`
  publicado (o seed passa a embaralhar por essa chave, então a ordem no banco não muda). A
  migration de revisão sai de `node scripts/build-question-revision.mjs`.
- `ia_diaria`: arquivo em `content/trilhas/<slug>/revisoes/<data>/ia_diaria/<materia>.json` com
  `id`, `hash` (o `content_hash` atual), texto novo na ordem do banco e `c` igual; questão
  irrecuperável (gabarito errado, lei revogada) vai para `inativar` com motivo.

## Estilo das bancas (preencha ao abrir trilha nova)
| Banca | Formato | Observações |
| --- | --- | --- |
| Selecon | múltipla escolha, 4 alternativas | Câmara de Cuiabá 2026: 70 questões (15/15/40), discursiva 20–30 linhas; estilo na seção acima |
| Cebraspe | certo/errado, uma errada anula uma certa | exige trilha própria: tipo de item e pontuação diferentes |
| FGV / FCC / Vunesp | múltipla escolha, 5 alternativas | ajustar validador para 5 alternativas antes de gerar |

## Qualidade em produção
Reporte do aluno → fila do admin → correção → aluno notificado; taxa de acerto anômala por item
(muito baixa = possível gabarito errado; muito alta = pista) entra na revisão do `curador-conteudo`.
