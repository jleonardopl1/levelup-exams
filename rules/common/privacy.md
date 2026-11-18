# Privacidade — LGPD e ECA Digital

O LevelUp atende estudantes de ENEM e vestibular, **muitos menores de 18 anos**. Valem juntas a
LGPD (Lei 13.709/2018) e o **ECA Digital** (Lei 15.211/2025, em vigor desde 17/03/2026,
fiscalizado pela ANPD). Confirme o texto e a regulamentação vigentes antes de decidir; isto não é
parecer jurídico.

## Sempre
- **Minimização:** colete só o que a funcionalidade precisa; nada de dado sensível sem necessidade.
- **Base legal** declarada para cada dado novo (execução de contrato, consentimento, legítimo interesse…).
- **Retenção** definida para tabelas que crescem (logs, telemetria, tentativas).
- **Logs e telemetria sem conteúdo:** metadados apenas (ver `ai_runs`, `audit_logs`).
- **Direitos do titular:** acesso, correção e exclusão viáveis (a tela de Configurações já pede exclusão).
- **E-mail de aluno** visível só ao master (decisão já aplicada no painel).
- **Provedores de IA:** só envie ao modelo o necessário para a tarefa; nunca e-mail, CPF ou nome completo.

## Menores (ECA Digital) — pontos de atenção do produto
- **Verificação de idade** confiável (a autodeclaração deixou de bastar) e **supervisão parental**
  quando aplicável — decisão de produto pendente (D6 em `AGENTS-COLLAB.md`).
- **Proibido:** perfilamento de menores para publicidade, "caixas de recompensa" (loot boxes) e
  design que explore vulnerabilidade (pressão, escassez falsa, rolagem infinita sem pausa).
- **Gamificação:** recompensa determinística por esforço/progresso; lembretes em horário
  respeitoso e fáceis de desligar.
- **Configurações padrão mais protetivas** para contas de menores.

## Incidente com dado pessoal
Siga `rules/common/security.md` e avalie a comunicação à ANPD e aos titulares.
