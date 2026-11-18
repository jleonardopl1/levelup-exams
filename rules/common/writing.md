# Escrita para o aluno — sem "cara de IA"

Vale para textos do app (botões, avisos, e-mails, FAQ), respostas do Mentor e da correção da
discursiva, explicações de questões e posts. Base: os 26 padrões do **blader/humanizer**
(construídos sobre o guia "Signs of AI writing" da Wikipédia), adaptados ao português do Brasil.
O objetivo é o leitor entender rápido e confiar; não é "passar em detector de IA".

## Os cinco que mais aparecem (corrija sempre)
1. **"Não é só X, é Y"** — diga a ideia direto. ~~"Não é só um simulado, é uma experiência"~~ →
   "O simulado tem o formato e o tempo da prova da Selecon."
2. **Fecho de efeito** — corte frases que só repetem o parágrafo. ~~"E isso faz toda a diferença."~~
3. **Frase que soa profunda** — ~~"No fim das contas, o que importa é a constância."~~ → o fato
   específico ("Quem revisa os erros toda semana acerta mais no simulado.") ou nada.
4. **Aquecimento antes do ponto** — ~~"Vamos lá!"~~, ~~"Sinceramente?"~~, ~~"Bora mergulhar"~~.
5. **Discutir com ninguém** — ~~"Não estamos dizendo que X, mas..."~~ quando ninguém disse X.

## Ritmo e formato
- Liste só o que é lista; não force trios ("rápido, prático e eficiente").
- Sem negrito decorativo, emoji em título ou título que repete a primeira frase.
- Frases curtas, voz ativa, sujeito claro ("Você erra crase em 4 de 10 questões").
- Uma ideia por parágrafo; corte qualificadores empilhados ("pode eventualmente talvez").

## Inflação e autoridade emprestada
- Nada de "crucial", "revolucionário", "jornada", "potencialize", "desbloqueie" sem fato por trás.
- Não cite "especialistas dizem" sem nome e fonte; em conteúdo jurídico, cite o artigo da norma
  (e só se tiver certeza — regra do Elaborador e do Mentor).
- Prefira "é" e "tem" a "se configura como" e "conta com".

## Restos de chat
- Sem "Ótima pergunta!", "Espero ter ajudado!", "Como IA, eu...".
- Sem aviso genérico de limite de conhecimento: diga o que não sabe e onde conferir.

## Para o aluno do LevelUp
- Curto e acolhedor (CLAUDE.md): quem estuda tem pouco tempo e muita ansiedade.
- Número concreto vence adjetivo: "faltam 34 dias" > "a prova está chegando".
- Respostas da IA saem em **texto simples**: o app não renderiza Markdown, então `**` e `#`
  aparecem crus (`supabase/functions/ai-mentor/prompt.ts`).

## Como aplicar
Revise o texto final com a skill `humanizer` (instalada no Claude Code) ou pela lista acima.
Ela edita para leitor humano; não use para disfarçar conteúdo gerado como se fosse humano.
