-- GERADO por scripts/build-track-seed.mjs a partir de content/trilhas/camara-cuiaba-2026/diarias/2026-11-11.json. NAO EDITE A MAO.
-- Lote diario de 2026-11-11: 50 questoes autorais. Idempotente (content_hash).

INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Um projeto de lei aprovado pela Câmara Municipal de Cuiabá foi enviado ao Prefeito, que deixou passar o prazo de 15 dias úteis sem sancioná-lo nem vetá-lo. Segundo a Lei Orgânica do Município, nesse caso:', ARRAY['o projeto volta à Câmara para nova votação em dois turnos', 'o projeto é considerado vetado integralmente', 'o silêncio importa sanção tácita', 'o Presidente da Câmara deve vetar o projeto em nome do Prefeito']::text[], 2, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Médio', 'Art. 29, §§ 1º e 2º, da LOM: o Prefeito tem 15 dias úteis para sancionar ou vetar, e o silêncio importa sanção tácita. Se vetar, deve comunicar os motivos ao Presidente da Câmara em 48 horas.', s.id, false, 'Lei Orgânica - Sanção e veto', 'autoral', NULL, 'e9efc9bae24de0d289551391b1b86a71ca1b44546d53588033ae22ecaa88eb08'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Um Vereador de Cuiabá deixou de comparecer, em cada sessão legislativa, à terça parte das sessões ordinárias, sem licença ou missão autorizada. Conforme a Lei Orgânica, a perda do mandato nesse caso é:', ARRAY['decretada pelo Prefeito Municipal', 'decidida pela Comissão de Ética, sem participação da Mesa', 'decidida pelo Plenário, por voto nominal de dois terços', 'declarada pela Mesa da Câmara']::text[], 3, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Médio', 'Art. 20, IV e § 3º, da LOM: na falta a um terço das sessões ordinárias, a perda é apenas declarada pela Mesa. A deliberação do Plenário por 2/3, em votação nominal, vale para outros incisos (I, II, III e VIII — § 2º).', s.id, false, 'Lei Orgânica - Perda do mandato', 'autoral', NULL, '4568da53b1eeb3d5f31c572c920ef8362be0713cef6b24409f436a4634bca24d'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Na Tribuna Livre prevista no Regimento Interno da Câmara Municipal de Cuiabá, o tempo total reservado é dividido entre dois oradores. Quanto tempo cabe a cada um?', ARRAY['20 minutos', '15 minutos', '10 minutos', '5 minutos']::text[], 2, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Fácil', 'Art. 119 do Regimento Interno: a Tribuna Livre começa às 10h, nas terças e quintas-feiras, com 20 minutos divididos entre dois oradores — 10 minutos para cada um.', s.id, false, 'Regimento Interno - Tribuna Livre', 'autoral', NULL, '25d1708316c0c98c68731fccc88123b421195fd9af37e2e7b3421c0e2d8da07e'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Um servidor regido pela LC nº 93/2003 cometeu infração punível com suspensão. Considerando o Estatuto, a ação disciplinar prescreve em:', ARRAY['2 anos, contados da data em que o fato se tornou conhecido', '5 anos, contados da data do fato', '180 dias, contados da abertura da sindicância', '6 meses, contados da data em que o fato se tornou conhecido']::text[], 0, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Médio', 'Art. 156 da LC 93/2003: 5 anos para demissão e cassação, 2 anos para suspensão e 6 meses para advertência, contados da data em que o fato se tornou conhecido. A abertura de sindicância ou PAD interrompe a prescrição.', s.id, false, 'LC 93/2003 - Prescrição', 'autoral', NULL, '0b6eaa1278637d12e3746ec48c3305aceea90a37c059745bd32ab89adcb5cc34'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Concluído o processo administrativo disciplinar regido pela LC nº 93/2003, a autoridade julgadora deve proferir sua decisão no prazo de:', ARRAY['30 dias, improrrogáveis', '120 dias, improrrogáveis', '60 dias, prorrogáveis por igual período', '90 dias, prorrogáveis por igual período']::text[], 2, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Difícil', 'Art. 175 da LC 93/2003: julgamento em 60 dias, prorrogáveis por igual período. Não confunda com o prazo de conclusão do PAD, que é de 90 dias, prorrogável por igual prazo (art. 171).', s.id, false, 'LC 93/2003 - PAD', 'autoral', NULL, '4d45cda1a3cd5a35126d3ecf593a4c7ee0964b13affab3f88f4e9e0e1b6f89d0'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela LC nº 235/2011 (Plano de Cargos da Câmara de Cuiabá), o servidor alcança a Classe D, na promoção horizontal, ao comprovar:', ARRAY['pós-graduação lato sensu de, no mínimo, 360 horas', '10 anos de efetivo exercício, independentemente de titulação', 'ensino superior completo', '120 horas de cursos de capacitação']::text[], 0, 'Legislação Municipal (LOM, Regimento, LC 93/2003 e LC 235/2011)', 'Médio', 'Art. 11 da LC 235/2011: Classe B — 120 horas de cursos ou outro curso médio/técnico; Classe C — ensino superior completo; Classe D — pós-graduação lato sensu de 360 horas. A mudança de classe gera acréscimo de 20% (art. 14).', s.id, false, 'LC 235/2011 - Promoção horizontal', 'autoral', NULL, '175ad375e56b52fbca80d5f19981183a4efd0de59a6766064c0fb1b9e4caff85'
FROM public.subjects s WHERE s.slug = 'cmc26-legislacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Assinale a alternativa que completa corretamente as lacunas: "Refiro-me ___ servidoras que chegaram ___ Câmara ___ pouco tempo."', ARRAY['às / à / há', 'às / a / a', 'as / a / à', 'as / à / há']::text[], 0, 'Língua Portuguesa', 'Médio', '"Referir-se a" + "as servidoras" = às; "chegar a" + "a Câmara" = à; "há pouco tempo" indica tempo decorrido (verbo haver), equivalente a "faz pouco tempo".', s.id, false, 'Crase', 'autoral', NULL, '9d4b665e7815262e1a8cf8a12009e1d20b44738707de336c2467c7ae68af00c9'
FROM public.subjects s WHERE s.slug = 'cmc26-lingua-portuguesa'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Está de acordo com a norma-padrão quanto à concordância verbal:', ARRAY['Devem haver vagas para todos os cargos.', 'Fazem dois anos que a Câmara não realiza concurso.', 'Faz dois anos que a Câmara não realiza concurso.', 'Houveram muitas inscrições no primeiro dia.']::text[], 2, 'Língua Portuguesa', 'Fácil', '"Fazer" indicando tempo decorrido e "haver" no sentido de existir são impessoais: ficam na 3ª pessoa do singular, e o auxiliar acompanha ("Deve haver vagas").', s.id, false, 'Concordância verbal', 'autoral', NULL, '08beaa1f8fd1bf86bb0a6b92fed64dc5141a93428e8e19a38ecf94cf2888d685'
FROM public.subjects s WHERE s.slug = 'cmc26-lingua-portuguesa'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Assinale a frase escrita de acordo com a regência verbal da norma-padrão:', ARRAY['Prefiro mais estudar do que trabalhar.', 'Aspiro o cargo de analista legislativo.', 'Os candidatos obedeceram o edital.', 'O vereador assistiu à sessão inteira.']::text[], 3, 'Língua Portuguesa', 'Médio', '"Assistir" no sentido de ver é transitivo indireto (assistir a). "Preferir" pede "preferir algo a algo", sem "mais" nem "do que"; "obedecer" pede preposição (obedecer ao edital); "aspirar" no sentido de desejar pede "a" (aspiro ao cargo).', s.id, false, 'Regência verbal', 'autoral', NULL, 'e8204004794e6fd6ecd71202aec097c6f3d04dd937c82743ea259fb0002c1189'
FROM public.subjects s WHERE s.slug = 'cmc26-lingua-portuguesa'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'A colocação do pronome oblíquo está de acordo com a norma-padrão em:', ARRAY['Nunca esqueceram-se do compromisso.', 'Ninguém avisou-me sobre a mudança.', 'Não me disseram o horário da prova.', 'Me disseram que a prova será em dezembro.']::text[], 2, 'Língua Portuguesa', 'Médio', 'Palavras negativas (não, nunca) e pronomes indefinidos (ninguém) atraem o pronome: "não me disseram", "nunca se esqueceram", "ninguém me avisou". Na norma-padrão, não se inicia frase com pronome oblíquo átono.', s.id, false, 'Colocação pronominal', 'autoral', NULL, '37e12adbd6056dea1d129dbfc588b2985e4505a980f19bcc0a393eef320c52a7'
FROM public.subjects s WHERE s.slug = 'cmc26-lingua-portuguesa'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Em "Os servidores foram convocados, porquanto a sessão extraordinária exigia quórum", a conjunção "porquanto" estabelece relação de:', ARRAY['finalidade', 'proporção', 'concessão', 'causa']::text[], 3, 'Língua Portuguesa', 'Difícil', '"Porquanto" equivale a "porque", "visto que", "já que": introduz a causa/explicação da convocação. Concessão seria "embora"; finalidade, "para que"; proporção, "à medida que".', s.id, false, 'Conjunções', 'autoral', NULL, '4a0416cfee3a1fb323c27315d7a0a0e63aea83042eb403650aabb43c14cd4016'
FROM public.subjects s WHERE s.slug = 'cmc26-lingua-portuguesa'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'A negação lógica da proposição "Se o vereador apresentar o projeto, então a comissão emitirá parecer" é:', ARRAY['O vereador não apresenta o projeto ou a comissão emite parecer.', 'O vereador não apresenta o projeto e a comissão não emite parecer.', 'O vereador apresenta o projeto e a comissão não emite parecer.', 'Se o vereador não apresentar o projeto, então a comissão não emitirá parecer.']::text[], 2, 'Raciocínio Lógico e Matemático', 'Médio', 'A negação de "p → q" é "p ∧ ~q": mantém-se o antecedente e nega-se o consequente, trocando o "se... então" por "e". A alternativa com "ou" é equivalente à própria condicional, não à sua negação.', s.id, false, 'Negação', 'autoral', NULL, 'b599853bf6c570da341efbf2802ecc4cbbe1e8f561ff8ab6a065a0932ee7e5bb'
FROM public.subjects s WHERE s.slug = 'cmc26-raciocinio-logico'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'O preço de um curso preparatório subiu 20% em outubro e, em novembro, teve desconto de 20% sobre o novo valor. Em relação ao preço original, o preço final:', ARRAY['permaneceu igual', 'aumentou 4%', 'diminuiu 4%', 'diminuiu 2%']::text[], 2, 'Raciocínio Lógico e Matemático', 'Médio', 'Fatores sucessivos: 1,20 × 0,80 = 0,96. O preço final é 96% do original, ou seja, 4% menor. Aumentos e descontos de mesma taxa não se anulam.', s.id, false, 'Porcentagem', 'autoral', NULL, 'ee136bc4b6244691b0c09374acbe1e4812fb24876b2e3ef424ecc8297c4b3e4a'
FROM public.subjects s WHERE s.slug = 'cmc26-raciocinio-logico'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Seis servidores digitalizam 900 documentos em 5 dias. Mantido o mesmo ritmo, quantos dias 10 servidores levarão para digitalizar 1.500 documentos?', ARRAY['6', '5', '3', '8']::text[], 1, 'Raciocínio Lógico e Matemático', 'Médio', 'Cada servidor digitaliza 900 ÷ (6 × 5) = 30 documentos por dia. Dez servidores fazem 300 por dia; 1.500 ÷ 300 = 5 dias.', s.id, false, 'Regra de três composta', 'autoral', NULL, '368b05412810b2e120412786ef29b11d0390389fa683f43d289b3270f631a1b7'
FROM public.subjects s WHERE s.slug = 'cmc26-raciocinio-logico'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Uma urna tem 3 bolas vermelhas e 2 azuis. Retiram-se duas bolas, uma após a outra, sem reposição. A probabilidade de as duas serem vermelhas é:', ARRAY['9/25', '1/5', '3/10', '3/5']::text[], 2, 'Raciocínio Lógico e Matemático', 'Médio', 'P = 3/5 × 2/4 = 6/20 = 3/10. Sem reposição, a segunda retirada tem uma bola vermelha a menos e uma bola a menos no total. 9/25 seria o resultado com reposição.', s.id, false, 'Probabilidade', 'autoral', 'superior', '22ca3303dd8edfe0bb40e644222b3cceaed4be660590255063c4d03df7eef277'
FROM public.subjects s WHERE s.slug = 'cmc26-raciocinio-logico'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'No Microsoft Excel, a fórmula =CONT.SE(B2:B30;"Aprovado") retorna:', ARRAY['a posição da primeira célula com o texto Aprovado', 'a soma dos valores de B2 a B30 dos candidatos aprovados', 'o percentual de células preenchidas no intervalo B2:B30', 'a quantidade de células de B2 a B30 que contêm exatamente o texto Aprovado']::text[], 3, 'Noções de Informática', 'Médio', 'CONT.SE conta as células de um intervalo que atendem a um critério. Para somar valores por critério usa-se SOMASE; para localizar posição, CORRESP.', s.id, false, 'Excel', 'autoral', NULL, '2d14d4884c090294c9a388ed5967d98c776ba2279a43915da64622f4a8c6f169'
FROM public.subjects s WHERE s.slug = 'cmc26-informatica'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'No Windows 10/11, o atalho Ctrl + Shift + Esc é usado para:', ARRAY['bloquear a sessão do usuário', 'abrir diretamente o Gerenciador de Tarefas', 'fechar a janela ativa', 'abrir o Explorador de Arquivos']::text[], 1, 'Noções de Informática', 'Fácil', 'Ctrl+Shift+Esc abre o Gerenciador de Tarefas. Win+L bloqueia a sessão, Win+E abre o Explorador de Arquivos e Alt+F4 fecha a janela ativa.', s.id, false, 'Windows', 'autoral', NULL, '2a72bf3009e0fea5d0e0afdce6c6ce3638171b4b8a8708e92ce39d00dbe5a2cb'
FROM public.subjects s WHERE s.slug = 'cmc26-informatica'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Ao acessar um site que usa HTTPS com certificado válido, o usuário tem a garantia de que:', ARRAY['o site é confiável e não pode ser uma página de phishing', 'o site não coleta dados pessoais do usuário', 'os dados trafegam criptografados entre o navegador e o servidor daquele domínio', 'o computador do usuário está protegido contra vírus']::text[], 2, 'Noções de Informática', 'Médio', 'HTTPS (TLS) cifra a comunicação e confirma que o servidor responde por aquele domínio. Golpistas também obtêm certificados para domínios falsos: o cadeado não prova que o site é legítimo nem substitui o antivírus.', s.id, false, 'Segurança - navegação', 'autoral', NULL, 'e062d623d6dab974d5732eae91e41e19062bc6cdb05c58ca9910f73e880f0cf2'
FROM public.subjects s WHERE s.slug = 'cmc26-informatica'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'O rio Tapajós, importante para a hidrografia do norte de Mato Grosso, é formado pela confluência dos rios:', ARRAY['Juruena e Teles Pires', 'Cuiabá e São Lourenço', 'Guaporé e Mamoré', 'Araguaia e das Mortes']::text[], 0, 'História e Geografia de Mato Grosso', 'Médio', 'O Tapajós nasce do encontro do Juruena com o Teles Pires (São Manoel), na divisa de MT com AM e PA, e pertence à bacia Amazônica. Cuiabá e São Lourenço são da bacia do Paraguai; o das Mortes é afluente do Araguaia; Guaporé e Mamoré formam o Madeira.', s.id, false, 'Geografia - hidrografia', 'autoral', NULL, 'a78e297502f9dbd2d28be8f13eab8e5cc10fe24147443de55438e965af141676'
FROM public.subjects s WHERE s.slug = 'cmc26-historia-geografia-mt'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'O município conurbado com Cuiabá, separado da capital pelo rio Cuiabá e segundo mais populoso de Mato Grosso, é:', ARRAY['Várzea Grande', 'Rondonópolis', 'Sinop', 'Cáceres']::text[], 0, 'História e Geografia de Mato Grosso', 'Fácil', 'Várzea Grande fica na margem direita do rio Cuiabá e forma com a capital o núcleo da Região Metropolitana do Vale do Rio Cuiabá. Pelo Censo 2022, é o 2º município mais populoso do estado, seguido por Rondonópolis.', s.id, false, 'Geografia - urbanização', 'autoral', NULL, 'b9c653e14fe6694799ed7d669b22aff5a0428b758a1b3b6eb6381b36f46b7c34'
FROM public.subjects s WHERE s.slug = 'cmc26-historia-geografia-mt'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Mato Grosso abriga três grandes biomas. Qual deles NÃO está entre os declarados patrimônio nacional pelo art. 225, § 4º, da Constituição Federal?', ARRAY['Cerrado', 'Pantanal Mato-Grossense', 'Floresta Amazônica brasileira', 'Nenhum: os três estão no art. 225, § 4º']::text[], 0, 'História e Geografia de Mato Grosso', 'Difícil', 'O art. 225, § 4º, da CF lista Floresta Amazônica, Mata Atlântica, Serra do Mar, Pantanal Mato-Grossense e Zona Costeira. O Cerrado, que cobre grande parte de MT, não consta do dispositivo.', s.id, false, 'Geografia - biomas', 'autoral', NULL, '0ac427e01e1a6ece934009f4343daeb48dccfb6340906988ce532cb0b489efb0'
FROM public.subjects s WHERE s.slug = 'cmc26-historia-geografia-mt'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT '"No estado de natureza, a vida do homem é solitária, pobre, sórdida, embrutecida e curta; há uma guerra de todos contra todos." Para escapar dessa condição, os indivíduos transferem seu poder a um soberano absoluto. Essa concepção pertence a:', ARRAY['Jean-Jacques Rousseau', 'John Locke', 'Aristóteles', 'Thomas Hobbes']::text[], 3, 'Noções de Ética e Filosofia', 'Médio', 'Hobbes (Leviatã, 1651) descreve o estado de natureza como guerra de todos contra todos e justifica o soberano forte. Rousseau via o homem naturalmente bom e defendia a vontade geral; Locke, direitos naturais e governo limitado; Aristóteles, o homem como animal político.', s.id, false, 'Ética e política - contratualismo', 'autoral', NULL, '4a345f284f46a3da4c0ff42601374aa8deae1ddb91914a159a37c265ace12246'
FROM public.subjects s WHERE s.slug = 'cmc26-etica-filosofia'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Ao acompanhar o julgamento de Adolf Eichmann, Hannah Arendt cunhou a expressão "banalidade do mal" para indicar que:', ARRAY['grandes males podem ser praticados por pessoas comuns que deixam de pensar e apenas cumprem ordens', 'os crimes de guerra são irrelevantes do ponto de vista moral', 'a obediência à lei elimina a responsabilidade individual', 'o mal é sempre fruto de uma natureza humana perversa e monstruosa']::text[], 0, 'Noções de Ética e Filosofia', 'Difícil', 'Para Arendt, Eichmann não era um monstro, mas um burocrata incapaz de refletir sobre o que fazia. A ausência de pensamento crítico, e não uma maldade extraordinária, tornou o mal possível — e não afasta a responsabilidade.', s.id, false, 'Ética e violência', 'autoral', NULL, 'cd35260b15c11f6784c53393afe4e237491dcca81b55b61dc2cbd7af5628932b'
FROM public.subjects s WHERE s.slug = 'cmc26-etica-filosofia'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Na Janela de Johari, a área que reúne características percebidas pelos outros, mas desconhecidas pela própria pessoa, é chamada de área:', ARRAY['aberta', 'oculta', 'cega', 'desconhecida']::text[], 2, 'Relações Interpessoais', 'Médio', 'Aberta: conhecida por mim e pelos outros; cega: os outros veem e eu não; oculta: eu sei e escondo; desconhecida: ninguém conhece. O feedback é o que reduz a área cega.', s.id, false, 'Autoconhecimento - Janela de Johari', 'autoral', NULL, '52334410208e18b3c8734a3aafa7be3bedd4294fe5b0062c0059bef87bb60a52'
FROM public.subjects s WHERE s.slug = 'cmc26-relacoes-interpessoais'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Durante uma reunião, um colega interrompe repetidamente a fala de um servidor. Qual resposta representa comunicação assertiva?', ARRAY['"Gostaria de concluir meu raciocínio; em seguida ouço sua opinião."', '"Você nunca deixa ninguém falar, isso é falta de educação!"', 'Ficar em silêncio para evitar conflito e desistir de expor a ideia.', 'Reclamar do colega com a chefia depois da reunião, sem falar com ele.']::text[], 0, 'Relações Interpessoais', 'Fácil', 'A assertividade expressa a própria necessidade com clareza e respeito, sem agredir (comportamento agressivo) nem se omitir (passivo) ou agir indiretamente (passivo-agressivo).', s.id, false, 'Comunicação assertiva', 'autoral', NULL, '0c6b9e4da4b31749abc05a78c0eb8747853132e28881d0ce362498bcbfad7513'
FROM public.subjects s WHERE s.slug = 'cmc26-relacoes-interpessoais'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Segundo a Lei nº 9.784/1999, podem ser convalidados pela própria Administração os atos que apresentem:', ARRAY['defeitos sanáveis, desde que não acarretem lesão ao interesse público nem prejuízo a terceiros', 'qualquer vício, inclusive de finalidade, se houver interesse da Administração', 'vícios de motivo e de objeto, desde que dentro de 5 anos', 'apenas defeitos de competência exclusiva']::text[], 0, 'Noções de Administração Pública', 'Difícil', 'Art. 55 da Lei 9.784/1999. Pela doutrina, são sanáveis os vícios de competência (salvo exclusiva) e de forma (salvo essencial); vícios de finalidade, motivo e objeto não admitem convalidação.', s.id, false, 'Atos administrativos - convalidação', 'autoral', NULL, '8f68987245d669634eed52b8984c91b47bcb05f22f087c5bda84d5c61a497c81'
FROM public.subjects s WHERE s.slug = 'cmc26-administracao-publica'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'De acordo com a Lei Complementar nº 95/1998, a cláusula "entra em vigor na data de sua publicação" deve ser reservada para:', ARRAY['qualquer lei, a critério do autor do projeto', 'as leis complementares e as emendas à Lei Orgânica', 'as leis de pequena repercussão', 'as leis de grande repercussão, para dar efeito imediato']::text[], 2, 'Técnico Legislativo — Conhecimentos Específicos', 'Médio', 'Art. 8º da LC 95/1998: a vigência deve ser indicada de modo expresso, com prazo razoável para que dela se tenha amplo conhecimento, reservada a cláusula de vigência imediata para as leis de pequena repercussão.', s.id, false, 'Técnica legislativa - LC 95/1998', 'autoral', NULL, '0811abc690fa060b0ec8a66e7041c331b5f933dc13786d466bee8e03d0951ede'
FROM public.subjects s WHERE s.slug = 'cmc26-tecnico-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pelo Manual de Redação da Presidência da República, o fecho "Respeitosamente" é empregado em comunicações dirigidas a:', ARRAY['autoridades de hierarquia superior à do remetente, inclusive o Presidente da República', 'particulares, em qualquer caso', 'qualquer destinatário, sendo o único fecho admitido', 'autoridades de mesma hierarquia ou de hierarquia inferior']::text[], 0, 'Técnico Legislativo — Conhecimentos Específicos', 'Fácil', 'O Manual prevê dois fechos: "Respeitosamente", para autoridades de hierarquia superior, e "Atenciosamente", para autoridades de mesma hierarquia, de hierarquia inferior e para particulares.', s.id, false, 'Redação oficial - fecho', 'autoral', NULL, 'c879b44319453cc44519cca197553c83f44c81d88926fd5a01d07533aad6681d'
FROM public.subjects s WHERE s.slug = 'cmc26-tecnico-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela teoria das três idades, documentos que perderam o valor administrativo, mas foram preservados por seu valor histórico, probatório ou informativo (valor secundário), pertencem ao arquivo:', ARRAY['intermediário', 'setorial', 'permanente', 'corrente']::text[], 2, 'Técnico Legislativo — Conhecimentos Específicos', 'Médio', 'Corrente: uso frequente; intermediário: uso eventual, aguardando destinação; permanente: guarda definitiva pelo valor secundário. A passagem é definida pela tabela de temporalidade.', s.id, false, 'Arquivologia - teoria das três idades', 'autoral', NULL, 'fadd66abb4b1a965788e8ad68024053f53525570b9c0727070f7432c4db002fb'
FROM public.subjects s WHERE s.slug = 'cmc26-tecnico-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'NÃO é modalidade de licitação prevista na Lei nº 14.133/2021:', ARRAY['tomada de preços', 'leilão', 'pregão', 'diálogo competitivo']::text[], 0, 'Analista Legislativo — Conhecimentos Específicos', 'Fácil', 'Art. 28 da Lei 14.133/2021: pregão, concorrência, concurso, leilão e diálogo competitivo. Tomada de preços e convite, da Lei 8.666/1993, não existem na nova lei.', s.id, false, 'Licitação - modalidades', 'autoral', NULL, '812efa4b4d4512b08ee2f8a37741cf4cc2649e072695f9945d66fe00145772cc'
FROM public.subjects s WHERE s.slug = 'cmc26-analista-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Conforme o art. 31 da Constituição Federal, o parecer prévio do Tribunal de Contas sobre as contas que o Prefeito deve anualmente prestar:', ARRAY['é dispensado nos Municípios com mais de 500 mil habitantes', 'só deixará de prevalecer por decisão de dois terços dos membros da Câmara Municipal', 'vincula a Câmara, que não pode rejeitá-lo', 'pode ser afastado por maioria simples dos vereadores presentes']::text[], 1, 'Analista Legislativo — Conhecimentos Específicos', 'Médio', 'Art. 31, § 2º, da CF. A fiscalização do Município é exercida pela Câmara (controle externo, com auxílio do Tribunal de Contas) e pelo controle interno do Executivo; as contas ficam 60 dias à disposição dos contribuintes (§ 3º).', s.id, false, 'Direito Constitucional - fiscalização do Município', 'autoral', NULL, 'ab26ec5c5dd4bb9c196a62cbd62ea33c72213c4ac8edd8e37e4bba36dbdd6072'
FROM public.subjects s WHERE s.slug = 'cmc26-analista-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Na Lei nº 9.784/1999, o recurso administrativo é dirigido à autoridade que proferiu a decisão, a qual, se não a reconsiderar no prazo de 5 dias, o encaminhará à autoridade superior. Salvo disposição legal específica, o prazo para interpor o recurso é de:', ARRAY['30 dias, contados da ciência da decisão', '15 dias úteis, contados da publicação', '10 dias, contados da ciência ou divulgação oficial da decisão', '5 dias, contados da decisão']::text[], 2, 'Analista Legislativo — Conhecimentos Específicos', 'Difícil', 'Art. 59 da Lei 9.784/1999 (prazo de 10 dias) e art. 56, § 1º (reconsideração em 5 dias). Em regra, o recurso tramita por no máximo três instâncias (art. 57).', s.id, false, 'Processo administrativo - recurso', 'autoral', NULL, 'a3317d191bce974a584110b29a1fad45625ecfc689f28a6a7c7c9774e89f351e'
FROM public.subjects s WHERE s.slug = 'cmc26-analista-legislativo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Um sistema exibe na página, sem tratamento, o texto que o usuário digitou em um campo de comentário, permitindo que um script seja executado no navegador de outros visitantes. Trata-se de vulnerabilidade de:', ARRAY['negação de serviço (DoS), mitigada com balanceamento de carga', 'CSRF, mitigada com aumento do tamanho da senha', 'SQL Injection, mitigada com consultas parametrizadas', 'Cross-Site Scripting (XSS), mitigada com codificação (escape) da saída e Content Security Policy']::text[], 3, 'Analista Legislativo — Tecnologia da Informação', 'Médio', 'XSS ocorre quando dado não confiável é inserido no HTML sem codificação. Defesas: escapar a saída conforme o contexto, validar a entrada e usar CSP. Consultas parametrizadas defendem contra SQL Injection; tokens anti-CSRF, contra CSRF.', s.id, false, 'Segurança - XSS', 'autoral', NULL, 'e4609d2d6178389a18c235c9d279fcbb3b88213127d487983555a2705e83877c'
FROM public.subjects s WHERE s.slug = 'cmc26-analista-ti'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Em uma API REST, um usuário autenticado tenta acessar um recurso para o qual não tem permissão. O código de status HTTP mais adequado é:', ARRAY['401 Unauthorized', '403 Forbidden', '404 Not Found', '500 Internal Server Error']::text[], 1, 'Analista Legislativo — Tecnologia da Informação', 'Médio', '401 indica ausência ou falha de autenticação; 403, que o cliente foi identificado mas não tem autorização. 404 é recurso inexistente e 500, erro no servidor.', s.id, false, 'APIs REST - códigos HTTP', 'autoral', NULL, '6263dceb13c6dc13ac040512b640f7536462623501697a69ec35112637c3b443'
FROM public.subjects s WHERE s.slug = 'cmc26-analista-ti'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela NR-4, o dimensionamento do Serviço Especializado em Segurança e em Medicina do Trabalho (SESMT) é feito com base:', ARRAY['no grau de risco da atividade e no número de empregados', 'no número de acidentes registrados no ano anterior', 'na quantidade de membros eleitos da CIPA', 'apenas no faturamento anual da organização']::text[], 0, 'Analista Legislativo — Segurança do Trabalho', 'Médio', 'A NR-4 vincula a composição do SESMT ao grau de risco (CNAE) e ao número de empregados, conforme seu quadro de dimensionamento.', s.id, false, 'NR-4 - SESMT', 'autoral', NULL, '5879408427cb0c95fd20e1d58b2e3ed37279fd8c2c74f4e133b1d1823355fb00'
FROM public.subjects s WHERE s.slug = 'cmc26-seguranca-trabalho'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Com a revisão das Normas Regulamentadoras em vigor desde 2022, o antigo PPRA (Programa de Prevenção de Riscos Ambientais) deu lugar ao:', ARRAY['LTCAT, previsto na Lei nº 8.213/1991', 'PCMSO, previsto na NR-7', 'Mapa de Riscos elaborado pela CIPA', 'Programa de Gerenciamento de Riscos (PGR), no âmbito do GRO previsto na NR-1']::text[], 3, 'Analista Legislativo — Segurança do Trabalho', 'Médio', 'A NR-1 instituiu o Gerenciamento de Riscos Ocupacionais (GRO), materializado no PGR (inventário de riscos e plano de ação). A NR-9 passou a tratar da avaliação e controle das exposições a agentes físicos, químicos e biológicos.', s.id, false, 'NR-1 - GRO/PGR', 'autoral', NULL, 'b0b036db018be4265e81da3dad016dce45f0684211d909935fa54ab0963536cb'
FROM public.subjects s WHERE s.slug = 'cmc26-seguranca-trabalho'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'De acordo com a Lei nº 10.216/2001, a internação psiquiátrica involuntária deve ser comunicada ao Ministério Público Estadual no prazo de:', ARRAY['72 horas', '24 horas', '30 dias', '15 dias']::text[], 0, 'Analista Legislativo — Psicólogo', 'Médio', 'Art. 8º, § 1º: a internação involuntária deve ser comunicada ao MP Estadual em 72 horas pelo responsável técnico do estabelecimento; o mesmo vale para a alta. A lei prevê internação voluntária, involuntária e compulsória (determinada pela Justiça).', s.id, false, 'Saúde mental - Lei 10.216/2001', 'autoral', NULL, '772ec99e9a7b5441a5f7fc52f394d7a0c206bcf8720a920ae8690e8bc4fa3279'
FROM public.subjects s WHERE s.slug = 'cmc26-psicologo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'No modelo de Elisabeth Kübler-Ross sobre o processo de luto, a fase em que a pessoa tenta "negociar" (com Deus, com a equipe ou consigo) para adiar o inevitável é chamada de:', ARRAY['negação', 'raiva', 'aceitação', 'barganha']::text[], 3, 'Analista Legislativo — Psicólogo', 'Fácil', 'As cinco fases descritas são negação, raiva, barganha, depressão e aceitação. Não são etapas rígidas: podem se sobrepor ou não ocorrer nessa ordem.', s.id, false, 'Luto - Kübler-Ross', 'autoral', NULL, 'bf780ddd337c70a68fedff718a32e8df6b4772964e1204a44a4195b47a83ad9b'
FROM public.subjects s WHERE s.slug = 'cmc26-psicologo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Na Política Nacional de Assistência Social (PNAS/2004), o eixo estruturante que coloca a família como foco central na concepção e implementação de benefícios, serviços, programas e projetos é a:', ARRAY['territorialização', 'matricialidade sociofamiliar', 'intersetorialidade', 'descentralização político-administrativa']::text[], 1, 'Analista Legislativo — Assistente Social', 'Médio', 'A PNAS/2004 elenca como eixos estruturantes do SUAS, entre outros, a matricialidade sociofamiliar, a descentralização político-administrativa e territorialização, o financiamento e o controle social. A centralidade da família é a matricialidade sociofamiliar.', s.id, false, 'PNAS - matricialidade sociofamiliar', 'autoral', NULL, '6eb6b729e3f638f2bbcb8f99ccffd631f34ac955b20e22f3ee30b70e313f0574'
FROM public.subjects s WHERE s.slug = 'cmc26-assistente-social'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Segundo a Tipificação Nacional dos Serviços Socioassistenciais, o Serviço de Proteção e Atendimento Especializado a Famílias e Indivíduos (PAEFI) é ofertado:', ARRAY['em unidades de acolhimento, na alta complexidade', 'no CRAS, na Proteção Social Básica', 'no CREAS, na Proteção Social Especial de média complexidade', 'no Centro POP, exclusivamente para população em situação de rua']::text[], 2, 'Analista Legislativo — Assistente Social', 'Médio', 'O PAEFI atende famílias e indivíduos com direitos violados (violência, abandono, negligência etc.) e é ofertado obrigatoriamente no CREAS. No CRAS, o serviço continuado é o PAIF.', s.id, false, 'SUAS - PAEFI', 'autoral', NULL, '3fa7152a47e9d967c6238eb6698378512a9b76f06c755d802fcd66302cee15be'
FROM public.subjects s WHERE s.slug = 'cmc26-assistente-social'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Na assessoria de comunicação de uma Câmara Municipal, o texto que expressa o posicionamento formal da instituição sobre um tema, para ser divulgado como tal, chama-se:', ARRAY['pauta', 'clipping', 'nota oficial', 'release']::text[], 2, 'Analista Legislativo — Jornalismo', 'Fácil', 'Nota oficial é a manifestação formal e assinada da instituição. Release é material de divulgação enviado à imprensa como sugestão de pauta; clipping é a coleta do que foi publicado sobre a instituição.', s.id, false, 'Assessoria - nota oficial', 'autoral', NULL, 'e18dd9a4b1c9005c295cf0f6be24c7d594082106c3c530ddef77a24bd8a246a2'
FROM public.subjects s WHERE s.slug = 'cmc26-jornalismo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'A Constituição Federal, ao assegurar a todos o acesso à informação, resguarda expressamente:', ARRAY['o sigilo da fonte, quando necessário ao exercício profissional', 'a exigência de licença estatal para publicar notícias', 'a identificação obrigatória de todas as fontes em reportagens', 'a censura prévia de matérias sobre autoridades']::text[], 0, 'Analista Legislativo — Jornalismo', 'Médio', 'Art. 5º, XIV, da CF. O art. 220 veda qualquer censura de natureza política, ideológica e artística, e o Código de Ética dos Jornalistas também protege o sigilo da fonte.', s.id, false, 'Liberdade de imprensa - sigilo da fonte', 'autoral', NULL, '937a6ae155afd891f75d33dd2e2d762aaf905922d5edb9351241d98b9f8bae0f'
FROM public.subjects s WHERE s.slug = 'cmc26-jornalismo'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela Lei de Responsabilidade Fiscal, a despesa total com pessoal do Poder Legislativo municipal, incluído o Tribunal de Contas do Município quando houver, não pode exceder o seguinte percentual da receita corrente líquida:', ARRAY['3%', '6%', '60%', '54%']::text[], 1, 'Contador', 'Médio', 'Art. 20, III, da LRF: 6% para o Legislativo municipal e 54% para o Executivo, somando o limite global de 60% do Município (art. 19, III). Na Câmara também vale o limite de 70% da receita com folha (art. 29-A, § 1º, da CF).', s.id, false, 'LRF - limite de pessoal do Legislativo', 'autoral', NULL, 'a5e93371c5eea100b6c4f0d20888c1d7fce6e81c767ce12cd3cb57d2a1f4a34d'
FROM public.subjects s WHERE s.slug = 'cmc26-contador'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela Lei nº 4.320/1964, classifica-se como receita de capital:', ARRAY['a operação de crédito', 'a receita tributária', 'a receita de serviços', 'a receita patrimonial de aluguéis']::text[], 0, 'Contador', 'Fácil', 'Art. 11 da Lei 4.320/1964: são receitas de capital as operações de crédito, a alienação de bens, a amortização de empréstimos e as transferências de capital. Tributária, de serviços e patrimonial são receitas correntes.', s.id, false, 'Receita pública - categorias econômicas', 'autoral', NULL, '87b7e903c68df3530baa4cedbfed8d488e75bbcd42067f46bd227ba3ee4224d8'
FROM public.subjects s WHERE s.slug = 'cmc26-contador'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Em auditoria, os procedimentos que verificam se os controles internos estão funcionando de forma efetiva ao longo do período são chamados de:', ARRAY['circularização', 'procedimentos analíticos de revisão final', 'testes de observância (de controle)', 'testes substantivos']::text[], 2, 'Controlador Interno', 'Médio', 'Testes de observância avaliam o funcionamento dos controles. Testes substantivos buscam evidências sobre a exatidão e a validade dos dados e saldos. Circularização é a confirmação externa, uma técnica substantiva.', s.id, false, 'Auditoria - testes', 'autoral', NULL, '403dbfaf84aa0dbc3a27307dfe51dba9a5fce4d1cfba9c30e11eb8696eafc12b'
FROM public.subjects s WHERE s.slug = 'cmc26-controlador-interno'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Pela NBC TA 705, quando o auditor conclui que as distorções, individualmente ou em conjunto, são relevantes e generalizadas nas demonstrações, deve emitir opinião:', ARRAY['adversa', 'com abstenção, sempre que houver distorção', 'com ressalva', 'sem ressalva com parágrafo de ênfase']::text[], 0, 'Controlador Interno', 'Difícil', 'Distorção relevante e generalizada: opinião adversa. Relevante mas não generalizada: com ressalva. Abstenção ocorre quando o auditor não obtém evidência suficiente e os possíveis efeitos seriam relevantes e generalizados.', s.id, false, 'Auditoria - tipos de opinião', 'autoral', NULL, 'b25ee1d39cef03ed7b40304638ad34a8d69ca93834b6a3d4b661fb0716a4f8e4'
FROM public.subjects s WHERE s.slug = 'cmc26-controlador-interno'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Em uma solenidade oficial, segundo a prática do cerimonial público, a ordem dos pronunciamentos deve seguir a regra de que:', ARRAY['os oradores falam em ordem alfabética', 'a autoridade de maior precedência fala por último', 'o anfitrião sempre encerra, mesmo diante de autoridade superior', 'a autoridade de maior precedência fala primeiro']::text[], 1, 'Técnico Legislativo — Cerimonial', 'Fácil', 'A ordem dos discursos é inversa à da precedência: começa pela autoridade de menor precedência e termina com a de maior, que encerra a fala oficial.', s.id, false, 'Pronunciamentos - ordem', 'autoral', NULL, '4345e68c6fc2af280fc4bf3f1208453c8cb0ec5a2079626b60f84e8676d20fd3'
FROM public.subjects s WHERE s.slug = 'cmc26-cerimonial'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'A sigla R.S.V.P., impressa em um convite oficial, significa que:', ARRAY['o traje exigido é passeio completo', 'o convite é pessoal e intransferível', 'o anfitrião solicita a confirmação de presença', 'o evento terá lugares reservados para autoridades']::text[], 2, 'Técnico Legislativo — Cerimonial', 'Fácil', 'R.S.V.P. vem do francês "Répondez s''il vous plaît" (responda, por favor): pede-se ao convidado que confirme ou não a presença, em geral por um telefone ou e-mail indicado.', s.id, false, 'Convites - RSVP', 'autoral', NULL, 'd7472574a566f1b76e06c6251b9de6bd78a7566c7c96804cbd42ae11b7b2d422'
FROM public.subjects s WHERE s.slug = 'cmc26-cerimonial'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'Em campo livre, ao se dobrar a distância entre uma fonte sonora pontual e o ouvinte, o nível de pressão sonora:', ARRAY['permanece o mesmo', 'cai cerca de 6 dB', 'cai pela metade em decibéis', 'cai cerca de 3 dB']::text[], 1, 'Técnico Legislativo — Sonorização', 'Médio', 'Pela lei do inverso do quadrado, a intensidade cai a 1/4 quando a distância dobra, o que corresponde a cerca de 6 dB a menos de nível de pressão sonora.', s.id, false, 'Acústica - lei do inverso do quadrado', 'autoral', NULL, '8f99121798ea55a9b19241167a4fe0d5fbbb088469ed070cd485ef785493c5ff'
FROM public.subjects s WHERE s.slug = 'cmc26-sonorizacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT 'A gravação de uma sessão plenária foi feita com taxa de amostragem de 48 kHz. Pelo teorema de Nyquist, a maior frequência que pode ser registrada corretamente é de aproximadamente:', ARRAY['24 kHz', '96 kHz', '12 kHz', '48 kHz']::text[], 0, 'Técnico Legislativo — Sonorização', 'Médio', 'A frequência máxima representável (frequência de Nyquist) é metade da taxa de amostragem: 48 ÷ 2 = 24 kHz, acima do limite da audição humana (cerca de 20 kHz).', s.id, false, 'Áudio digital - taxa de amostragem', 'autoral', NULL, 'fc9198b6455ddb54bb508808ed18fdd322e40880a34ce6d6a4bdafe79bfc2fbe'
FROM public.subjects s WHERE s.slug = 'cmc26-sonorizacao'
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';
