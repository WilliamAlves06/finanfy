# 12 — API REST

> NestJS, REST versionada, documentada em Swagger. A API é consumida pelo web, pelo app futuro e
> por integradores (canal `API`). O chat é só mais um endpoint.

## Convenções

- **Base:** `/v1` (versionamento por URL). Quebras de contrato → `/v2`, sem quebrar `/v1`.
- **Formato:** JSON. Dinheiro trafega em **centavos** (`amountCents`), formatação é da UI.
- **Auth:** `Authorization: Bearer <accessToken>` (exceto register/login/refresh e webhooks).
- **Swagger:** `/docs` (via `@nestjs/swagger`), gerado dos DTOs/decorators.
- **IDs:** `cuid` string.

## Erros (padrão único)

```json
{ "error": { "code": "PAYMENT_METHOD_REQUIRED", "message": "Informe a forma de pagamento.", "traceId": "..." } }
```
Status: 400 validação · 401 não autenticado · 403 sem permissão/tenant · 404 inexistente ·
409 conflito (ex.: duplicado) · 422 regra de domínio · 429 rate limit · 500 interno.

## Paginação e filtros (listas)

- Query: `?page=1&pageSize=20&sort=-date&from=2026-07-01&to=2026-07-31`.
- Resposta: `{ data: [...], page, pageSize, total }`.
- Filtros comuns: período (`from`/`to`), `categoryId`, `clientId`, `method`, `source`.

## Índice de endpoints (por módulo)

### Auth
- `POST /v1/auth/register` · `POST /v1/auth/login` · `POST /v1/auth/refresh` · `POST /v1/auth/logout`

### Receitas
- `POST /v1/incomes` (valor, origem, clienteId?, categoriaId?) — **rejeita data≠hoje**
- `GET /v1/incomes` (filtros/paginação) · `GET /v1/incomes/:id` · `DELETE /v1/incomes/:id` (soft)

### Despesas
- `POST /v1/expenses` (valor, **forma**, categoriaId?, cartaoId?) — **forma obrigatória**
- `GET /v1/expenses` · `GET /v1/expenses/:id` · `DELETE /v1/expenses/:id`

### Caixinha
- `GET /v1/reserve` (saldo) · `POST /v1/reserve/deposit` (valor)
- `POST /v1/reserve/withdraw` (valor, **destino**: `apenas|pagar_conta`)
- `GET /v1/reserve/movements`

### Cartões
- `POST /v1/cards` · `GET /v1/cards` · `GET /v1/cards/:id` (limite/disponível derivado)
- `GET /v1/cards/:id/invoices` · `GET /v1/invoices/:id`

### Contas recorrentes
- `POST /v1/recurring-bills` · `GET /v1/recurring-bills`
- `GET /v1/recurring-charges?status=PENDING` · `POST /v1/recurring-charges/:id/pay` (forma)

### Metas
- `POST /v1/goals` · `GET /v1/goals` · `POST /v1/goals/:id/contributions`

### Clientes / Categorias
- `POST|GET /v1/clients` · `GET /v1/clients/:id` · `PATCH /v1/clients/:id` · `DELETE ...`
- `POST|GET /v1/categories` (padrão não deletável)

### Relatórios (CQRS query, leitura)
- `GET /v1/reports/summary` (saldo, reserva, pendências, faturas)
- `GET /v1/reports/can-spend` · `GET /v1/reports/monthly?month=2026-07`
- `GET /v1/reports/overdue` · `GET /v1/reports/savings?year=2026`

### Chat (todos os canais entram por aqui ou por webhook)
- `POST /v1/chat/messages` (texto) → resposta do assistente (web)
- `POST /v1/channels/telegram/webhook` (público, valida secret token)

### Notificações
- `GET /v1/notifications` · `PATCH /v1/notifications/:id/read`

## Regras de contrato que viram teste

- `POST /incomes` com `date` ≠ hoje → 422 `RETROACTIVE_NOT_ALLOWED`.
- `POST /expenses` sem `forma` → 400 `PAYMENT_METHOD_REQUIRED`.
- `POST /reserve/withdraw` com `destino=pagar_conta` → **não** cria Expense (checar via `GET /expenses`).
- Qualquer GET de outro tenant → 404 (isolamento).
