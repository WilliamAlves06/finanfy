# 04 — Prisma Schema (comentado)

> Complementa `prisma/schema.prisma` explicando **por quê** de cada decisão. Se algo divergir,
> o arquivo `.prisma` é a fonte da verdade.

## Decisões de modelagem

### 1. Dinheiro em centavos (`Int`)

Todo valor monetário é `amountCents: Int`. Float/Decimal de reais causa erros de arredondamento
("0.1 + 0.2"). Guardamos centavos inteiros e formatamos só na borda (UI/mensagem) com um Value
Object `Money` em `packages/utils`. Ex.: R$ 180,00 → `18000`.

### 2. Soft delete (`deletedAt`)

Nada é apagado de verdade (requisito de auditoria do briefing). `deletedAt = null` significa ativo.
O **repositório base** injeta `where: { deletedAt: null }` automaticamente — nenhum caso de uso
precisa lembrar disso. Restaurar = setar `deletedAt = null`.

### 3. Multi-tenant por `userId`

Single database, uma linha por usuário. Cada tabela de negócio tem `userId` + índice
`(userId, deletedAt)`. O repositório base **exige** `userId` em toda query. Simples, grátis e
suficiente para milhares de usuários. Migrar para schema-por-tenant depois é possível, mas
desnecessário no MVP.

### 4. Saldo materializado (`User.balanceCents` e `Reserve.balanceCents`)

O saldo é derivável somando receitas/despesas, mas materializamos para leitura instantânea
("quanto tenho?" precisa ser rápido no chat). Toda escrita que afeta saldo roda dentro de uma
**transação** que atualiza o registro e o saldo juntos, evitando divergência. Um job de
reconciliação (worker) pode recalcular periodicamente como rede de segurança.

### 5. Datas: `date` (dia) vs `createdAt` (timestamp)

`Income.date`/`Expense.date` são `@db.Date` (só o dia, sem hora), porque a regra "sem retroativo"
e os relatórios trabalham por dia. `createdAt` é o timestamp real da criação. Fuso do domínio:
`America/Sao_Paulo` (guardado em `User.timezone`).

### 6. Enums no banco (não tabelas)

`IncomeSource`, `PaymentMethod`, `ChannelProvider` etc. são enums Postgres — são conjuntos fixos
do domínio, não dados do usuário. `Category` é tabela porque o usuário cria as suas.

## Por que cada `@@unique` existe

| Unique                                                | Motivo                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `User.email`                                          | login único.                                                                      |
| `ChannelIdentity (provider, externalId)`              | achar o tenant a partir de um chat do Telegram; um chat só pertence a um usuário. |
| `Invoice (cardId, year, month)`                       | um cartão tem uma fatura por mês.                                                 |
| `RecurringCharge (recurringBillId, year, month)`      | **impede duplicar a cobrança do mês** — o worker roda idempotente.                |
| `Expense.installmentId` / `Expense.recurringChargeId` | relação 1-1: uma parcela/cobrança é quitada por no máximo uma despesa.            |
| `Reserve.userId`                                      | uma caixinha por usuário.                                                         |

> **Não** há unique em "1 receita por dia": o briefing permite **várias receitas no mesmo dia**.

## Índices (performance)

- `(userId, deletedAt)` em toda tabela consultada por tenant → listagens filtram tenant + ativos.
- `(userId, date)` em `Income`/`Expense` → relatórios por período são o caminho quente.
- `(status)` em `RecurringCharge` → o job de notificação varre pendentes/atrasadas.
- `(userId, status)` em `Notification` → fila de envio.
- `(userId, createdAt)` em `AuditLog` → trilha por usuário em ordem.

## Migrations

- Dev: `prisma migrate dev --name <mudança>` (gera SQL versionado em `prisma/migrations/`).
- Prod: `prisma migrate deploy` no CI/CD (nunca `db push` em produção).
- Supabase usa **pooler** para runtime e conexão **direta** para migrations → por isso
  `datasource` tem `url` (pooler) + `directUrl` (direta). Ambos no `.env`.

## Seeds (`prisma/seed.ts`)

Cria as **categorias padrão** (`isDefault: true`) que todo usuário enxerga:

- Receita: Diária, Serviço, Venda, PIX recebido, Outros.
- Despesa: Alimentação, Transporte/Combustível, Materiais, Contas de casa, Saúde, Outros.

Categorias padrão **não são deletáveis** pelo usuário (o use case bloqueia). O seed é idempotente
(`upsert`), pode rodar várias vezes.

## Mapa entidade → módulo → doc

| Entidade                        | Módulo (`apps/api`) | Caso de uso principal               |
| ------------------------------- | ------------------- | ----------------------------------- |
| Income                          | incomes             | Registrar receita (`docs/10` UC-01) |
| Expense                         | expenses            | Registrar despesa (UC-02)           |
| Reserve / ReserveMovement       | reserve             | Guardar/retirar caixinha (UC-03/04) |
| Card / Invoice / Installment    | cards               | Compra no cartão (UC-07)            |
| RecurringBill / RecurringCharge | recurring           | Gerar/pagar cobrança (UC-05/06)     |
| Goal / GoalContribution         | goals               | Meta e aporte (UC-08)               |
| Conversation / Message          | chat                | Roteamento de mensagem              |
| Notification                    | notifications       | Lembretes (UC-09)                   |
| AuditLog                        | common/audit        | transversal                         |
