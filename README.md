# Finanfy — Assistente Financeiro IA

Assistente financeiro **por conversa** para trabalhadores autônomos (diaristas, pedreiros,
motoristas, freelancers…). O usuário **não preenche formulário** — ele conversa, e a IA
organiza a vida financeira dele como um **contador pessoal**.

> **Status:** ✅ MVP funcional — API completa + chat com motor de regras + IA + Telegram + painel web.
> **Custo alvo:** R$ 0/mês — ver [análise de custos](docs/00-custos-e-alternativas-gratis.md).

## Rodando localmente

```bash
pnpm install
pnpm exec prisma generate
# preencha o .env (copie de .env.example) com o Supabase
pnpm db:migrate && pnpm db:seed
pnpm --filter @finanfy/api build && node apps/api/dist/main.js   # API :3001 (Swagger em /docs)
pnpm --filter @finanfy/web dev                                    # Web :3000
```

Chaves opcionais no `.env`: `GEMINI_API_KEY`/`GROQ_API_KEY` (frases compostas via IA) e
`TELEGRAM_BOT_TOKEN` (canal Telegram). Sem elas, o motor de regras cobre os comandos simples.

## Documentação

Leia nesta ordem:

1. [00 — Custos e alternativas 100% grátis](docs/00-custos-e-alternativas-gratis.md) ⚠️ decisões que mudam a stack
2. [01 — Visão e produto](docs/01-visao-e-produto.md)
3. [02 — Arquitetura](docs/02-arquitetura.md)
4. [03 — Modelo de domínio (ER)](docs/03-modelo-de-dominio-er.md)
5. [04 — Prisma schema comentado](docs/04-prisma-schema.md) · [`schema.prisma`](prisma/schema.prisma)
6. [05 — Roadmap e backlog](docs/05-roadmap-e-backlog.md)
7. [06 — Camada de canais](docs/06-camada-de-canais.md)
8. [07 — Camada de IA](docs/07-camada-ia.md)
9. [08 — Motor de regras (sem IA)](docs/08-motor-de-regras.md)
10. [09 — Auth e segurança](docs/09-auth-e-seguranca.md)
11. [10 — Casos de uso](docs/10-casos-de-uso.md)
12. [11 — Wireframes](docs/11-wireframes.md)
13. [12 — API REST](docs/12-api-rest.md)
14. [13 — Testes e qualidade](docs/13-testes-e-qualidade.md)
15. [14 — Fluxogramas](docs/14-fluxogramas.md)
16. [Estrutura de pastas](docs/estrutura-de-pastas.md)

## Stack (versão gratuita)

Next.js · NestJS · Prisma · Postgres (Supabase) · Upstash Redis · BullMQ ·
**Gemini/Groq** (no lugar de OpenAI) · **Telegram** (no lugar de WhatsApp no MVP) ·
Vercel · Fly.io/Oracle Always Free · Sentry · GitHub Actions.

## Princípios

Conversa primeiro · zero fricção · nunca assumir dinheiro (sempre confirmar) ·
regras/regex antes de IA (custo baixo) · multicanal e multi-tenant desde o dia 1.
