# 02 — Arquitetura

## Visão em uma frase

Vários **canais** (Telegram, Web, futuro WhatsApp/App/API) enviam **mensagens** para um
**núcleo de domínio único**. Uma mensagem passa primeiro por um **motor de regras (sem IA)**;
só cai na **IA** se for complexa. O resultado é uma **ação financeira** executada nos módulos
de domínio e uma **resposta em linguagem natural**.

## Diagrama de alto nível

```
                    ┌─────────────────────────────────────────────┐
   Telegram ─┐      │                  apps/api (NestJS)           │
   Web Chat ─┼─────▶│  ┌───────────────┐   ┌──────────────────┐    │
   (WhatsApp)┘      │  │ Channel Layer │──▶│  Message Router  │    │
   (App)  (API)     │  │ (adapters)    │   └───────┬──────────┘    │
                    │  └───────────────┘           │               │
                    │                    ┌─────────▼─────────┐      │
                    │                    │  Rule Engine      │      │  regex + regras
                    │                    │  (sem IA)         │      │  ~80-90% das msgs
                    │                    └─────────┬─────────┘      │
                    │                     miss?    │ hit            │
                    │                    ┌─────────▼─────────┐      │
                    │                    │  AI Layer         │      │  Gemini/Groq
                    │                    │ (intent+entities) │      │  function calling
                    │                    └─────────┬─────────┘      │
                    │                              ▼               │
                    │            ┌──────────── Domain Modules ──────────────┐
                    │            │ Receitas Despesas Caixinha Cartões Metas  │
                    │            │ ContasRecorrentes Clientes Categorias ... │
                    │            └───────────┬───────────────────────────────┘
                    │                        │ Repositories (Prisma)         │
                    └────────────────────────┼───────────────────────────────┘
                                             ▼
                          Supabase Postgres · Upstash Redis · Storage
                                             ▲
                    apps/workers (BullMQ): notificações 18h, recorrentes mensais,
                                            faturas, geração de relatórios pesados
```

## Monorepo

```
finanfy/
├─ apps/
│  ├─ web/          # Next.js (painel + web chat) — deploy Vercel
│  ├─ api/          # NestJS (REST + canais + IA + regras) — deploy Fly.io/Render
│  └─ workers/      # BullMQ jobs (cron 18h, recorrentes, faturas) — mesmo host da api
├─ packages/
│  ├─ shared/       # regras de negócio puras, constantes, value objects
│  ├─ types/        # DTOs, contratos, enums compartilhados web<->api
│  ├─ ui/           # componentes shadcn compartilhados
│  └─ utils/        # helpers (datas, dinheiro, parsing pt-BR)
├─ prisma/          # schema, migrations, seeds
├─ docs/            # esta documentação
└─ docker-compose.yml
```

Ferramenta de monorepo: **pnpm workspaces + Turborepo** (ambos grátis).

## Camadas (Clean Architecture) dentro de `apps/api`

Cada módulo de domínio segue a mesma estrutura em 4 camadas:

```
modules/receitas/
├─ domain/                 # entidades, value objects, regras puras (sem Nest, sem Prisma)
│  ├─ receita.entity.ts
│  └─ receita.repository.ts   # INTERFACE (porta)
├─ application/            # casos de uso (services), orquestração
│  ├─ registrar-receita.usecase.ts
│  └─ dtos/
├─ infrastructure/         # implementações (adapters)
│  └─ prisma-receita.repository.ts   # implementa a interface
└─ interface/              # controllers REST + handlers de intenção (do chat)
   ├─ receitas.controller.ts
   └─ receitas.intent-handler.ts
```

**Regra de dependência:** `interface → application → domain`. `infrastructure` implementa portas
do `domain`. O `domain` **não importa nada de framework**. Isso é o que torna trocar
Prisma/Gemini/Telegram barato.

## Padrões aplicados

- **SOLID** em todos os serviços.
- **Repository Pattern:** toda persistência atrás de interface (`XRepository`).
- **Service/Use Case Pattern:** uma classe por caso de uso, método `execute()`.
- **Dependency Injection:** container do NestJS; nada de `new` para dependências.
- **Strategy Pattern:** `LlmProvider` (Gemini/Groq/OpenAI) e `MessagingChannel` (Telegram/Web/...).
- **Chain of Responsibility:** o Rule Engine tenta handlers de regex em ordem; primeiro que casa, resolve.
- **DDD tático:** entidades, value objects (`Money`, `Saldo`), agregados por módulo. Sem exagero.
- **CQRS:** **só** em relatórios/dashboard (leitura otimizada separada da escrita). No resto, não.
- **Soft delete + auditoria:** todas as tabelas têm `deletedAt` e trilha de auditoria.

## Fluxo de uma mensagem (o coração do sistema)

1. Canal recebe texto → normaliza para `IncomingMessage { userId, channel, text }`.
2. **Message Router** identifica o tenant (usuário) e cria/recupera a **sessão de conversa**.
3. **Rule Engine** tenta casar com padrões simples (regex + normalização pt-BR).
   - **Casou** → executa o caso de uso direto. Custo de IA: zero.
   - **Não casou / ambíguo** → segue para IA.
4. **AI Layer** faz _intent detection_ + _entity extraction_ via **function calling**.
   Cada função exposta à IA = um caso de uso do domínio.
5. Caso de uso executa. Se a operação for financeira ambígua → **pede confirmação** (não grava ainda).
6. Resposta em linguagem natural volta pelo mesmo canal, com **saldo atualizado** quando relevante.

Detalhes de regras e IA: `docs/06-camada-de-canais.md`, `docs/07-camada-ia.md`, `docs/08-motor-de-regras.md`.

## Multi-tenant

- Estratégia: **tenant por `userId`** (single DB, linha por usuário). Simples e grátis.
- **Toda** query passa por um `tenantId`/`userId` obrigatório — encapsulado no repositório base,
  nunca deixado a cargo do controller. Testes garantem que nenhuma query roda sem filtro de tenant.

## Segurança e qualidade (transversal)

- Auth JWT + refresh token (rotacionado) + bcrypt. Ver `docs/09-auth-e-seguranca.md`.
- Rate limit por usuário/canal (Nest Throttler + Upstash).
- Validação de entrada com **Zod** (web) e **class-validator/Zod** (api).
- Tratamento global de erros (Nest exception filter) + logs estruturados (pino) + Sentry.
- Testes: unitários (Vitest/Jest) por caso de uso; E2E (Supertest) nos fluxos críticos.
