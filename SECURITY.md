# Politica de Seguranca

## Reportando Vulnerabilidades

Se voce encontrar uma vulnerabilidade de seguranca, por favor reporte de forma responsavel:

1. **NAO** abra uma issue publica
2. Envie um email para contato@simuladosconcursos.com.br com o assunto "Security Vulnerability"
3. Inclua uma descricao detalhada da vulnerabilidade
4. Aguarde confirmacao antes de divulgar publicamente

## Praticas de Seguranca Adotadas

### Autenticacao e Autorizacao
- JWT authentication via Supabase Auth
- Row Level Security (RLS) em todas as tabelas
- Role-based access control para funcoes administrativas
- Verificacao de admin via RPC `has_role()`

### Protecao de Dados
- Validacao server-side de respostas de quiz (view `questions_public`)
- Operacoes atomicas (RPC functions) para prevenir race conditions
- Sanitizacao HTML em templates de email (prevencao de XSS)
- Validacao de input em todos os endpoints

### Protecao de API
- CORS restrito por variavel de ambiente
- Rate limiting por IP em todos os endpoints
- Stripe webhook signature verification
- Price ID whitelist para sessoes de checkout
- Audit logging para eventos criticos

### Infraestrutura
- Variaveis de ambiente para credenciais (nunca hardcoded)
- Supabase managed infrastructure com SSL/TLS
- Edge Functions com isolamento de execucao
