# Conteúdo e questões — regras de stack

## Item de múltipla escolha
- Exatamente 4 alternativas (padrão atual das trilhas) e **uma** correta.
- Enunciado contextualizado, dentro da ementa do edital, com legislação/entendimento **vigentes**.
- Distratores plausíveis e homogêneos em tamanho e estrutura; sem "todas/nenhuma das anteriores".
- Sem pistas: a correta não é sistematicamente a mais longa nem repete o enunciado.
- Explicação com fundamento (artigo, conceito, cálculo) e por que as outras estão erradas,
  **citando o conteúdo, nunca a letra** (alternativas são embaralhadas na publicação).
- Nunca inventar número de artigo, prazo, percentual ou nome.

## Origens
- `autoral`: escrita/revisada pela equipe (`content/trilhas/<slug>/questions/*.json` → `bun run build:trilhas`).
- `ia_diaria`: fábrica multiagente (`generate-track-questions`); só publica com revisor aprovando,
  solucionador cego concordando ou árbitro confirmando.
- Deduplicação por `content_hash` (mesmo algoritmo no seed e na geração).
- Legislação local: `ai_grounded_only = true` → só fatos verificados das questões autorais.

## Estilo das bancas (preencha ao abrir trilha nova)
| Banca | Formato | Observações |
| --- | --- | --- |
| Selecon | múltipla escolha, 4 alternativas | Câmara de Cuiabá 2026: 70 questões (15/15/40), discursiva 20–30 linhas |
| Cebraspe | certo/errado, uma errada anula uma certa | exige trilha própria: tipo de item e pontuação diferentes |
| FGV / FCC / Vunesp | múltipla escolha, 5 alternativas | ajustar validador para 5 alternativas antes de gerar |

## Qualidade em produção
Reporte do aluno → fila do admin → correção → aluno notificado; taxa de acerto anômala por item
(muito baixa = possível gabarito errado; muito alta = pista) entra na revisão do `curador-conteudo`.
