# Estrutura de Pastas

> Árvore final do monorepo. Cada módulo de `apps/api` segue as 4 camadas da Clean Architecture
> (`domain / application / infrastructure / interface`) descritas em `docs/02`.

```
finanfy/
├─ apps/
│  ├─ web/                         # Next.js — painel + web chat (Vercel)
│  │  ├─ app/                      # rotas (App Router)
│  │  │  ├─ (auth)/login/
│  │  │  ├─ chat/
│  │  │  ├─ dashboard/
│  │  │  ├─ receitas/ despesas/ cartoes/ caixinha/ clientes/ relatorios/ config/
│  │  ├─ components/               # UI (usa packages/ui)
│  │  ├─ lib/                      # api client (TanStack Query), auth
│  │  └─ ...
│  │
│  ├─ api/                         # NestJS — REST + canais + regras + IA (Fly.io/Render)
│  │  ├─ src/
│  │  │  ├─ main.ts app.module.ts
│  │  │  ├─ common/
│  │  │  │  ├─ repository/base.repository.ts   # tenant + soft delete
│  │  │  │  ├─ audit/                          # AuditLog
│  │  │  │  ├─ filters/  guards/  decorators/  logger/  config/
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ incomes/
│  │  │  │  │  ├─ domain/         income.entity.ts · income.repository.ts (porta)
│  │  │  │  │  ├─ application/    registrar-receita.usecase.ts · dtos/
│  │  │  │  │  ├─ infrastructure/ prisma-income.repository.ts
│  │  │  │  │  └─ interface/      incomes.controller.ts · income.intent-handler.ts
│  │  │  │  ├─ expenses/  reserve/  cards/  recurring/  goals/
│  │  │  │  ├─ clients/  categories/  reports/  notifications/
│  │  │  │  ├─ chat/
│  │  │  │  │  ├─ rule-engine/    patterns.ts · handlers/ · rule-engine.ts
│  │  │  │  │  ├─ router/         message-router.ts
│  │  │  │  │  └─ channels/       messaging-channel.ts (porta) · telegram/ · web/
│  │  │  │  └─ ai/                llm-provider.ts (porta) · gemini/ · groq/ · tools/
│  │  └─ test/                     # E2E (Supertest)
│  │
│  └─ workers/                     # BullMQ — jobs agendados (mesmo host da api)
│     └─ src/jobs/                 notify-18h · gerar-recorrentes · fechar-faturas · reconciliar-saldo
│
├─ packages/
│  ├─ shared/                      # regras de negócio puras, value objects (Money), erros de domínio
│  ├─ types/                       # DTOs, enums e contratos compartilhados web<->api
│  ├─ ui/                          # componentes shadcn compartilhados
│  └─ utils/                       # money.ts (parseBRL/format) · text.ts (normalize) · date.ts (tz)
│
├─ prisma/
│  ├─ schema.prisma                # fonte da verdade do banco
│  ├─ migrations/
│  └─ seed.ts                      # categorias padrão
│
├─ docs/                           # esta documentação
├─ .github/workflows/ci.yml        # lint + typecheck + testes
├─ docker-compose.yml              # postgres + redis locais
├─ turbo.json  pnpm-workspace.yaml  tsconfig.base.json
├─ .env.example
└─ README.md
```

## Regras de organização

- **Dependência das camadas:** `interface → application → domain`; `infrastructure` implementa as
  portas do `domain`. O `domain` não importa NestJS nem Prisma.
- **Portas terminam em `.repository.ts`/`-provider.ts`/`-channel.ts`** (interfaces); implementações
  ficam em `infrastructure/` com prefixo do adapter (`prisma-...`, `gemini-...`, `telegram-...`).
- **Um caso de uso por arquivo** em `application/`, classe com `execute()`.
- **Nada de lógica de negócio em controllers** — só entrada/saída e chamada ao use case.
- **Regras puras reutilizáveis** (ex.: cálculo de "quanto posso gastar", `Money`) vão em
  `packages/shared`/`utils`, testáveis sem framework.
