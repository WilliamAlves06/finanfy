# 09 — Autenticação e Segurança

> JWT próprio (grátis). Isolamento multi-tenant garantido no repositório base — não confiado ao
> controller. Tudo com libs gratuitas.

## Autenticação

### Cadastro / Login
- Senha com **bcrypt** (`saltRounds >= 12`). Nunca guardar/logar senha em texto.
- Login retorna **access token** (JWT, curto: 15 min) + **refresh token** (longo: 30 dias).

### Tokens
- **Access JWT:** assinado com `JWT_SECRET`, claims mínimos (`sub = userId`, `iat`, `exp`).
  Enviado em `Authorization: Bearer`.
- **Refresh token:** opaco, **hash guardado** em `RefreshToken` (nunca o valor puro). Rotação:
  cada refresh **revoga** o anterior (`revokedAt`) e emite um novo. Reuso de token revogado →
  revoga toda a família (detecção de roubo).
- Logout: revoga o refresh atual.

### Guards
- `JwtAuthGuard` valida o access token e injeta `CurrentUser`.
- `@CurrentUser()` decorator entrega `userId` aos controllers/use cases.
- Canais externos (Telegram) resolvem tenant por `ChannelIdentity` (`docs/06`), não por JWT.

## Isolamento multi-tenant (o mais crítico)

- **Repositório base** recebe `userId` no construtor/contexto e injeta `where: { userId }` +
  `deletedAt: null` em **toda** query. Casos de uso **não** montam `where` de tenant à mão.
- Testes automatizados garantem que nenhuma query de módulo roda sem filtro de tenant.
- IDs são `cuid()` (não sequenciais) → dificultam enumeração.

## Validação de entrada

- **API:** DTOs com `class-validator`/Zod; `ValidationPipe` global (whitelist + forbid unknown).
- **Web:** React Hook Form + Zod (mesmos schemas compartilhados em `packages/types` quando possível).
- Args de **tool calls da IA** passam pelos **mesmos** validadores antes de executar (`docs/07`).

## Rate limiting

- `@nestjs/throttler` com store no **Upstash Redis** (grátis).
- Limites por rota sensível: login (ex.: 5/min por IP+email), webhook de canal, chat.
- Protege contra brute force e abuso do free tier de IA.

## Tratamento de erros

- **Exception filter global** → resposta JSON padronizada:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "traceId": "..." } }
  ```
- Erros de domínio (ex.: `RetroactiveIncomeError`, `PaymentMethodRequiredError`) são classes
  próprias mapeadas para HTTP status corretos. Nunca vazar stack/detalhes internos ao usuário.

## Observabilidade

- **Logs estruturados** com **pino** (JSON), com `traceId`/`userId` por requisição (grátis).
- **Sentry** (free tier) para exceções em api/web/workers.
- Nunca logar segredos, tokens ou senha. PII financeira minimizada nos logs.

## Segredos e config

- `.env` (nunca commitado) + `.env.example` documentado. Em produção: variáveis do host
  (Vercel/Fly). `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `GEMINI_API_KEY`,
  `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SENTRY_DSN`.
- CORS restrito à origem do front. HTTPS obrigatório (garantido pelos hosts).

## Checklist de segurança

- [ ] bcrypt ≥ 12 · senha nunca em texto/logs
- [ ] access curto + refresh rotacionado/revogável
- [ ] tenant isolado no repositório base + teste que prova
- [ ] ValidationPipe global (whitelist)
- [ ] rate limit em login/webhook/chat
- [ ] exception filter + Sentry + pino sem PII sensível
- [ ] CORS restrito · HTTPS · segredos fora do repo
