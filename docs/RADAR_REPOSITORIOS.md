# Radar de repositórios — o que instalar, o que guardar, o que descartar

Avaliação contínua de repositórios externos (skills, plugins, agentes, bibliotecas) para o
LevelUp Exams. O primeiro lote (2026-11-23) cobre os 61 repositórios indicados pelo dono; a partir
daí, uma **varredura semanal** dos portais de ranking traz novidades com pedido de de acordo.

- **Catálogo (fonte da verdade):** [`ops/radar-repositorios/catalogo.json`](../ops/radar-repositorios/catalogo.json)
- **Como avaliar, ativar e desativar:** skill [`radar-repositorios`](../.claude/skills/radar-repositorios/SKILL.md) (`/radar-repositorios`)
- **Relatórios semanais:** [`docs/radar-repositorios/semanal/`](radar-repositorios/semanal/)
- **Avaliações anteriores** (32 repositórios, 2026-11-17 e 2026-11-18): [REFERENCIAS_REPOSITORIOS.md](REFERENCIAS_REPOSITORIOS.md) e [ANALISE_DAS_REFERENCIAS.md](ANALISE_DAS_REFERENCIAS.md)

## Como o radar decide

O filtro é o mesmo da decisão D9: o item ajuda o candidato a ser aprovado, protege quem estuda
ou torna o trabalho dos agentes mais seguro, e cabe no stack (Vite + React + Supabase/Deno +
Lovable). Cada repositório foi avaliado pelo agente dono da faixa (`engenheiro-ia`,
`coordenador`, `designer`, `mobile`, `security-reviewer`) a partir do README e, para os
candidatos a instalação, dos arquivos reais numa revisão fixada.

| Veredito | Significa | Quem decide |
| --- | --- | --- |
| Ativar agora | Ferramenta de desenvolvimento, regra ou skill sem custo, sem secret e sem dependência nova em produção | Dono aprova; entra no projeto |
| Piloto | Vale testar logo, mas envolve custo, conta, secret ou dependência de produção | Dono dá o de acordo item a item |
| Futuro | Potencial claro; ativar quando o gatilho registrado acontecer | Faixa dona propõe no gatilho |
| Monitorar | Interessante, mas imaturo, redundante ou arriscado hoje | Reavaliado na varredura semanal |
| Descartado | Fora do escopo ou risco jurídico, de segurança ou de privacidade | — |

## Regras de cadeia de suprimentos (valem para toda instalação)

1. Nada fica ativo sem avaliação aprovada: o validador (`bun run test:unit`) falha se houver
   plugin em `enabledPlugins` ou skill escrita fora do gerador em `.claude/skills/` sem registro
   no catálogo.
2. Código de terceiros copiado para o repositório fica preso a um **commit** e acompanha um
   `ORIGEM.md` (repositório, commit, licença, arquivos, adaptações, aprovação). Sem atualização
   automática.
3. O `security-reviewer` lê os arquivos reais antes do pedido de de acordo: o que executa, rede,
   segredos, injeção de prompt em `SKILL.md`/`CLAUDE.md` e licença.
4. Hooks, instaladores e scripts de terceiros não entram sem revisão específica; os nossos
   guardrails (`.claude/hooks/guardrails.mjs`) continuam valendo.
5. Serviço pago, conta nova, secret ou dado de aluno indo a terceiro = **piloto**, nunca "agora"
   (D4, LGPD, ECA Digital).

## Resultado

<!-- radar:inicio (gerado por ops/radar-repositorios/radar.mjs; não edite à mão) -->

| Veredito | Repositórios |
| --- | ---: |
| Ativar agora | 0 |
| Piloto (precisa do de acordo do dono) | 0 |
| Futuro (ativar quando o gatilho acontecer) | 0 |
| Monitorar | 0 |
| Descartado | 0 |
| **Total** | **0** |

### Ativos no projeto

Nenhum.

### Aguardando o de acordo do dono

Nenhum.

### Futuro — ativar quando o gatilho acontecer

Nenhum.

### Monitorar

Nenhum.

### Descartados

Nenhum.

### Detalhe dos ativos

Nenhum.

<!-- radar:fim -->
