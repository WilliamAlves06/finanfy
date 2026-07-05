# 05 — Roadmap e Backlog

Evolução **incremental**. Cada fase entrega algo usável e testável. Nunca tudo de uma vez.

## Fases

| Fase | Objetivo | Entrega usável |
|---|---|---|
| **F0 — Fundação** | Monorepo, Prisma, auth, CI, docker | Login funciona, DB migrado, testes rodando |
| **F1 — Núcleo financeiro** | Receitas, Despesas, Saldo, Categorias (via REST) | Painel web básico registra dinheiro |
| **F2 — Caixinha, Cartões, Recorrentes, Metas** | Módulos restantes + workers | Reserva, faturas e cobranças mensais |
| **F3 — Chat + Motor de Regras** | Canal Web Chat + Rule Engine (sem IA) | "ganhei 200", "saldo", "paguei água 90" |
| **F4 — IA** | Gemini/Groq + function calling p/ frases complexas | Frase composta vira várias ações |
| **F5 — Telegram** | Canal Telegram plugado no núcleo | Usar tudo pelo Telegram |
| **F6 — Notificações + Relatórios + Dashboard** | Cron 18h, lembretes, relatórios, dashboard | Produto "contador pessoal" completo |
| **F7+ — Futuro** | WhatsApp, App, OCR, Open Finance, planos | Ver `docs/01` (fora do MVP) |

## Backlog detalhado (tarefas pequenas)

Formato de cada tarefa: **Objetivo · Arquivos · Critérios de aceite · Testes · Checklist**.
Abaixo o backlog de F0 e F1 detalhado; F2+ listado em título (detalhar quando chegar a vez).

---

### F0 — Fundação

#### T0.1 — Inicializar monorepo
- **Objetivo:** pnpm + Turborepo com apps/packages vazios compilando.
- **Arquivos:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`.
- **Aceite:** `pnpm install` e `pnpm build` passam sem erro.
- **Testes:** smoke (`pnpm -r typecheck`).
- **Checklist:** [ ] workspaces [ ] turbo pipeline [ ] tsconfig compartilhado [ ] eslint/prettier.

#### T0.2 — Prisma + banco
- **Objetivo:** schema aplicado no Supabase, client gerado, seed de categorias padrão.
- **Arquivos:** `prisma/schema.prisma`, `prisma/seed.ts`, `.env.example`.
- **Aceite:** `prisma migrate dev` cria tabelas; `prisma db seed` insere categorias.
- **Testes:** teste de integração cria e lê um `User`.
- **Checklist:** [ ] migration inicial [ ] seed [ ] índices [ ] soft delete no repositório base.

#### T0.3 — Esqueleto NestJS + config
- **Objetivo:** `apps/api` sobe, health check, config por env, pino, exception filter global.
- **Arquivos:** `apps/api/src/main.ts`, `app.module.ts`, `common/filters`, `common/logger`.
- **Aceite:** `GET /health` retorna 200; erro não tratado vira JSON padronizado.
- **Testes:** E2E do `/health` e do filtro de erro.
- **Checklist:** [ ] ConfigModule [ ] pino [ ] filtro global [ ] Swagger em `/docs`.

#### T0.4 — Auth (JWT + refresh + bcrypt)
- **Objetivo:** cadastro, login, refresh, logout; guard de tenant.
- **Arquivos:** `modules/auth/*`, `common/guards/jwt.guard.ts`, `common/decorators/current-user.ts`.
- **Aceite:** fluxo completo funciona; refresh rotaciona e revoga; senha nunca em texto.
- **Testes:** unit (hash, geração/rotação de token) + E2E (register→login→refresh→logout).
- **Checklist:** [ ] bcrypt [ ] access+refresh [ ] rotação [ ] rate limit no login.

#### T0.5 — CI/CD
- **Objetivo:** GitHub Actions rodando lint + typecheck + testes em PR.
- **Arquivos:** `.github/workflows/ci.yml`, `docker-compose.yml` (postgres+redis local).
- **Aceite:** PR falha se teste/lint falhar.
- **Checklist:** [ ] cache pnpm [ ] serviços postgres/redis [ ] matriz de apps.

---

### F1 — Núcleo financeiro (REST primeiro, chat depois)

#### T1.1 — Repositório base multi-tenant + auditoria + soft delete
- **Objetivo:** classe base que injeta `userId` em toda query e grava `AuditLog`.
- **Arquivos:** `common/repository/base.repository.ts`, `common/audit/*`.
- **Aceite:** impossível consultar sem `userId`; toda escrita gera log.
- **Testes:** unit garante filtro de tenant e criação de auditoria.

#### T1.2 — Módulo Categorias
- **Objetivo:** CRUD de categorias (padrão + do usuário).
- **Aceite:** lista traz padrão + próprias; não deleta padrão do sistema.
- **Testes:** unit do use case + E2E CRUD.

#### T1.3 — Módulo Receitas
- **Objetivo:** registrar/listar receita com **origem obrigatória**, data = hoje, **sem retroativo**.
- **Arquivos:** `modules/incomes/*`.
- **Aceite:** rejeita data ≠ hoje; aceita várias no mesmo dia; atualiza `balanceCents`.
- **Testes:** unit (regra sem-retroativo, soma de saldo) + E2E.
- **Checklist:** [ ] enum origem [ ] várias/dia [ ] bloqueio retroativo [ ] cliente/categoria opcionais.

#### T1.4 — Módulo Despesas
- **Objetivo:** registrar despesa com **forma de pagamento obrigatória**; efeito por método.
- **Arquivos:** `modules/expenses/*`.
- **Aceite:** SALDO abate `balanceCents`; CAIXINHA abate reserva; CARTAO cria parcela/fatura;
  DINHEIRO/PIX não afetam saldo materializado (config); nunca infere método.
- **Testes:** unit por método + E2E.

#### T1.5 — Consulta de saldo / "quanto posso gastar"
- **Objetivo:** endpoint/serviço de leitura (CQRS query) do resumo financeiro.
- **Aceite:** retorna saldo disponível, reserva, pendências, faturas abertas.
- **Testes:** unit do cálculo com cenários.

---

### F2 — Caixinha, Cartões, Recorrentes, Metas (títulos)
- T2.1 Reserve + ReserveMovement (regras de destino ao retirar).
- T2.2 Cartões, Faturas, Parcelas (cálculo de disponível derivado).
- T2.3 RecurringBill + worker mensal que gera RecurringCharge (não duplica, não apaga pendência).
- T2.4 Metas + aportes.

### F3 — Chat + Motor de Regras (títulos)
- T3.1 Channel Layer (interface `MessagingChannel`) + Web Chat.
- T3.2 Message Router + Conversation/Message + memória.
- T3.3 Rule Engine (Chain of Responsibility): saldo, ganhei X, recebi X, paguei X Y, caixinha X, relatório.
- T3.4 Fluxo de confirmação para operações ambíguas.

### F4 — IA (títulos)
- T4.1 Interface `LlmProvider` + adapters Gemini e Groq.
- T4.2 Function calling: cada caso de uso vira função exposta.
- T4.3 Intent + entity extraction; anti-duplicação; nunca assumir valor.

### F5 — Telegram (títulos)
- T5.1 Adapter Telegram (webhook) + vínculo `ChannelIdentity`.

### F6 — Notificações + Relatórios + Dashboard (títulos)
- T6.1 Cron 18h "sem receita hoje"; lembretes de vencimento/fatura/saldo negativo.
- T6.2 Relatórios (queries CQRS) para todas as perguntas do briefing.
- T6.3 Dashboard web (resumo, fluxo, calendário, cartões, caixinha, clientes, histórico).

## Ordem recomendada de execução

`T0.1 → T0.2 → T0.3 → T0.4 → T0.5 → T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → F2 → F3 → F4 → F5 → F6`

> Cada tarefa vira 1 PR pequeno, com testes, antes de ir para a próxima.
