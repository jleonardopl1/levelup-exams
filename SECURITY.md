# Politica de Seguranca

## Reportando Vulnerabilidades

Se voce encontrar uma vulnerabilidade de seguranca, por favor reporte de forma responsavel:

1. **NAO** abra uma issue publica
2. Envie um email para contato@simuladosconcursos.com.br com o assunto "Security Vulnerability"
3. Inclua uma descricao detalhada da vulnerabilidade
4. Aguarde confirmacao antes de divulgar publicamente

## Praticas de Seguranca Adotadas

Relatorio completo da ultima auditoria: [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

### Autenticacao e Autorizacao
- JWT via Supabase Auth, validado em toda Edge Function (`requireUser` / `requireAdmin`)
- Row Level Security (RLS) em todas as tabelas; privilegios por coluna onde ha dados sensiveis
- Colunas privilegiadas (`profiles.tier`) protegidas por trigger; so `service_role` altera
- Papeis via `has_role()` (o cliente so pode consultar o proprio papel)
- Banimento aplicado no Supabase Auth (`ban_duration`) e nas Edge Functions

### Protecao de Dados
- Gabarito (`questions.correta`) nunca e exposto ao cliente; validacao via RPC `validate_answer`
- Conteudo premium filtrado por RLS
- Ranking publico sem e-mails nem UUIDs de usuarios
- Funcoes `SECURITY DEFINER` com `search_path` fixo, checagem de `auth.uid()` e `EXECUTE` revogado de `PUBLIC`/`anon`
- Pontos, resgates e comissoes nao podem ser definidos livremente pelo cliente
- Sanitizacao HTML em templates de e-mail

### Protecao de API
- CORS restrito por variavel de ambiente (`ALLOWED_ORIGIN`)
- Rate limiting atomico (RPC `check_rate_limit`), por usuario autenticado ou por IP/destinatario
- Stripe: verificacao de assinatura do webhook, idempotencia por `event.id`, whitelist de Price IDs, redirects fixos (`SITE_URL`)
- Respostas de erro sem detalhes internos
- Audit logging de eventos criticos (somente `service_role` escreve)

### Infraestrutura
- Segredos apenas em variaveis de ambiente das Edge Functions (a chave `anon` do frontend e publica por design)
- Supabase managed infrastructure com SSL/TLS
- Edge Functions com isolamento de execucao
